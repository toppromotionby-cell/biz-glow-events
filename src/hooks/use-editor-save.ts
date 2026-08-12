// Общий хук автосохранения редакторов: дебаунс, статус, Ctrl+S и защита от ухода.
import { useCallback, useEffect, useRef, useState } from "react";
import { AUTOSAVE_DELAY, shouldWarnOnLeave, type SaveState } from "@/lib/editor/save-state";

export interface EditorSave {
  state: SaveState;
  savedAt: Date | null;
  error: string | null;
  /** Отметить правку: запускает отложенное сохранение. */
  markDirty: () => void;
  /** Сохранить немедленно (кнопка или Ctrl+S). */
  saveNow: () => void;
  /** Сбросить состояние после загрузки данных с сервера. */
  reset: () => void;
}

/**
 * @param save    функция сохранения текущего состояния (замыкает актуальные данные)
 * @param enabled сохранять ли (например, документ ещё не загружен)
 */
export function useEditorSave(save: () => Promise<unknown>, enabled = true): EditorSave {
  const [state, setState] = useState<SaveState>("idle");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveRef = useRef(save);
  saveRef.current = save;
  const running = useRef(false);
  const stateRef = useRef<SaveState>(state);
  stateRef.current = state;

  const run = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setState("saving");
    try {
      await saveRef.current();
      setSavedAt(new Date());
      setError(null);
      setState("saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setState("error");
    } finally {
      running.current = false;
    }
  }, []);

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const markDirty = useCallback(() => {
    if (!enabled) return;
    setState("dirty");
    clear();
    timer.current = setTimeout(run, AUTOSAVE_DELAY);
  }, [enabled, run]);

  const saveNow = useCallback(() => {
    clear();
    void run();
  }, [run]);

  const reset = useCallback(() => {
    clear();
    setState("idle");
    setError(null);
  }, []);

  useEffect(() => clear, []);

  // Ctrl/Cmd+S — сохранить сразу.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s")) return;
      e.preventDefault();
      if (stateRef.current !== "saving") saveNow();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saveNow]);

  // Защита от потери правок при закрытии вкладки.
  useEffect(() => {
    const onLeave = (e: BeforeUnloadEvent) => {
      if (!shouldWarnOnLeave(stateRef.current)) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, []);

  return { state, savedAt, error, markDirty, saveNow, reset };
}
