// Общая обучаемая память ботов портала: чему научили одного — знает и второй.
// Хранится в таблице assistant_memory, записи со scope='shared' видят все боты.
import type { MemoryKind } from "@/lib/botkit/learn";

export type { MemoryKind };

type Db = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

export type BotId = "assistant" | "planner" | "dj";

export interface MemoryRow {
  id: string;
  kind: MemoryKind;
  key: string;
  value: string;
  source: string;
  bot: string;
  scope: string;
  weight: number;
  active: boolean;
  last_used_at: string | null;
  created_at: string;
}

export const MEMORY_KIND_LABEL: Record<MemoryKind, string> = {
  alias: "Словарь",
  habit: "Привычка",
  rule: "Правило",
  fact: "Факт",
};

export const BOT_LABEL: Record<string, string> = {
  assistant: "бот админки",
  planner: "бот календаря",
  dj: "диджей-бот",
  shared: "общее",
};

const MAX_ACTIVE = 80;

/** Все общие записи (плюс личные записи конкретного бота, если он указан). */
export async function listMemory(db: Db, opts?: { bot?: BotId; includeInactive?: boolean }): Promise<MemoryRow[]> {
  let q = db
    .from("assistant_memory")
    .select("*")
    .order("weight", { ascending: false })
    .order("created_at", { ascending: false });
  if (!opts?.includeInactive) q = q.eq("active", true);
  const { data, error } = await q;
  if (error) {
    console.error("[botkit-memory] list failed", error.message);
    return [];
  }
  const rows = (data ?? []) as unknown as MemoryRow[];
  return rows.filter((r) => (r.scope ?? "shared") === "shared" || r.bot === opts?.bot);
}

/** Запомнить факт. Повтор того же ключа обновляет значение и повышает вес. */
export async function rememberMemory(
  db: Db,
  input: { kind: MemoryKind; key: string; value: string; source?: string; bot?: BotId; scope?: "shared" | "private" },
): Promise<MemoryRow | null> {
  const key = input.key.trim().slice(0, 120);
  const value = input.value.trim().slice(0, 400);
  if (!key || !value) return null;

  const { data: found } = await db
    .from("assistant_memory")
    .select("*")
    .eq("kind", input.kind)
    .ilike("key", key)
    .maybeSingle();
  const existing = (found as unknown as MemoryRow) ?? null;

  if (existing) {
    const { data } = await db
      .from("assistant_memory")
      .update({
        value,
        weight: Math.min(existing.weight + 1, 20),
        active: true,
        source: input.source ?? existing.source,
        bot: input.bot ?? existing.bot ?? "shared",
        scope: input.scope ?? existing.scope ?? "shared",
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", existing.id)
      .select("*")
      .maybeSingle();
    return (data as unknown as MemoryRow) ?? existing;
  }

  const { data, error } = await db
    .from("assistant_memory")
    .insert({
      kind: input.kind,
      key,
      value,
      source: input.source ?? "user",
      bot: input.bot ?? "shared",
      scope: input.scope ?? "shared",
    } as never)
    .select("*")
    .maybeSingle();
  if (error) console.error("[botkit-memory] insert failed", error.message);
  await compactMemory(db);
  return (data as unknown as MemoryRow) ?? null;
}

export async function forgetMemory(db: Db, id: string): Promise<void> {
  await db.from("assistant_memory").delete().eq("id", id);
}

/** Забыть по смыслу (для команды «забудь про …») — сразу у обоих ботов. */
export async function forgetByQuery(db: Db, query: string): Promise<number> {
  const q = query.replace(/[%,()]/g, " ").trim();
  if (!q) return 0;
  const { data } = await db
    .from("assistant_memory")
    .select("id")
    .or(`key.ilike.%${q}%,value.ilike.%${q}%`);
  const ids = ((data ?? []) as Array<{ id: string }>).map((r) => r.id);
  if (!ids.length) return 0;
  await db.from("assistant_memory").delete().in("id", ids);
  return ids.length;
}

/** Держим память компактной: лишнее (самое старое и лёгкое) деактивируем. */
async function compactMemory(db: Db): Promise<void> {
  const rows = await listMemory(db);
  if (rows.length <= MAX_ACTIVE) return;
  const extra = rows
    .slice()
    .sort((a, b) => a.weight - b.weight || a.created_at.localeCompare(b.created_at))
    .slice(0, rows.length - MAX_ACTIVE)
    .map((r) => r.id);
  if (extra.length) await db.from("assistant_memory").update({ active: false } as never).in("id", extra);
}

/** Блок для системного промпта: что боты знают о пользователе. */
export function memoryPrompt(rows: MemoryRow[]): string {
  if (!rows.length) return "";
  const group = (kind: MemoryKind, title: string): string => {
    const list = rows.filter((r) => r.kind === kind);
    if (!list.length) return "";
    return `${title}:\n${list.map((r) => `- ${r.key}: ${r.value}`).join("\n")}`;
  };
  return [
    "Общая память ботов (используй её молча, не пересказывай):",
    group("rule", "Правила общения и работы"),
    group("alias", "Сокращения и имена"),
    group("habit", "Привычки"),
    group("fact", "Факты"),
  ]
    .filter(Boolean)
    .join("\n");
}

/** Готовый блок памяти для промпта конкретного бота. */
export async function sharedMemoryPrompt(db: Db, bot: BotId): Promise<string> {
  return memoryPrompt(await listMemory(db, { bot }));
}
