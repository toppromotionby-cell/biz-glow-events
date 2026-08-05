// Таблица позиций промо-КП: секции, drag-n-drop, подытоги, быстрые действия.
import { useMemo, useState } from "react";
import { Copy, Plus, Trash2, MoreHorizontal, ChevronDown, ChevronRight, Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SortableList } from "@/components/admin/SortableList";
import {
  formatMoney, lineCost, lineQty, lineTotal, newPromoItem, PROMO_SECTION_SUGGESTIONS,
  type PromoItem,
} from "@/lib/promo-quote-model";

type Props = {
  items: PromoItem[];
  currency: string;
  showCost: boolean;
  showNotes: boolean;
  onChange: (next: PromoItem[]) => void;
  onSaveSectionAsSnippet?: (section: string, items: PromoItem[]) => void;
};

export function PromoItemsTable({ items, currency, showCost, showNotes, onChange, onSaveSectionAsSnippet }: Props) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const sections = useMemo(() => {
    const map = new Map<string, PromoItem[]>();
    for (const it of items) {
      const key = it.section.trim();
      const arr = map.get(key);
      if (arr) arr.push(it);
      else map.set(key, [it]);
    }
    return [...map.entries()].map(([name, list]) => ({ name, list }));
  }, [items]);

  const replace = (id: string, patch: Partial<PromoItem>) =>
    onChange(items.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  const removeItem = (id: string) => onChange(items.filter((it) => it.id !== id));

  const duplicate = (id: string) => {
    const idx = items.findIndex((it) => it.id === id);
    if (idx < 0) return;
    const copy = { ...items[idx], id: crypto.randomUUID() };
    onChange([...items.slice(0, idx + 1), copy, ...items.slice(idx + 1)]);
  };

  const addRow = (section: string) => onChange([...items, newPromoItem(section)]);

  const renameSection = (from: string, to: string) =>
    onChange(items.map((it) => (it.section.trim() === from ? { ...it, section: to } : it)));

  const removeSection = (name: string) => onChange(items.filter((it) => it.section.trim() !== name));

  const reorderSection = (name: string, orderedIds: string[]) => {
    const inSection = new Map(items.filter((it) => it.section.trim() === name).map((it) => [it.id, it]));
    const ordered = orderedIds.map((id) => inSection.get(id)).filter(Boolean) as PromoItem[];
    let cursor = 0;
    onChange(items.map((it) => (it.section.trim() === name ? ordered[cursor++] ?? it : it)));
  };

  return (
    <div className="space-y-3">
      {sections.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Пока нет позиций. Добавьте первую строку или вставьте таблицу из Excel.
        </div>
      )}

      {sections.map(({ name, list }) => {
        const sum = list.reduce((s, it) => s + lineTotal(it), 0);
        const isCollapsed = collapsed[name];
        return (
          <div key={name || "__none"} className="rounded-xl border border-border">
            <div className="flex items-center gap-2 border-b border-border/60 bg-muted/30 p-2">
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => setCollapsed((c) => ({ ...c, [name]: !c[name] }))}
                aria-label={isCollapsed ? "Развернуть раздел" : "Свернуть раздел"}
              >
                {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
              <Input
                value={name}
                onChange={(e) => renameSection(name, e.target.value)}
                placeholder="Название раздела"
                list="promo-section-suggestions"
                className="h-8 max-w-[280px] border-transparent bg-transparent font-medium focus-visible:border-input"
              />
              <span className="ml-auto text-xs text-muted-foreground">{list.length} поз.</span>
              <span className="w-[130px] text-right text-sm font-medium tabular-nums">
                {formatMoney(sum, currency)}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => addRow(name)}>
                    <Plus className="mr-2 h-4 w-4" />Добавить строку
                  </DropdownMenuItem>
                  {onSaveSectionAsSnippet && (
                    <DropdownMenuItem onClick={() => onSaveSectionAsSnippet(name, list)}>
                      <Bookmark className="mr-2 h-4 w-4" />Сохранить как блок
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive" onClick={() => removeSection(name)}>
                    <Trash2 className="mr-2 h-4 w-4" />Удалить раздел
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {!isCollapsed && (
              <div className="p-2">
                <div className="px-7 pb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                  Позиции раздела
                </div>

                <SortableList
                  items={list}
                  onReorder={(ids) => reorderSection(name, ids)}
                  className="space-y-1"
                  renderItem={(it, handle) => (
                    <div className="rounded-lg border border-transparent px-1 py-1 hover:border-border/60 hover:bg-muted/30">
                      <div className="flex items-center gap-1">
                        <div>{handle}</div>
                        <Input
                          value={it.title}
                          onChange={(e) => replace(it.id, { title: e.target.value })}
                          placeholder="Наименование позиции"
                          className="h-9 flex-1"
                        />
                        <div className="flex w-[120px] flex-col items-end">
                          <span className="text-sm tabular-nums">{formatMoney(lineTotal(it), currency)}</span>
                          {showCost && lineCost(it) > 0 && (
                            <span className="text-[11px] tabular-nums text-muted-foreground">
                              маржа {formatMoney(lineTotal(it) - lineCost(it), currency)}
                            </span>
                          )}
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-9 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => duplicate(it.id)}>
                              <Copy className="mr-2 h-4 w-4" />Дублировать
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onClick={() => removeItem(it.id)}>
                              <Trash2 className="mr-2 h-4 w-4" />Удалить
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      <div className="ml-7 mt-1 flex flex-wrap items-end gap-2">
                        <Mini label="Ед. изм." width="w-[96px]">
                          <Input value={it.unit} onChange={(e) => replace(it.id, { unit: e.target.value })} className="h-8" />
                        </Mini>
                        <Mini label="Кол-во" width="w-[72px]">
                          <Input type="number" min={0} value={it.qty} onChange={(e) => replace(it.id, { qty: Number(e.target.value) })} className="h-8" />
                        </Mini>
                        <Mini label="×" width="w-[64px]">
                          <Input type="number" min={0} value={it.multiplier} onChange={(e) => replace(it.id, { multiplier: Number(e.target.value) })} className="h-8" />
                        </Mini>
                        <Mini label="Цена" width="w-[100px]">
                          <Input type="number" min={0} step="0.01" value={it.price} onChange={(e) => replace(it.id, { price: Number(e.target.value) })} className="h-8" />
                        </Mini>
                        {showCost && (
                          <Mini label="Себест." width="w-[100px]">
                            <Input type="number" min={0} step="0.01" value={it.cost} onChange={(e) => replace(it.id, { cost: Number(e.target.value) })} className="h-8" />
                          </Mini>
                        )}
                        <span className="pb-2 text-[11px] text-muted-foreground">всего: {lineQty(it)}</span>
                      </div>

                      <div className="ml-7 mt-1 flex flex-wrap items-center gap-3">
                        {showNotes && (
                          <Textarea
                            value={it.note}
                            onChange={(e) => replace(it.id, { note: e.target.value })}
                            placeholder="Примечание"
                            className="min-h-[34px] flex-1 text-xs"
                          />
                        )}
                        <Label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <Switch
                            checked={it.exclude_from_commission}
                            onCheckedChange={(v) => replace(it.id, { exclude_from_commission: v })}
                          />
                          Без комиссии
                        </Label>
                      </div>

                    </div>
                  )}
                />
                <Button variant="ghost" size="sm" className="mt-1" onClick={() => addRow(name)}>
                  <Plus className="mr-1 h-4 w-4" />Строка в раздел
                </Button>
              </div>
            )}
          </div>
        );
      })}

      <datalist id="promo-section-suggestions">
        {PROMO_SECTION_SUGGESTIONS.map((s) => <option key={s} value={s} />)}
      </datalist>
    </div>
  );
}

function Mini({ label, width, children }: { label: string; width: string; children: React.ReactNode }) {
  return (
    <div className={width}>
      <div className="pb-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

