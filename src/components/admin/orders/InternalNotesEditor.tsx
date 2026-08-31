// Внутренние заметки с автосохранением (debounce). Виден индикатор статуса.
import { useEffect, useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { fetchInternalNotes, saveInternalNotes } from "@/lib/orders/internal-notes";
import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import { notify } from "@/lib/notify";

type SaveState = "idle" | "saving" | "saved" | "error";

export function InternalNotesEditor({ orderId }: { orderId: string }) {
  const [value, setValue] = useState("");
  const [state, setState] = useState<SaveState>("idle");
  const lastSaved = useRef("");

  useEffect(() => {
    let alive = true;
    setState("idle");
    fetchInternalNotes(orderId)
      .then((notes) => {
        if (!alive) return;
        setValue(notes);
        lastSaved.current = notes;
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [orderId]);

  const persist = useDebouncedCallback(async (next: string) => {
    if (next === lastSaved.current) return;
    setState("saving");
    try {
      await saveInternalNotes(orderId, next);
    } catch (e) {
      setState("error");
      notify.error("Не удалось сохранить заметку", { description: e instanceof Error ? e.message : undefined });
      return;
    }
    lastSaved.current = next;
    setState("saved");
    notify.autosaved();
    setTimeout(() => setState((s) => (s === "saved" ? "idle" : s)), 1500);
  }, 800);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Видны только команде — клиенту не отправляются.</p>
        <StateIndicator state={state} />
      </div>
      <textarea
        value={value}
        onChange={(e) => { setValue(e.target.value); persist(e.target.value); }}
        rows={3}
        placeholder="Договорённости, риски, контакты подрядчиков…"
        className="w-full bg-input/40 border border-border/60 rounded-md p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 resize-y"
      />
    </div>
  );
}

function StateIndicator({ state }: { state: SaveState }) {
  if (state === "saving") return <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />Сохраняется…</span>;
  if (state === "saved") return <span className="inline-flex items-center gap-1 text-xs text-emerald-300"><Check className="h-3 w-3" />Сохранено</span>;
  if (state === "error") return <span className="text-xs text-rose-300">Ошибка сохранения</span>;
  return <span className="text-xs text-muted-foreground/50">Автосохранение</span>;
}
