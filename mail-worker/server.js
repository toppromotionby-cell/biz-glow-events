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
function buildImap(cfg, over = {}) {
  const host = over.imap_host ?? cfg.imap_host;
  const secure = over.imap_secure ?? cfg.imap_secure ?? true;
  return new ImapFlow({
    host,
    port: over.imap_port ?? cfg.imap_port ?? 993,
    secure,
    auth: { user: over.username ?? cfg.username, pass: cfg.password },
    logger: false,
    socketTimeout: 60_000,
    tls: { servername: host, rejectUnauthorized: (over.allow_invalid_cert ?? cfg.allow_invalid_cert) ? false : true },
  });
}

function buildSmtp(cfg, over = {}) {
  const host = over.smtp_host ?? cfg.smtp_host;
  const secure = over.smtp_secure ?? cfg.smtp_secure ?? true;
  const port = over.smtp_port ?? cfg.smtp_port ?? 465;
  return nodemailer.createTransport({
    host,
    port,
    secure,
    requireTLS: !secure && port !== 25,
    auth: { user: over.username ?? cfg.username, pass: cfg.password },
    connectionTimeout: 20_000,
    greetingTimeout: 20_000,
    socketTimeout: 30_000,
    tls: { servername: host, rejectUnauthorized: (over.allow_invalid_cert ?? cfg.allow_invalid_cert) ? false : true },
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

// Разбор ошибки в машиночитаемый вид (imapflow / nodemailer / node net).
function describeError(err) {
  const raw = String(err?.message || err || "unknown");
  const code = String(err?.code || err?.responseCode || "");
  const response = String(err?.response || err?.responseText || "");
  const authFailed =
    err?.authenticationFailed === true ||
    code === "AUTHENTICATIONFAILED" ||
    code === "EAUTH" ||
    /auth|login|credential|password/i.test(response) ||
    /invalid credentials|authentication fail/i.test(raw);
  let kind = "unknown";
  if (authFailed) kind = "auth";
  else if (/ENOTFOUND|EAI_AGAIN/.test(code)) kind = "dns";
  else if (/ECONNREFUSED|EHOSTUNREACH|ENETUNREACH/.test(code)) kind = "refused";
  else if (/ETIMEDOUT|ESOCKET|timeout/i.test(code + raw)) kind = "timeout";
  else if (/CERT|SELF_SIGNED|ALTNAME|SSL|TLS|wrong version number/i.test(code + raw)) kind = "tls";
  else if (/Command failed/i.test(raw)) kind = "command_failed";
  return { kind, code: code || null, message: raw, response: response || null };
}

// ───────────── /test ─────────────
// Пошаговая проверка IMAP + SMTP с автоподбором логина/порта/шифрования.
app.post("/test", async (req, res) => {
  const cfg = req.body || {};
  const steps = [];
  const email = String(cfg.email || "");
  const login = String(cfg.username || email);
  const shortLogin = login.includes("@") ? login.split("@")[0] : login;

  const logins = [...new Set([login, email, shortLogin].filter(Boolean))];

  // Кандидаты IMAP: как задано → 993/SSL → 143/STARTTLS
  const imapVariants = [
    { imap_port: cfg.imap_port ?? 993, imap_secure: cfg.imap_secure ?? true },
    { imap_port: 993, imap_secure: true },
    { imap_port: 143, imap_secure: false },
  ];
  const smtpVariants = [
    { smtp_port: cfg.smtp_port ?? 465, smtp_secure: cfg.smtp_secure ?? true },
    { smtp_port: 465, smtp_secure: true },
    { smtp_port: 587, smtp_secure: false },
    { smtp_port: 25, smtp_secure: false },
  ];

  const dedupe = (arr, keys) => {
    const seen = new Set();
    return arr.filter((v) => {
      const k = keys.map((x) => String(v[x])).join("|");
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  };

  let imapOk = null; // { username, imap_port, imap_secure, allow_invalid_cert, folders }
  let imapErr = null;

  for (const user of logins) {
    for (const variant of dedupe(imapVariants, ["imap_port", "imap_secure"])) {
      for (const allow_invalid_cert of [false, true]) {
        const over = { ...variant, username: user, allow_invalid_cert };
        const imap = buildImap(cfg, over);
        try {
          await imap.connect();
          let folders = 0;
          try {
            const list = await imap.list();
            folders = list.length;
          } catch {
            /* список папок необязателен для успеха */
          }
          imapOk = { ...over, folders };
          try { await imap.logout(); } catch { /* noop */ }
          break;
        } catch (err) {
          imapErr = { ...describeError(err), tried: over };
          try { await imap.logout(); } catch { /* noop */ }
          // Неверный пароль — нет смысла перебирать порты для этого логина
          if (imapErr.kind === "auth") break;
          // Сертификат перепроверяем с allow_invalid_cert, иначе выходим из цикла
          if (imapErr.kind !== "tls") break;
        }
      }
      if (imapOk || imapErr?.kind === "auth") break;
    }
    if (imapOk) break;
  }

  steps.push(
    imapOk
      ? { step: "imap", ok: true, detail: `${imapOk.username} · порт ${imapOk.imap_port}${imapOk.imap_secure ? " · SSL" : " · STARTTLS"} · папок: ${imapOk.folders}` }
      : { step: "imap", ok: false, ...(imapErr ?? { kind: "unknown", message: "нет попыток" }) },
  );

  // SMTP проверяем логином, который подошёл для IMAP (или исходным)
  const smtpLogin = imapOk?.username ?? login;
  let smtpOk = null;
  let smtpErr = null;
  for (const variant of dedupe(smtpVariants, ["smtp_port", "smtp_secure"])) {
    for (const allow_invalid_cert of [false, true]) {
      const over = { ...variant, username: smtpLogin, allow_invalid_cert };
      try {
        const smtp = buildSmtp(cfg, over);
        await smtp.verify();
        smtpOk = over;
        break;
      } catch (err) {
        smtpErr = { ...describeError(err), tried: over };
        if (smtpErr.kind === "auth") break;
        if (smtpErr.kind !== "tls") break;
      }
    }
    if (smtpOk || smtpErr?.kind === "auth") break;
  }

  steps.push(
    smtpOk
      ? { step: "smtp", ok: true, detail: `порт ${smtpOk.smtp_port}${smtpOk.smtp_secure ? " · SSL" : " · STARTTLS"}` }
      : { step: "smtp", ok: false, ...(smtpErr ?? { kind: "unknown", message: "нет попыток" }) },
  );

  const ok = !!imapOk && !!smtpOk;
  const suggestion = ok
    ? {
        username: imapOk.username,
        imap_port: imapOk.imap_port,
        imap_secure: imapOk.imap_secure,
        smtp_port: smtpOk.smtp_port,
        smtp_secure: smtpOk.smtp_secure,
        allow_invalid_cert: !!(imapOk.allow_invalid_cert || smtpOk.allow_invalid_cert),
      }
    : null;

  const failed = steps.find((s) => !s.ok);
  res.status(ok ? 200 : 400).json({
    ok,
    steps,
    suggestion,
    error: ok ? undefined : `${failed?.step?.toUpperCase() ?? ""}: ${failed?.message ?? "unknown"}`,
    error_kind: ok ? undefined : failed?.kind,
  });
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
