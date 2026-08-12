// Универсальная история изменений редактора (undo/redo).
// Чистый модуль без React: хранит снимки состояния и умеет откатывать шаги.
export type History<T> = {
  past: T[];
  present: T;
  future: T[];
};

/** Максимум шагов отмены — дальше самые старые снимки выбрасываются. */
export const HISTORY_LIMIT = 60;

export function createHistory<T>(present: T): History<T> {
  return { past: [], present, future: [] };
}

/** Новый шаг: текущее состояние уходит в прошлое, будущее сбрасывается. */
export function pushHistory<T>(h: History<T>, next: T): History<T> {
  if (Object.is(next, h.present)) return h;
  const past = [...h.past, h.present].slice(-HISTORY_LIMIT);
  return { past, present: next, future: [] };
}

/** Замена состояния без новой точки отмены (например, ответ сервера). */
export function replaceHistory<T>(h: History<T>, next: T): History<T> {
  return { ...h, present: next };
}

export function canUndo<T>(h: History<T>): boolean {
  return h.past.length > 0;
}

export function canRedo<T>(h: History<T>): boolean {
  return h.future.length > 0;
}

export function undoHistory<T>(h: History<T>): History<T> {
  if (!h.past.length) return h;
  const prev = h.past[h.past.length - 1];
  return {
    past: h.past.slice(0, -1),
    present: prev,
    future: [h.present, ...h.future].slice(0, HISTORY_LIMIT),
  };
}

export function redoHistory<T>(h: History<T>): History<T> {
  if (!h.future.length) return h;
  const [next, ...rest] = h.future;
  return {
    past: [...h.past, h.present].slice(-HISTORY_LIMIT),
    present: next,
    future: rest,
  };
}
