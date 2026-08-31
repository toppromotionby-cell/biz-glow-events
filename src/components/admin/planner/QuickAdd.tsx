// Быстрый ввод обычной фразой — как в Todoist/Sunsama.
// «завтра в 15 встреча с подрядчиком по EventHub» → запись с датой и направлением.
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { plannerQuickAdd } from "@/lib/calendar.functions";

const HINTS = [
  "завтра в 15 встреча с подрядчиком по EventHub",
  "до пятницы смета для Belight",
  "каждый понедельник планёрка в 10",
];

export function QuickAdd({ onCreated }: { onCreated: () => void }) {
  const add = useServerFn(plannerQuickAdd);
  const [text, setText] = useState("");

  const mut = useMutation({
    mutationFn: (value: string) => add({ data: { text: value } }),
    onSuccess: (res) => {
      setText("");
      toast.success(res.item ? `Записал: ${res.item.title}` : "Готово", {
        description: res.question ?? undefined,
      });
      onCreated();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submit = () => {
    const value = text.trim();
    if (value.length < 2) return;
    mut.mutate(value);
  };

  return (
    <div className="rounded-xl border bg-card p-3 shadow-sm">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 shrink-0 text-primary" />
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="Напишите обычной фразой — ассистент сам разберёт дату, тип и направление"
          className="border-0 bg-transparent shadow-none focus-visible:ring-0"
          aria-label="Быстрый ввод записи"
        />
        <Button onClick={submit} disabled={mut.isPending || text.trim().length < 2}>
          {mut.isPending ? <Loader2 className="size-4 animate-spin" /> : "Добавить"}
        </Button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5 pl-6">
        {HINTS.map((h) => (
          <button
            key={h}
            type="button"
            onClick={() => setText(h)}
            className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted"
          >
            {h}
          </button>
        ))}
      </div>
    </div>
  );
}
