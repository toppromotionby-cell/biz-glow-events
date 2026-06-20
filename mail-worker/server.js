// Event Hub Mail Worker
// IMAP/SMTP bridge called by the Lovable app's server functions.
// All requests must include header X-Worker-Secret matching MAIL_WORKER_SECRET.

import express from "express";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import nodemailer from "nodemailer";

const app = express();
app.use(express.json({ limit: "30mb" }));

const SECRET = process.env.MAIL_WORKER_SECRET;
if (!SECRET) {
  console.error("MAIL_WORKER_SECRET env var is required");
  process.exit(1);
}

// ───────────── auth middleware ─────────────
app.use((req, res, next) => {
  if (req.path === "/health") return next();
  const provided = req.get("X-Worker-Secret");
  if (provided !== SECRET) return res.status(401).json({ error: "unauthorized" });
  next();
});

app.get("/health", (_req, res) => res.json({ ok: true, ts: Date.now() }));

// ───────────── helpers ─────────────
function buildImap(cfg) {
  return new ImapFlow({
    host: cfg.imap_host,
    port: cfg.imap_port ?? 993,
    secure: cfg.imap_secure ?? true,
    auth: { user: cfg.username, pass: cfg.password },
    logger: false,
    socketTimeout: 60_000,
  });
}

function buildSmtp(cfg) {
  return nodemailer.createTransport({
    host: cfg.smtp_host,
    port: cfg.smtp_port ?? 465,
    secure: cfg.smtp_secure ?? true,
    auth: { user: cfg.username, pass: cfg.password },
  });
}

const FOLDER_KIND = (special) => {
  const s = (special || "").toLowerCase().replace(/^\\/, "");
  if (["inbox"].includes(s)) return "inbox";
  if (["sent"].includes(s)) return "sent";
  if (["drafts", "draft"].includes(s)) return "drafts";
  if (["junk", "spam"].includes(s)) return "spam";
  if (["trash"].includes(s)) return "trash";
  if (["archive", "all"].includes(s)) return "archive";
  return "custom";
};

// ───────────── /test ─────────────
// Verify IMAP + SMTP credentials work.
app.post("/test", async (req, res) => {
  const cfg = req.body;
  try {
    const imap = buildImap(cfg);
    await imap.connect();
    await imap.logout();
    const smtp = buildSmtp(cfg);
    await smtp.verify();
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ ok: false, error: String(err?.message || err) });
  }
});

// ───────────── /folders ─────────────
// List all IMAP folders with special-use info + counts.
app.post("/folders", async (req, res) => {
  const cfg = req.body;
  const imap = buildImap(cfg);
  try {
    await imap.connect();
    const list = await imap.list({ statusQuery: { messages: true, unseen: true, uidNext: true, uidValidity: true } });
    const folders = list.map((f) => ({
      path: f.path,
      name: f.name,
      delimiter: f.delimiter,
      special_use: f.specialUse || null,
      kind: FOLDER_KIND(f.specialUse || f.path),
      total_count: f.status?.messages ?? 0,
      unread_count: f.status?.unseen ?? 0,
      uidvalidity: f.status?.uidValidity ? Number(f.status.uidValidity) : null,
      uidnext: f.status?.uidNext ? Number(f.status.uidNext) : null,
    }));
    res.json({ ok: true, folders });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err?.message || err) });
  } finally {
    try { await imap.logout(); } catch {}
  }
});

// ───────────── /messages ─────────────
// Fetch a page of message envelopes for a folder, plus optional full body for given UIDs.
app.post("/messages", async (req, res) => {
  const { account, folder, since_uid, limit = 50, fetch_bodies = false } = req.body;
  const imap = buildImap(account);
  try {
    await imap.connect();
    const lock = await imap.getMailboxLock(folder);
    try {
      const mb = imap.mailbox;
      const seq = since_uid
        ? `${Number(since_uid) + 1}:*`
        : `${Math.max(1, (mb.uidNext || 1) - limit)}:*`;

      const messages = [];
      for await (const msg of imap.fetch(
        { uid: seq },
        {
          envelope: true,
          flags: true,
          size: true,
          internalDate: true,
          source: fetch_bodies,
          bodyStructure: true,
        },
        { uid: true },
      )) {
        const base = {
          uid: Number(msg.uid),
          message_id: msg.envelope?.messageId || null,
          thread_id: msg.threadId || null,
          subject: msg.envelope?.subject || null,
          from: msg.envelope?.from?.[0] || null,
          to: msg.envelope?.to || [],
          cc: msg.envelope?.cc || [],
          bcc: msg.envelope?.bcc || [],
          reply_to: msg.envelope?.replyTo || [],
          sent_at: msg.envelope?.date || null,
          received_at: msg.internalDate || null,
          size: msg.size,
          flags: Array.from(msg.flags || []),
          seen: (msg.flags || new Set()).has("\\Seen"),
          starred: (msg.flags || new Set()).has("\\Flagged"),
          has_attachments: !!msg.bodyStructure?.childNodes?.some?.((n) => n.disposition === "attachment"),
        };
        if (fetch_bodies && msg.source) {
          const parsed = await simpleParser(msg.source);
          base.body_html = parsed.html || null;
          base.body_text = parsed.text || null;
          base.snippet = (parsed.text || "").slice(0, 200).replace(/\s+/g, " ").trim();
          base.attachments = (parsed.attachments || []).map((a, i) => ({
            id: `${msg.uid}:${i}`,
            filename: a.filename || `attachment-${i}`,
            mime_type: a.contentType,
            size_bytes: a.size,
            content_id: a.cid || null,
            is_inline: a.contentDisposition === "inline",
            content_base64: a.content?.toString("base64") || null,
          }));
        }
        messages.push(base);
      }

      res.json({
        ok: true,
        uidvalidity: Number(mb.uidValidity),
        uidnext: Number(mb.uidNext),
        messages: messages.sort((a, b) => b.uid - a.uid),
      });
    } finally {
      lock.release();
    }
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err?.message || err) });
  } finally {
    try { await imap.logout(); } catch {}
  }
});

