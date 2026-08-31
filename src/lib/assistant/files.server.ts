// Поиск документов портала и выдача их в Telegram в PDF. Только сервер.
import type { TgDocKind } from "@/lib/telegram/doc-kinds";
import { TG_DOC_LABELS } from "@/lib/telegram/doc-kinds";
import { admin, logFileGrant, type Identity } from "@/lib/assistant/store.server";

export interface DocHit {
  kind: TgDocKind;
  id: string;
  title: string;
  number: string | null;
  date: string | null;
  status: string | null;
  /** Требует роли администратора (внутренние данные). */
  internal: boolean;
}

function like(q: string): string {
  return `%${q.replace(/[%_]/g, " ").trim()}%`;
}

function d(v: unknown): string | null {
  const s = typeof v === "string" ? v : null;
  return s ? s.slice(0, 10) : null;
}

/**
 * Поиск по всем документным сущностям. Пустой запрос — последние документы.
 * Внутренние варианты (себестоимость/маржа) в выдачу не попадают: их запрашивают явно.
 */
export async function searchDocs(query: string, limit = 8): Promise<DocHit[]> {
  const db = await admin();
  const q = query.trim();
  const hits: DocHit[] = [];

  const add = (rows: unknown[], map: (r: Record<string, unknown>) => DocHit) => {
    for (const r of rows ?? []) hits.push(map(r as Record<string, unknown>));
  };

  const quotes = db
    .from("quotes")
    .select("id, quote_number, title, client_name, client_company, doc_date, status")
    .order("created_at", { ascending: false })
    .limit(limit);
  const promos = db
    .from("promo_quotes")
    .select("id, doc_number, project, client_name, status, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  const fins = db
    .from("finance_documents")
    .select("id, doc_number, kind, client_name, client_company, doc_date, status")
    .order("created_at", { ascending: false })
    .limit(limit);
  const papers = db
    .from("paperwork_documents")
    .select("id, doc_number, title, doc_type, doc_date, status")
    .order("created_at", { ascending: false })
    .limit(limit);
  const pres = db
    .from("presentations")
    .select("id, title, status, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  const orders = db
    .from("orders")
    .select("id, order_number, client_name, client_company, event_date, status")
    .order("created_at", { ascending: false })
    .limit(limit);

  const [qq, pq, fq, pw, pr, or] = await Promise.all([
    q ? quotes.or(`quote_number.ilike.${like(q)},title.ilike.${like(q)},client_name.ilike.${like(q)},client_company.ilike.${like(q)}`) : quotes,
    q ? promos.or(`doc_number.ilike.${like(q)},project.ilike.${like(q)},client_name.ilike.${like(q)}`) : promos,
    q ? fins.or(`doc_number.ilike.${like(q)},client_name.ilike.${like(q)},client_company.ilike.${like(q)}`) : fins,
    q ? papers.or(`doc_number.ilike.${like(q)},title.ilike.${like(q)}`) : papers,
    q ? pres.ilike("title", like(q)) : pres,
    q ? orders.or(`order_number.ilike.${like(q)},client_name.ilike.${like(q)},client_company.ilike.${like(q)}`) : orders,
  ]);

  add(qq.data ?? [], (r) => ({
    kind: "quote",
    id: String(r.id),
    title: String(r.title || r.client_company || r.client_name || "КП"),
    number: (r.quote_number as string) ?? null,
    date: d(r.doc_date),
    status: (r.status as string) ?? null,
    internal: false,
  }));
  add(pq.data ?? [], (r) => ({
    kind: "promo",
    id: String(r.id),
    title: String(r.project || r.client_name || "Промо-КП"),
    number: (r.doc_number as string) ?? null,
    date: d(r.created_at),
    status: (r.status as string) ?? null,
    internal: false,
  }));
  add(fq.data ?? [], (r) => ({
    kind: "finance",
    id: String(r.id),
    title: `${String(r.kind ?? "Документ")} · ${String(r.client_company || r.client_name || "")}`.trim(),
    number: (r.doc_number as string) ?? null,
    date: d(r.doc_date),
    status: (r.status as string) ?? null,
    internal: false,
  }));
  add(pw.data ?? [], (r) => ({
    kind: "paperwork",
    id: String(r.id),
    title: String(r.title || r.doc_type || "Документ"),
    number: (r.doc_number as string) ?? null,
    date: d(r.doc_date),
    status: (r.status as string) ?? null,
    internal: false,
  }));
  add(pr.data ?? [], (r) => ({
    kind: "presentation",
    id: String(r.id),
    title: String(r.title || "Презентация"),
    number: null,
    date: d(r.created_at),
    status: (r.status as string) ?? null,
    internal: false,
  }));
  add(or.data ?? [], (r) => ({
    kind: "order",
    id: String(r.id),
    title: String(r.client_company || r.client_name || "Заявка"),
    number: (r.order_number as string) ?? null,
    date: d(r.event_date),
    status: (r.status as string) ?? null,
    internal: false,
  }));

  return hits.slice(0, limit * 2);
}

export function renderDocList(hits: DocHit[]): string {
  if (!hits.length) return "Ничего не нашёл. Уточните название, номер или клиента.";
  return hits
    .map(
      (h, i) =>
        `${i + 1}. <b>${TG_DOC_LABELS[h.kind]}</b> ${h.number ? `№${h.number} ` : ""}— ${h.title}` +
        `${h.date ? ` · ${h.date}` : ""}${h.status ? ` · ${h.status}` : ""}`,
    )
    .join("\n");
}

/** Кнопки выдачи файлов: callback вида doc:<kind>:<id>. */
export function docButtons(hits: DocHit[], isAdmin: boolean): { text: string; data: string }[][] {
  return hits.slice(0, 6).map((h) => {
    const row = [{ text: `📄 ${h.number ?? h.title.slice(0, 24)}`, data: `doc:${h.kind}:${h.id}` }];
    if (isAdmin && (h.kind === "quote" || h.kind === "promo")) {
      row.push({ text: "🔒 внутр.", data: `doc:${h.kind}-internal:${h.id}` });
    }
    return row;
  });
}

/** Сборка и отправка PDF в чат. Возвращает человекочитаемый результат. */
export async function sendDoc(
  who: Identity,
  kind: TgDocKind,
  id: string,
): Promise<{ ok: boolean; message: string }> {
  const internal = kind.endsWith("-internal");
  if (internal && !who.isAdmin) {
    return { ok: false, message: "🚫 Недостаточно прав: внутренние расчёты доступны только администратору." };
  }
  if (!who.isStaff) {
    return { ok: false, message: "🚫 Недостаточно прав для получения документов." };
  }
  try {
    const { buildTelegramDoc } = await import("@/lib/telegram/doc-export.server");
    const { tgSendDocument } = await import("@/lib/assistant/transport.server");
    const doc = await buildTelegramDoc(kind, id);
    const caption = internal
      ? `${doc.caption}\n\n<b>Внутренний документ — не для клиента.</b>`
      : doc.caption;
    const res = await tgSendDocument(who.chatId, doc.filename, doc.bytes, caption);
    if (!res.ok) return { ok: false, message: `Не смог отправить файл: ${res.error}` };
    await logFileGrant({
      userId: who.userId,
      chatId: who.chatId,
      kind,
      docId: id,
      filename: doc.filename,
      internal,
    });
    return { ok: true, message: "" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "неизвестная ошибка";
    return { ok: false, message: `Документ собрать не удалось: ${msg}` };
  }
}
