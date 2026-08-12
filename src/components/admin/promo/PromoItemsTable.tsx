// Таблица позиций промо-КП: секции, drag-n-drop, подытоги, быстрые действия.
import { useMemo, useState } from "react";
import {
  Copy, Plus, Trash2, MoreHorizontal, ChevronDown, ChevronRight, ChevronUp, Bookmark, ListChecks, FolderInput,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
  DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SortableList } from "@/components/admin/SortableList";
import { NumField, TextAreaField, TextCommitField } from "@/components/admin/field-kit";
import { SuggestInput } from "@/components/admin/SuggestInput";
import { useDocSuggest, type ItemHit } from "@/hooks/use-doc-suggest";
import { QuoteItemIncludesEditor } from "@/components/admin/quotes/QuoteItemIncludesEditor";
import {
  duplicatePromoSection, formatMoney, insertPromoItems, isCounted, lineCost, lineQty, lineTotal, listPromoSections,
  movePromoItemToSection, movePromoSection, newPromoItem, reindexPromo, removePromoSection, renamePromoSection,
  PROMO_NO_SECTION, PROMO_SECTION_SUGGESTIONS, type PromoItem,
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
  const { fetchItems } = useDocSuggest();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [includesFor, setIncludesFor] = useState<PromoItem | null>(null);
  const [deleteSection, setDeleteSection] = useState<string | null>(null);

  const sectionNames = useMemo(() => listPromoSections(items), [items]);
  const sections = useMemo(
    () =>
      sectionNames.map((name) => ({
        name,
        list: [...items]
          .sort((a, b) => a.sort_order - b.sort_order)
          .filter((it) => (it.section ?? "").trim() === name),
      })),
    [items, sectionNames],
  );

  const replace = (id: string, patch: Partial<PromoItem>) =>
    onChange(items.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  /** Переключение «в итог»: если у позиции есть связка — переключаются все её строки. */
  const setIncluded = (item: PromoItem, value: boolean) => {
    const key = (item.group_key ?? "").trim();
    onChange(
      items.map((it) =>
        (key ? (it.group_key ?? "").trim() === key : it.id === item.id) ? { ...it, included: value } : it,
      ),
    );
  };

  const removeItem = (id: string) => onChange(reindexPromo(items.filter((it) => it.id !== id)));


  const duplicate = (id: string) => {
    const idx = items.findIndex((it) => it.id === id);
    if (idx < 0) return;
    const src = items[idx]!;
    const copy = { ...src, id: crypto.randomUUID(), includes: src.includes.map((x) => ({ ...x })) };
    onChange(reindexPromo([...items.slice(0, idx + 1), copy, ...items.slice(idx + 1)]));
  };

  const addRow = (section: string) =>
    onChange(insertPromoItems(items, section, [newPromoItem(section)]));

  const addSection = () => {
    const base = "Новый раздел";
    let name = base;
    let n = 2;
    while (sectionNames.includes(name)) name = `${base} ${n++}`;
    setCollapsed((c) => ({ ...c, [name]: false }));
    onChange(reindexPromo([...items, newPromoItem(name)]));
  };


  const reorderSection = (name: string, orderedIds: string[]) => {
    const inSection = new Map(items.filter((it) => (it.section ?? "").trim() === name).map((it) => [it.id, it]));
    const ordered = orderedIds.map((id) => inSection.get(id)).filter(Boolean) as PromoItem[];
    let cursor = 0;
    onChange(items.map((it) => ((it.section ?? "").trim() === name ? ordered[cursor++] ?? it : it)));
  };

  return (
    <div className="space-y-3">
      {sections.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Пока нет позиций. Добавьте первую строку — подсказки подставятся из базы знаний.
        </div>
      )}

      {sections.map(({ name, list }, secIdx) => {
        const sum = list.filter(isCounted).reduce((s, it) => s + lineTotal(it), 0);
        const isCollapsed = collapsed[name];
        return (
          <div key={`sec-${secIdx}`} className="overflow-hidden rounded-xl border border-primary/25">
            <div className="flex items-center gap-2 border-b border-primary/20 border-l-2 border-l-primary bg-primary/5 p-2">
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => setCollapsed((c) => ({ ...c, [name]: !c[name] }))}
                aria-label={isCollapsed ? "Развернуть раздел" : "Свернуть раздел"}
              >
                {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
              <TextCommitField
                value={name}
                onCommit={(v) => onChange(renamePromoSection(items, name, v))}
                placeholder="Название раздела"
                aria-label="Название раздела"
                className="h-8 max-w-[280px] border-transparent bg-transparent text-base font-semibold text-primary focus-visible:border-input"
              />

              <span className="ml-auto text-xs text-muted-foreground">{list.length} поз.</span>
              <span className="w-[130px] text-right text-sm font-semibold tabular-nums text-primary">
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
                  <DropdownMenuItem disabled={secIdx === 0} onClick={() => onChange(movePromoSection(items, name, -1))}>
                    <ChevronUp className="mr-2 h-4 w-4" />Раздел выше
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={secIdx === sections.length - 1}
                    onClick={() => onChange(movePromoSection(items, name, 1))}
                  >
                    <ChevronDown className="mr-2 h-4 w-4" />Раздел ниже
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onChange(duplicatePromoSection(items, name))}>
                    <Copy className="mr-2 h-4 w-4" />Дублировать раздел
                  </DropdownMenuItem>
                  {onSaveSectionAsSnippet && (
                    <DropdownMenuItem onClick={() => onSaveSectionAsSnippet(name, list)}>
                      <Bookmark className="mr-2 h-4 w-4" />Сохранить как блок
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive" onClick={() => setDeleteSection(name)}>
                    <Trash2 className="mr-2 h-4 w-4" />Удалить раздел
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {!isCollapsed && (
              <div className="p-2">
                <div className="px-7 pb-1 text-[11px] uppercase tracking-wide text-primary/70">
                  Позиции раздела
                </div>

                <SortableList
                  items={list}
                  onReorder={(ids) => reorderSection(name, ids)}
                  className="space-y-1"
                  renderItem={(it, handle) => (
                    <div className={`rounded-lg border border-border/60 px-1 py-1 transition-colors hover:border-primary/40 hover:bg-primary/5 ${isCounted(it) ? "" : "opacity-60"}`}>
                      <div className="flex items-center gap-1">
                        <div>{handle}</div>
                        <div className="flex-1">
                          <SuggestInput<ItemHit>
                            value={it.title}
                            onChange={(v) => replace(it.id, { title: v })}
                            fetcher={(term) => fetchItems(term, name)}
                            labelOf={(h) => h.title}
                            onPick={(h) =>
                              replace(it.id, {
                                title: h.title,
                                unit: h.unit || it.unit,
                                price: h.price || it.price,
                                cost: h.cost || it.cost,
                                includes: h.includes.length ? h.includes : it.includes,
                              })
                            }
                            render={(h) => (
                              <span className="flex items-center justify-between gap-2">
                                <span className="truncate">{h.title}</span>
                                <span className="shrink-0 text-xs text-muted-foreground">{formatMoney(h.price, currency)}</span>
                              </span>
                            )}
                            placeholder="Наименование позиции"
                            className="h-9 font-medium text-foreground"
                          />

                        </div>
                        <div className="flex w-[120px] flex-col items-end">
                          <span className="text-sm font-semibold tabular-nums text-accent">{formatMoney(lineTotal(it), currency)}</span>
                          {showCost && lineCost(it) > 0 && (
                            <span className="text-[11px] tabular-nums text-muted-foreground">
                              маржа {formatMoney(lineTotal(it) - lineCost(it), currency)}
                            </span>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant={it.includes.length ? "secondary" : "ghost"}
                          className="h-9"
                          onClick={() => setIncludesFor(it)}
                        >
                          <ListChecks className="mr-1 h-4 w-4" />
                          Состав{it.includes.length ? ` (${it.includes.length})` : ""}
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-9 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => duplicate(it.id)}>
                              <Copy className="mr-2 h-4 w-4" />Дублировать
                            </DropdownMenuItem>
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger>
                                <FolderInput className="mr-2 h-4 w-4" />Перенести в раздел
                              </DropdownMenuSubTrigger>
                              <DropdownMenuSubContent>
                                {sectionNames
                                  .filter((s) => s !== name)
                                  .map((s) => (
                                    <DropdownMenuItem
                                      key={s || "__none"}
                                      onClick={() => onChange(movePromoItemToSection(items, it.id, s))}
                                    >
                                      {s || PROMO_NO_SECTION}
                                    </DropdownMenuItem>
                                  ))}
                                {PROMO_SECTION_SUGGESTIONS.filter((s) => !sectionNames.includes(s)).map((s) => (
                                  <DropdownMenuItem key={`new-${s}`} onClick={() => onChange(movePromoItemToSection(items, it.id, s))}>
                                    + {s}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>
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
                          <NumField value={it.qty} onChange={(v) => replace(it.id, { qty: v })} aria-label="Количество" className="h-8" />
                        </Mini>
                        <Mini label="Ед. изм." width="w-[84px]">
                          <Input
                            value={it.rate_unit}
                            placeholder="час"
                            onChange={(e) => replace(it.id, { rate_unit: e.target.value })}
                            className="h-8"
                          />
                        </Mini>
                        <Mini label={it.rate_unit.trim() ? `Кол-во (${it.rate_unit.trim()})` : "×"} width="w-[76px]">
                          <NumField value={it.multiplier} onChange={(v) => replace(it.id, { multiplier: v })} aria-label="Множитель" className="h-8" />
                        </Mini>
                        <Mini label={it.rate_unit.trim() ? `Цена/${it.rate_unit.trim()}` : "Цена"} width="w-[100px]">
                          <NumField value={it.price} step="0.01" onChange={(v) => replace(it.id, { price: v })} aria-label="Цена" className="h-8" />
                        </Mini>
                        {showCost && (
                          <Mini label="Себест." width="w-[100px]">
                            <NumField value={it.cost} step="0.01" onChange={(v) => replace(it.id, { cost: v })} aria-label="Себестоимость" className="h-8" />
                          </Mini>

                        )}
                        <Mini label="Связка" width="w-[110px]">
                          <Input
                            value={it.group_key}
                            placeholder="напр. флеш-тату"
                            onChange={(e) => replace(it.id, { group_key: e.target.value })}
                            className="h-8"
                          />
                        </Mini>
                        <span className="pb-2 text-[11px] text-muted-foreground">всего: {lineQty(it)}</span>
                      </div>

                      {it.includes.length > 0 && (
                        <ul className="ml-7 mt-1 list-disc pl-4 text-[11px] text-muted-foreground">
                          {it.includes.map((inc, i) => (
                            <li key={i}>{inc.text}{inc.note ? ` — ${inc.note}` : ""}</li>
                          ))}
                        </ul>
                      )}

                      <div className="ml-7 mt-1 flex flex-wrap items-center gap-3">
                        {showNotes && (
                          <TextAreaField
                            value={it.note}
                            onChange={(v) => replace(it.id, { note: v })}
                            placeholder="Примечание"
                            aria-label="Примечание"
                            minRows={1}
                            className="min-h-[34px] min-w-[240px] flex-1 border-primary/25 text-xs focus-visible:border-primary"
                          />
                        )}
                        <Label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <Switch
                            checked={it.included}
                            onCheckedChange={(v) => setIncluded(it, v)}
                          />
                          В итог
                        </Label>
                        <Label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <Switch
                            checked={it.is_info}
                            onCheckedChange={(v) => replace(it.id, { is_info: v })}
                          />
                          Справочно
                        </Label>
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

      <Button variant="outline" size="sm" onClick={addSection}>
        <Plus className="mr-1.5 h-4 w-4" />Добавить раздел
      </Button>

      {includesFor && (
        <QuoteItemIncludesEditor
          open
          onOpenChange={(v) => !v && setIncludesFor(null)}
          title={includesFor.title}
          value={includesFor.includes}
          onSave={(next) => {
            replace(includesFor.id, { includes: next });
            setIncludesFor(null);
          }}
        />
      )}

      <AlertDialog open={deleteSection !== null} onOpenChange={(v) => !v && setDeleteSection(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить раздел «{deleteSection || PROMO_NO_SECTION}»?</AlertDialogTitle>
            <AlertDialogDescription>
              Позиции раздела можно удалить вместе с ним или перенести в «{PROMO_NO_SECTION}».
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteSection !== null) onChange(removePromoSection(items, deleteSection, "keep"));
                setDeleteSection(null);
              }}
            >
              Перенести позиции
            </AlertDialogAction>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteSection !== null) onChange(removePromoSection(items, deleteSection, "items"));
                setDeleteSection(null);
              }}
            >
              Удалить с позициями
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
