// Панель состава КП: разделы как самостоятельные группы (переименование,
// перемещение, дублирование, удаление), компактные строки позиций,
// себестоимость/маржа и состав позиции.
import { useMemo, useState, type ReactNode } from "react";
import {
  ChevronDown, ChevronUp, Copy, FolderPlus, ListChecks, MoreHorizontal, Plus, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClearCompositionButton } from "@/components/admin/documents/ClearCompositionButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fmtMoney } from "@/lib/formatters";
import {
  duplicateSection, emptyQuoteItem, listSections, moveSection, NO_SECTION, num,
  QUOTE_SECTION_SUGGESTIONS, removeSection, renameSection, type QuoteItem,
} from "@/lib/quotes-model";
import { QuoteItemIncludesEditor } from "@/components/admin/quotes/QuoteItemIncludesEditor";
import { NumField, TextAreaField, TextCommitField } from "@/components/admin/field-kit";
import { SuggestInput } from "@/components/admin/SuggestInput";
import { useDocSuggest, type ItemHit } from "@/hooks/use-doc-suggest";

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
  issues,
}: {
  items: QuoteItem[];
  onChange: (next: QuoteItem[]) => void;
  showCost: boolean;
  toolbar?: ReactNode;
  /** Замечания валидации по id позиции: подсвечивают строки с неполными данными. */
  issues?: Record<string, Array<{ level: "error" | "warn" | "info"; message: string }>>;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [includesFor, setIncludesFor] = useState<string | null>(null);
  const { fetchItems } = useDocSuggest();
  const [newSectionOpen, setNewSectionOpen] = useState(false);
  const [newSection, setNewSection] = useState("");

  const sections = useMemo(() => listSections(items), [items]);
  const grouped = useMemo(() => {
    const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);
    return sections.map((s) => [s, sorted.filter((it) => (it.section?.trim() || "") === s)] as const);
  }, [items, sections]);

  const replace = (id: string, patch: Partial<QuoteItem>) =>
    onChange(items.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  const remove = (id: string) =>
    onChange(items.filter((it) => it.id !== id).map((it, i) => ({ ...it, sort_order: i })));

  /** Вставка новых строк сразу после последней позиции их раздела. */
  const insertInSection = (section: string, created: QuoteItem[]) => {
    if (!created.length) return;
    const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);
    const key = (section ?? "").trim();
    const lastIdx = sorted.map((it) => (it.section?.trim() || "")).lastIndexOf(key);
    const next =
      lastIdx >= 0
        ? [...sorted.slice(0, lastIdx + 1), ...created, ...sorted.slice(lastIdx + 1)]
        : [...sorted, ...created];
    onChange(next.map((it, i) => ({ ...it, sort_order: i })));
  };

  const duplicate = (id: string) => {
    const idx = items.findIndex((it) => it.id === id);
    if (idx < 0) return;
    const src = items[idx]!;
    const copy: QuoteItem = {
      ...src,
      id: globalThis.crypto?.randomUUID?.() ?? `tmp-${Math.random()}`,
      includes: src.includes.map((x) => ({ ...x })),
    };
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

  const addInSection = (section: string) => {
    const quoteId = items[0]?.quote_id ?? "";
    insertInSection(section, [emptyQuoteItem(quoteId, items.length, { section })]);
  };

  const createSection = () => {
    const name = newSection.trim();
    if (!name) return;
    addInSection(name);
    setNewSection("");
    setNewSectionOpen(false);
  };

  const lineTotal = (it: QuoteItem) => num(it.qty) * num(it.price);
  const lineCost = (it: QuoteItem) => num(it.qty) * num(it.cost);
  const editing = items.find((it) => it.id === includesFor) ?? null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {toolbar}
        <Button variant="outline" size="sm" onClick={() => setNewSectionOpen(true)}>
          <FolderPlus className="mr-1.5 h-4 w-4" />Добавить раздел
        </Button>
        <ClearCompositionButton count={items.length} onClear={() => onChange([])} />
      </div>

      {grouped.map(([section, list], secIdx) => {
        const sum = list.reduce((s, it) => s + lineTotal(it), 0);
        const isCollapsed = collapsed[section];
        return (
          <div key={`sec-${secIdx}`} className="overflow-hidden rounded-xl border border-primary/25">
            <div className="flex items-center gap-2 border-b border-primary/20 border-l-2 border-l-primary bg-primary/5 px-2 py-2">
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setCollapsed((p) => ({ ...p, [section]: !p[section] }))}
                aria-label={isCollapsed ? "Развернуть раздел" : "Свернуть раздел"}
              >
                {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              </button>
              <TextCommitField
                value={section}
                placeholder={NO_SECTION}
                aria-label="Название раздела"
                className="h-8 flex-1 border-transparent bg-transparent px-1 text-base font-semibold text-primary focus-visible:border-input"
                onCommit={(v) => onChange(renameSection(items, section, v))}
              />
              <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                {list.length} поз. ·{" "}
                <span className="text-sm font-semibold text-primary">{fmtMoney(sum)}</span>
              </span>
              <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Добавить позицию в раздел"
                onClick={() => addInSection(section)}>
                <Plus className="h-4 w-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Действия с разделом">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onChange(moveSection(items, section, -1))}>
                    <ChevronUp className="mr-2 h-4 w-4" />Раздел выше
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onChange(moveSection(items, section, 1))}>
                    <ChevronDown className="mr-2 h-4 w-4" />Раздел ниже
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onChange(duplicateSection(items, section))}>
                    <Copy className="mr-2 h-4 w-4" />Дублировать раздел
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {section && (
                    <DropdownMenuItem onClick={() => onChange(removeSection(items, section, "keep"))}>
                      Убрать раздел, позиции оставить
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem className="text-destructive" onClick={() => onChange(removeSection(items, section, "items"))}>
                    <Trash2 className="mr-2 h-4 w-4" />Удалить с позициями
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {!isCollapsed && (
              <div className="divide-y divide-border/50">
                {list.map((it) => {
                  const rowIssues = issues?.[it.id] ?? [];
                  const rowLevel = rowIssues.some((x) => x.level === "error") ? "error" : rowIssues.length ? "warn" : null;
                  return (
                  <div
                    key={it.id}
                    data-item-id={it.id}
                    className={`m-1 rounded-lg border px-2 py-2 transition-colors ${
                      rowLevel === "error" ? "border-destructive/40 bg-destructive/5 border-l-2 border-l-destructive"
                        : rowLevel === "warn" ? "border-amber-500/40 bg-amber-500/5 border-l-2 border-l-amber-500"
                        : "border-border/60 hover:border-primary/40 hover:bg-primary/5"
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      <div className="flex flex-col text-muted-foreground">
                        <button type="button" className="hover:text-foreground" onClick={() => move(it.id, -1)} aria-label="Выше">
                          <ChevronUp className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" className="hover:text-foreground" onClick={() => move(it.id, 1)} aria-label="Ниже">
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="flex-1">
                        <SuggestInput<ItemHit>
                          value={it.title}
                          onChange={(v) => replace(it.id, { title: v })}
                          fetcher={(term) => fetchItems(term, section)}
                          labelOf={(h) => h.title}
                          onPick={(h) =>
                            replace(it.id, {
                              title: h.title,
                              unit: h.unit || it.unit,
                              price: h.price || it.price,
                              cost: h.cost || it.cost,
                              description: h.description || it.description,
                              includes: h.includes.length ? h.includes : it.includes,
                            })
                          }
                          render={(h) => (
                            <span className="flex items-center justify-between gap-2">
                              <span className="truncate">{h.title}</span>
                              <span className="shrink-0 text-xs text-muted-foreground">{fmtMoney(h.price)}</span>
                            </span>
                          )}
                          placeholder="Наименование позиции"
                          className="h-9 font-medium text-foreground"
                        />
                      </div>
                      <div className="flex w-[120px] flex-col items-end">
                        <span className="text-sm font-semibold tabular-nums text-accent">{fmtMoney(lineTotal(it))}</span>
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
                          <DropdownMenuItem onClick={() => setIncludesFor(it.id)}>
                            <ListChecks className="mr-2 h-4 w-4" />Состав позиции
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setExpanded((p) => ({ ...p, [it.id]: !p[it.id] }))}>
                            {expanded[it.id] ? "Скрыть описание" : "Описание"}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => duplicate(it.id)}>
                            <Copy className="mr-2 h-4 w-4" />Дублировать
                          </DropdownMenuItem>
                          {sections.length > 1 && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                                Перенести в раздел
                              </DropdownMenuLabel>
                              {sections
                                .filter((s) => s !== section)
                                .map((s) => (
                                  <DropdownMenuItem key={s || "__none"} onClick={() => replace(it.id, { section: s })}>
                                    {s || NO_SECTION}
                                  </DropdownMenuItem>
                                ))}
                            </>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => remove(it.id)}>
                            <Trash2 className="mr-2 h-4 w-4" />Удалить
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="ml-6 mt-1 flex flex-wrap items-end gap-2">
                      <Mini label="Кол-во" width="w-[84px]">
                        <NumField value={it.qty} aria-label="Количество"
                          className="h-8 text-center tabular-nums"
                          onChange={(v) => replace(it.id, { qty: v })} />
                      </Mini>
                      <Mini label="Ед. изм." width="w-[92px]">
                        <Input value={it.unit} className="h-8" onChange={(e) => replace(it.id, { unit: e.target.value })} />
                      </Mini>
                      <Mini label="Цена" width="w-[110px]">
                        <NumField value={it.price} step="0.01" aria-label="Цена" className="h-8"
                          onChange={(v) => replace(it.id, { price: v })} />
                      </Mini>
                      {showCost && (
                        <Mini label="Себест." width="w-[110px]">
                          <NumField value={it.cost} step="0.01" aria-label="Себестоимость" className="h-8"
                            onChange={(v) => replace(it.id, { cost: v })} />
                        </Mini>
                      )}
                      <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setIncludesFor(it.id)}>
                        <ListChecks className="mr-1.5 h-3.5 w-3.5" />
                        Состав{it.includes.length ? ` · ${it.includes.length}` : ""}
                      </Button>
                    </div>

                    {!!it.includes.length && (
                      <ul className="ml-6 mt-1 space-y-0.5 text-xs text-muted-foreground">
                        {it.includes.slice(0, 4).map((inc, i) => (
                          <li key={i}>• {inc.text}{inc.note ? ` — ${inc.note}` : ""}</li>
                        ))}
                        {it.includes.length > 4 && <li>… ещё {it.includes.length - 4}</li>}
                      </ul>
                    )}

                    {expanded[it.id] && (
                      <div className="ml-6 mt-2">
                        <TextAreaField
                          placeholder="Описание позиции (попадёт в документ)"
                          aria-label="Описание позиции"
                          value={it.description}
                          onChange={(v) => replace(it.id, { description: v })}
                          className="border-primary/25 text-xs focus-visible:border-primary"
                        />
                      </div>
                    )}

                    {rowIssues.length > 0 && (
                      <ul className="ml-6 mt-1 space-y-0.5 text-[11px]">
                        {rowIssues.map((x, i) => (
                          <li key={i} className={x.level === "error" ? "text-destructive" : "text-amber-600"}>
                            {x.message}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  );
                })}
                {!list.length && (
                  <p className="px-3 py-3 text-sm text-muted-foreground">В разделе нет позиций</p>
                )}
              </div>
            )}
          </div>
        );
      })}

      {!items.length && <p className="py-3 text-sm text-muted-foreground">Позиции не добавлены</p>}

      <datalist id="quote-sections">
        {QUOTE_SECTION_SUGGESTIONS.map((s) => <option key={s} value={s} />)}
      </datalist>

      {editing && (
        <QuoteItemIncludesEditor
          key={editing.id}
          open
          onOpenChange={(v) => !v && setIncludesFor(null)}
          title={editing.title}
          value={editing.includes}
          onSave={(next) => replace(editing.id, { includes: next })}
        />
      )}

      <Dialog open={newSectionOpen} onOpenChange={setNewSectionOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Новый раздел</DialogTitle></DialogHeader>
          <Input
            list="quote-sections"
            autoFocus
            value={newSection}
            placeholder="Например: Оборудование"
            onChange={(e) => setNewSection(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") createSection(); }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewSectionOpen(false)}>Отмена</Button>
            <Button onClick={createSection}>Добавить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
