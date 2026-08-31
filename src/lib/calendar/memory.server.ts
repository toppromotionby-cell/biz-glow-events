// Обучаемость ассистента: словарь сокращений, привычки и правила пользователя.
// Всё, что здесь копится, подмешивается в системный промпт «мозга».
type Db = Awaited<ReturnType<typeof import("@/lib/calendar/store.server").admin>>;

export type MemoryKind = "alias" | "habit" | "rule" | "fact";

export interface MemoryRow {
  id: string;
  kind: MemoryKind;
  key: string;
  value: string;
  source: string;
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

const MAX_ACTIVE = 60;

export async function listMemory(db: Db, includeInactive = false): Promise<MemoryRow[]> {
  let q = db.from("assistant_memory").select("*").order("weight", { ascending: false }).order("created_at", { ascending: false });
  if (!includeInactive) q = q.eq("active", true);
  const { data } = await q;
  return (data ?? []) as unknown as MemoryRow[];
}

/** Запомнить факт. Повтор того же ключа обновляет значение и повышает вес. */
export async function rememberMemory(
  db: Db,
  input: { kind: MemoryKind; key: string; value: string; source?: string },
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
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select("*")
      .maybeSingle();
    return (data as unknown as MemoryRow) ?? existing;
  }

  const { data } = await db
    .from("assistant_memory")
    .insert({ kind: input.kind, key, value, source: input.source ?? "user" })
    .select("*")
    .maybeSingle();
  await compactMemory(db);
  return (data as unknown as MemoryRow) ?? null;
}

export async function forgetMemory(db: Db, id: string): Promise<void> {
  await db.from("assistant_memory").delete().eq("id", id);
}

/** Забыть по смыслу (для команды «забудь про …»). */
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
  if (extra.length) await db.from("assistant_memory").update({ active: false }).in("id", extra);
}

/** Блок для системного промпта: что бот знает о пользователе. */
export function memoryPrompt(rows: MemoryRow[]): string {
  if (!rows.length) return "";
  const group = (kind: MemoryKind, title: string): string => {
    const list = rows.filter((r) => r.kind === kind);
    if (!list.length) return "";
    return `${title}:\n${list.map((r) => `- ${r.key}: ${r.value}`).join("\n")}`;
  };
  return [
    "Что я знаю о пользователе (используй это молча, не пересказывай):",
    group("rule", "Правила общения и работы"),
    group("alias", "Сокращения и имена"),
    group("habit", "Привычки"),
    group("fact", "Факты"),
  ]
    .filter(Boolean)
    .join("\n");
}
