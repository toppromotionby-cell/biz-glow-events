// Короткая память диалога: последние реплики чата и запись «в фокусе».
// Благодаря ей работают цепочки «запиши встречу» → «на когда?» → «завтра в 15».
type Db = Awaited<ReturnType<typeof import("@/lib/calendar/store.server").admin>>;

export interface DialogTurn {
  role: "user" | "assistant";
  content: string;
  focus_item_id: string | null;
  created_at: string;
}

const WINDOW_MS = 40 * 60_000;
const MAX_TURNS = 16;

export async function loadDialog(db: Db, chatKey: string): Promise<DialogTurn[]> {
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const { data } = await db
    .from("assistant_dialog")
    .select("role, content, focus_item_id, created_at")
    .eq("chat_key", chatKey)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(MAX_TURNS);
  return ((data ?? []) as unknown as DialogTurn[]).reverse();
}

export async function appendDialog(
  db: Db,
  entry: { chatKey: string; channel?: string; role: "user" | "assistant"; content: string; focusItemId?: string | null },
): Promise<void> {
  const content = entry.content.trim().slice(0, 2000);
  if (!content) return;
  const { error } = await db.from("assistant_dialog").insert({
    chat_key: entry.chatKey,
    channel: entry.channel ?? "telegram",
    role: entry.role,
    content,
    focus_item_id: entry.focusItemId ?? null,
  });
  if (error) console.error("[planner] dialog insert failed", error.message);
}

/** Последняя запись, о которой шла речь, — для «перенеси её», «сделай жёсткой». */
export function focusFromDialog(turns: DialogTurn[]): string | null {
  for (let i = turns.length - 1; i >= 0; i -= 1) {
    const id = turns[i]?.focus_item_id;
    if (id) return id;
  }
  return null;
}

/** Чистка старых реплик (вызывается кроном планера). */
export async function pruneDialog(db: Db): Promise<void> {
  const cutoff = new Date(Date.now() - 7 * 86_400_000).toISOString();
  await db.from("assistant_dialog").delete().lt("created_at", cutoff);
}
