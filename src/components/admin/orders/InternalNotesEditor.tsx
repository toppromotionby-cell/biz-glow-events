// Внутренние заметки с автосохранением (debounce). Виден индикатор статуса.
import { useEffect, useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useDebouncedCallback } from "@/hooks/use-debounced-callback";

type SaveState = "idle" | "saving" | "saved" | "error";

export function InternalNotesEditor({ orderId, initial }: { orderId: string; initial: string }) {
  const [value, setValue] = useState(initial);
  const [state, setState] = useState<SaveState>("idle");
  const lastSaved = useRef(initial);

  useEffect(() => {
    setValue(initial);
    lastSaved.current = initial;
    setState("idle");
  }, [orderId, initial]);

  const persist = useDebouncedCallback(async (next: string) => {
    if (next === lastSaved.current) return;
    setState("saving");
    const { error } = await supabase.from("orders").update({ internal_notes: next }).eq("id", orderId);
    if (error) { setState("error"); return; }
    lastSaved.current = next;
    setState("saved");
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