// ───────────── /message ─────────────
// Fetch full body + attachments for a single message by UID.
app.post("/message", async (req, res) => {
  const { account, folder, uid } = req.body;
  const imap = buildImap(account);
  try {
    await imap.connect();
    const lock = await imap.getMailboxLock(folder);
    try {
      const msg = await imap.fetchOne(uid, { source: true, flags: true, envelope: true, internalDate: true }, { uid: true });
      if (!msg) return res.status(404).json({ ok: false, error: "not_found" });
      const parsed = await simpleParser(msg.source);
      res.json({
        ok: true,
        uid: Number(msg.uid),
        flags: Array.from(msg.flags || []),
        body_html: parsed.html || null,
        body_text: parsed.text || null,
        headers: Object.fromEntries(parsed.headers || []),
        attachments: (parsed.attachments || []).map((a, i) => ({
          id: `${msg.uid}:${i}`,
          filename: a.filename || `attachment-${i}`,
          mime_type: a.contentType,
          size_bytes: a.size,
          content_id: a.cid || null,
          is_inline: a.contentDisposition === "inline",
          content_base64: a.content?.toString("base64") || null,
        })),
      });
    } finally {
      lock.release();
    }
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err?.message || err) });
  } finally {
    try { await imap.logout(); } catch {}
  }
});

// ───────────── /flag /move /delete ─────────────
app.post("/flag", async (req, res) => {
  const { account, folder, uid, add = [], remove = [] } = req.body;
  const imap = buildImap(account);
  try {
    await imap.connect();
    const lock = await imap.getMailboxLock(folder);
    try {
      if (add.length) await imap.messageFlagsAdd(uid, add, { uid: true });
      if (remove.length) await imap.messageFlagsRemove(uid, remove, { uid: true });
      res.json({ ok: true });
    } finally { lock.release(); }
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err?.message || err) });
  } finally { try { await imap.logout(); } catch {} }
});

app.post("/move", async (req, res) => {
  const { account, folder, uid, destination } = req.body;
  const imap = buildImap(account);
  try {
    await imap.connect();
    const lock = await imap.getMailboxLock(folder);
    try {
      await imap.messageMove(uid, destination, { uid: true });
      res.json({ ok: true });
    } finally { lock.release(); }
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err?.message || err) });
  } finally { try { await imap.logout(); } catch {} }
});

app.post("/delete", async (req, res) => {
  const { account, folder, uid } = req.body;
  const imap = buildImap(account);
  try {
    await imap.connect();
    const lock = await imap.getMailboxLock(folder);
    try {
      await imap.messageDelete(uid, { uid: true });
      res.json({ ok: true });
    } finally { lock.release(); }
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err?.message || err) });
  } finally { try { await imap.logout(); } catch {} }
});

// ───────────── /send ─────────────
app.post("/send", async (req, res) => {
  const { account, message, append_to_sent = true, sent_folder = "Sent" } = req.body;
  try {
    const smtp = buildSmtp(account);
    const info = await smtp.sendMail({
      from: { name: account.display_name || account.email, address: account.email },
      to: message.to,
      cc: message.cc,
      bcc: message.bcc,
      subject: message.subject,
      text: message.text,
      html: message.html,
      inReplyTo: message.in_reply_to,
      references: message.references,
      attachments: (message.attachments || []).map((a) => ({
        filename: a.filename,
        content: Buffer.from(a.content_base64, "base64"),
        contentType: a.mime_type,
      })),
    });

    if (append_to_sent) {
      try {
        const imap = buildImap(account);
        await imap.connect();
        await imap.append(sent_folder, info.message || "", ["\\Seen"]);
        await imap.logout();
      } catch (e) {
        console.warn("append-to-sent failed:", e?.message);
      }
    }

    res.json({ ok: true, message_id: info.messageId });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`mail-worker listening on :${PORT}`));
