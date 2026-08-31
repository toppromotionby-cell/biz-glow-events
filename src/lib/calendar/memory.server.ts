// Память планера — это общая память ботов (botkit). Модуль оставлен как совместимый фасад:
// всё, чему учат планер, сразу знает бот админки, и наоборот.
import {
  forgetByQuery as sharedForgetByQuery,
  forgetMemory as sharedForget,
  listMemory as sharedList,
  memoryPrompt,
  rememberMemory as sharedRemember,
  MEMORY_KIND_LABEL,
  type MemoryKind,
  type MemoryRow,
} from "@/lib/botkit/memory.server";

type Db = Awaited<ReturnType<typeof import("@/lib/calendar/store.server").admin>>;

export { memoryPrompt, MEMORY_KIND_LABEL };
export type { MemoryKind, MemoryRow };

export async function listMemory(db: Db, includeInactive = false): Promise<MemoryRow[]> {
  return sharedList(db, { bot: "planner", includeInactive });
}

/** Запомнить факт от планера — запись общая для всех ботов. */
export async function rememberMemory(
  db: Db,
  input: { kind: MemoryKind; key: string; value: string; source?: string },
): Promise<MemoryRow | null> {
  return sharedRemember(db, { ...input, bot: "planner" });
}

export async function forgetMemory(db: Db, id: string): Promise<void> {
  return sharedForget(db, id);
}

export async function forgetByQuery(db: Db, query: string): Promise<number> {
  return sharedForgetByQuery(db, query);
}
