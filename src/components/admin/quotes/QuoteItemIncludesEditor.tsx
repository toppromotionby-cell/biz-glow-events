// Диалог редактирования состава позиции («что входит»).
import { useState } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { normalizeIncludes, type QuoteItemInclude } from "@/lib/quotes-model";

export function QuoteItemIncludesEditor({
  open,
  onOpenChange,
  title,
  value,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  value: QuoteItemInclude[];
  onSave: (next: QuoteItemInclude[]) => void;
}) {
  const [rows, setRows] = useState<QuoteItemInclude[]>(value.length ? value : [{ text: "", note: "" }]);
  const [bulk, setBulk] = useState("");

  const update = (i: number, patch: Partial<QuoteItemInclude>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    const tmp = next[i]!;
    next[i] = next[j]!;
    next[j] = tmp;
    setRows(next);
  };

  const applyBulk = () => {
    const parsed = bulk
      .split(/\r?\n/)
      .map((l) => l.replace(/^[-•*]\s*/, "").trim())
      .filter(Boolean)
      .map((text) => ({ text, note: "" }));
    if (!parsed.length) return;
    setRows((prev) => [...prev.filter((r) => r.text.trim()), ...parsed]);
    setBulk("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Состав позиции{title ? `: ${title}` : ""}</DialogTitle>
        </DialogHeader>

        <div className="space-y-1.5 max-h-[45vh] overflow-y-auto pr-1">
          {rows.map((r, i) => (
            <div key={i} className="flex items-center gap-1">
              <div className="flex flex-col text-muted-foreground">
                <button type="button" className="hover:text-foreground" onClick={() => move(i, -1)} aria-label="Выше">
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button type="button" className="hover:text-foreground" onClick={() => move(i, 1)} aria-label="Ниже">
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>
              <Input
                className="h-9 flex-1"
                placeholder="Что входит (например: доставка и монтаж)"
                value={r.text}
                onChange={(e) => update(i, { text: e.target.value })}
              />
              <Input
                className="h-9 w-[130px]"
                placeholder="Примечание"
                value={r.note}
                onChange={(e) => update(i, { note: e.target.value })}
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-9 w-8"
                aria-label="Удалить пункт"
                onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {!rows.length && <p className="text-sm text-muted-foreground">Пунктов пока нет</p>}
        </div>

        <Button variant="outline" size="sm" className="self-start" onClick={() => setRows((p) => [...p, { text: "", note: "" }])}>
          <Plus className="mr-1.5 h-4 w-4" />Пункт
        </Button>

        <div className="space-y-1.5 rounded-lg border border-border/60 p-2">
          <p className="text-xs text-muted-foreground">Быстрая вставка: по одному пункту в строке</p>
          <Textarea rows={3} value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder={"Доставка\nМонтаж и демонтаж\nОператор, 4 часа"} />
          <Button variant="outline" size="sm" onClick={applyBulk}>Добавить списком</Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button
            onClick={() => {
              onSave(normalizeIncludes(rows));
              onOpenChange(false);
            }}
          >
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
