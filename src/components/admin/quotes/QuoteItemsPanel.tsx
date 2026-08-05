// Панель состава КП: группировка по разделам, компактные строки,
// себестоимость/маржа, перемещение, дублирование и вставка из Excel.
import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp, ClipboardPaste, Copy, MoreHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fmtMoney } from "@/lib/formatters";
import { num, parsePastedQuoteRows, QUOTE_SECTION_SUGGESTIONS, type QuoteItem } from "@/lib/quotes-model";

function Mini({ label, width, children }: { label: string; width: string; children: ReactNode }) {
  return (
    <div className={`${width} space-y-0.5`}>
      <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

export function QuoteItemsPanel({
  items,
  onChange,
  showCost,
  toolbar,
}: {
  items: QuoteItem[];
  onChange: (next: QuoteItem[]) => void;
  showCost: boolean;
  toolbar?: ReactNode;
}) {
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const groups = useMemo(() => {
    const map = new Map<string, QuoteItem[]>();
    for (const it of items) {
      const key = it.section?.trim() || "Без раздела";
      const arr = map.get(key) ?? [];
      arr.push(it);
      map.set(key, arr);
    }
    return [...map.entries()];
  }, [items]);

  const replace = (id: string, patch: Partial<QuoteItem>) =>
    onChange(items.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  const remove = (id: string) => onChange(items.filter((it) => it.id !== id));

  const duplicate = (id: string) => {
    const idx = items.findIndex((it) => it.id === id);
    if (idx < 0) return;
    const src = items[idx]!;
    const copy: QuoteItem = { ...src, id: globalThis.crypto?.randomUUID?.() ?? `tmp-${Math.random()}` };
    const next = [...items];
    next.splice(idx + 1, 0, copy);
    onChange(next.map((it, i) => ({ ...it, sort_order: i })));
  };

  const move = (id: string, dir: -1 | 1) => {
    const idx = items.findIndex((it) => it.id === id);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= items.length) return;
    const next = [...items];
    const tmp = next[idx]!;
    next[idx] = next[target]!;
    next[target] = tmp;
    onChange(next.map((it, i) => ({ ...it, sort_order: i })));
  };

  const applyPaste = () => {
    const parsed = parsePastedQuoteRows(pasteText);
    if (!parsed.length) return;
    const base = items.length;
    const created: QuoteItem[] = parsed.map((r, i) => ({
      id: globalThis.crypto?.randomUUID?.() ?? `tmp-${Math.random()}-${i}`,
      quote_id: items[0]?.quote_id ?? "",
      section: "",
      title: r.title,
      description: "",
      qty: r.qty,
      unit: r.unit,
      price: r.price,
      cost: r.cost,
      sort_order: base + i,
      entity_type: null,
      entity_id: null,
    }));
    onChange([...items, ...created]);
    setPasteText("");
    setPasteOpen(false);
  };

  const lineTotal = (it: QuoteItem) => num(it.qty) * num(it.price);
  const lineCost = (it: QuoteItem) => num(it.qty) * num(it.cost);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {toolbar}
        <Button variant="outline" size="sm" onClick={() => setPasteOpen(true)}>
          <ClipboardPaste className="mr-1.5 h-4 w-4" />Вставить из Excel
        </Button>
      </div>

      {groups.map(([section, list]) => {
        const sum = list.reduce((s, it) => s + lineTotal(it), 0);
        return (
          <div key={section} className="rounded-xl border border-border/60">
            <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
              <span className="text-sm font-medium">{section}</span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {list.length} поз. · {fmtMoney(sum)}
              </span>
            </div>
            <div className="divide-y divide-border/50">
              {list.map((it) => (
                <div key={it.id} className="px-2 py-2">
                  <div className="flex items-center gap-1">
                    <div className="flex flex-col text-muted-foreground">
                      <button type="button" className="hover:text-foreground" onClick={() => move(it.id, -1)} aria-label="Выше">
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" className="hover:text-foreground" onClick={() => move(it.id, 1)} aria-label="Ниже">
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <Input
                      value={it.title}
                      onChange={(e) => replace(it.id, { title: e.target.value })}
                      placeholder="Наименование позиции"
                      className="h-9 flex-1"
                    />
                    <div className="flex w-[120px] flex-col items-end">
                      <span className="text-sm tabular-nums">{fmtMoney(lineTotal(it))}</span>
                      {showCost && lineCost(it) > 0 && (
                        <span className="text-[11px] tabular-nums text-muted-foreground">
                          маржа {fmtMoney(lineTotal(it) - lineCost(it))}
                        </span>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-9 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setExpanded((p) => ({ ...p, [it.id]: !p[it.id] }))}>
                          {expanded[it.id] ? "Скрыть описание" : "Описание и раздел"}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => duplicate(it.id)}>
                          <Copy className="mr-2 h-4 w-4" />Дублировать
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => remove(it.id)}>
                          <Trash2 className="mr-2 h-4 w-4" />Удалить
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="ml-6 mt-1 flex flex-wrap items-end gap-2">
                    <Mini label="Кол-во" width="w-[76px]">
                      <Input type="number" min={0} value={it.qty} className="h-8"
                        onChange={(e) => replace(it.id, { qty: num(e.target.value) })} />
                    </Mini>
                    <Mini label="Ед. изм." width="w-[92px]">
                      <Input value={it.unit} className="h-8" onChange={(e) => replace(it.id, { unit: e.target.value })} />
                    </Mini>
                    <Mini label="Цена" width="w-[110px]">
                      <Input type="number" min={0} step="0.01" value={it.price} className="h-8"
                        onChange={(e) => replace(it.id, { price: num(e.target.value) })} />
                    </Mini>
                    {showCost && (
                      <Mini label="Себест." width="w-[110px]">
                        <Input type="number" min={0} step="0.01" value={it.cost} className="h-8"
                          onChange={(e) => replace(it.id, { cost: num(e.target.value) })} />
                      </Mini>
                    )}
                  </div>

                  {expanded[it.id] && (
                    <div className="ml-6 mt-2 space-y-2">
                      <Mini label="Раздел" width="w-full">
                        <Input
                          list="quote-sections"
                          value={it.section}
                          className="h-8"
                          placeholder="Например: Оборудование"
                          onChange={(e) => replace(it.id, { section: e.target.value })}
                        />
                      </Mini>
                      <Textarea
                        rows={2}
                        placeholder="Описание позиции (попадёт в документ)"
                        value={it.description}
                        onChange={(e) => replace(it.id, { description: e.target.value })}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {!items.length && <p className="py-3 text-sm text-muted-foreground">Позиции не добавлены</p>}

      <datalist id="quote-sections">
        {QUOTE_SECTION_SUGGESTIONS.map((s) => <option key={s} value={s} />)}
      </datalist>

      <Dialog open={pasteOpen} onOpenChange={setPasteOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Вставить позиции из Excel</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">
            Колонки: наименование, кол-во, ед. изм., цена, себестоимость (необязательно). Одна строка — одна позиция.
          </p>
          <Textarea rows={10} value={pasteText} onChange={(e) => setPasteText(e.target.value)}
            placeholder={"Фотозона\t1\tшт.\t900\t400"} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasteOpen(false)}>Отмена</Button>
            <Button onClick={applyPaste}>Добавить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
