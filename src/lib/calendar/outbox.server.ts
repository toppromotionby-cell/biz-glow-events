// Лента событий ассистента: всё, что бот отправляет в Telegram, попадает сюда,
// чтобы Алиса могла зачитать пропущенное, а админка — показать историю.
type Db = Awaited<ReturnType<typeof import("@/lib/calendar/store.server").admin>>;

export interface OutboxRow {
  id: string;
  channel: string;
  kind: string;
  text: string;
  item_id: string | null;
  spoken_at: string | null;
  pushed_at: string | null;
  created_at: string;
}

/** HTML Telegram → чистый текст для озвучки и логов. */
export function plainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Убираем эмодзи и служебные символы — Алиса не должна их проговаривать. */
export function speechText(text: string): string {
  return plainText(text)
    .replace(/[\u{1F000}-\u{1FAFF}\u{2300}-\u{27BF}\u{FE0F}\u{2190}-\u{21FF}]/gu, " ")
    .replace(/[•·]/g, ",")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+,/g, ",")
    .trim();
}

export async function pushOutbox(
  db: Db,
  entry: { text: string; kind?: string; channel?: string; item_id?: string | null },
): Promise<void> {
  const text = plainText(entry.text);
  if (!text) return;
  const { error } = await db.from("calendar_outbox").insert({
    channel: entry.channel ?? "telegram",
    kind: entry.kind ?? "note",
    text,
    item_id: entry.item_id ?? null,
  });
  if (error) console.error("[planner] outbox insert failed", error.message);
}

/** Непрочитанные (не зачитанные Алисой) сообщения бота. */
export async function listUnspoken(db: Db, limit = 10): Promise<OutboxRow[]> {
  const { data } = await db
    .from("calendar_outbox")
    .select("*")
    .is("spoken_at", null)
    .order("created_at", { ascending: true })
    .limit(limit);
  return (data ?? []) as unknown as OutboxRow[];
}

export async function markSpoken(db: Db, ids: string[]): Promise<void> {
  if (!ids.length) return;
  await db.from("calendar_outbox").update({ spoken_at: new Date().toISOString() }).in("id", ids);
}

export async function markPushed(db: Db, ids: string[]): Promise<void> {
  if (!ids.length) return;
  await db.from("calendar_outbox").update({ pushed_at: new Date().toISOString() }).in("id", ids);
}

/** Последние сообщения для админки (лента событий планера). */
export async function listRecent(db: Db, limit = 30): Promise<OutboxRow[]> {
  const { data } = await db
    .from("calendar_outbox")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as unknown as OutboxRow[];
}
