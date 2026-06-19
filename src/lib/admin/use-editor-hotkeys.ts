// Хоткеи редактора: Cmd/Ctrl+S — сохранить, Esc — закрыть.
import { useEffect } from "react";

export function useEditorHotkeys(opts: { onSave?: () => void; onEscape?: () => void; enabled?: boolean }) {
  const { onSave, onEscape, enabled = true } = opts;
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        onSave?.();
        return;
      }
      if (e.key === "Escape") {
        onEscape?.();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled, onSave, onEscape]);
}
