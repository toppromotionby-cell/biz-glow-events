// Единое состояние сохранения для всех редакторов (КП, промо-КП, презентации).
// Чистый модуль: одинаковые подписи статуса и одна задержка автосохранения.

/** Задержка автосохранения после последней правки, мс. */
export const AUTOSAVE_DELAY = 1200;

export type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

export interface SaveStatus {
  text: string;
  tone: "muted" | "pending" | "ok" | "error";
}

function time(at: Date | null): string {
  if (!at) return "";
  return at.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

/** Человеческая подпись статуса — одинаковая во всех редакторах. */
export function saveStatus(state: SaveState, savedAt: Date | null, error?: string | null): SaveStatus {
  if (state === "error") return { text: error ? `Не сохранено: ${error}` : "Не сохранено", tone: "error" };
  if (state === "saving") return { text: "Сохраняем…", tone: "pending" };
  if (state === "dirty") return { text: "Есть несохранённые правки", tone: "pending" };
  if (savedAt) return { text: `Сохранено в ${time(savedAt)}`, tone: "ok" };
  return { text: "Все правки сохраняются автоматически", tone: "muted" };
}

/** Нужно ли предупреждать о потере правок при уходе со страницы. */
export function shouldWarnOnLeave(state: SaveState): boolean {
  return state === "dirty" || state === "saving" || state === "error";
}
