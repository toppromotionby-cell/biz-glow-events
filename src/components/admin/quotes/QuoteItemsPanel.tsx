// Панель состава КП: разделы как самостоятельные группы (переименование,
// перемещение, дублирование, удаление), компактные строки позиций,
// себестоимость/маржа, состав позиции и вставка из Excel.
import { useMemo, useState, type ReactNode } from "react";
import {
  ChevronDown, ChevronUp, ClipboardPaste, Copy, FolderPlus, ListChecks, MoreHorizontal, Plus, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fmtMoney } from "@/lib/formatters";
import {
  duplicateSection, emptyQuoteItem, listSections, moveSection, NO_SECTION, num, parsePastedQuoteRows,
  QUOTE_SECTION_SUGGESTIONS, removeSection, renameSection, type QuoteItem,
} from "@/lib/quotes-model";
import { QuoteItemIncludesEditor } from "@/components/admin/quotes/QuoteItemIncludesEditor";
import { SuggestInput } from "@/components/admin/SuggestInput";
import { useDocSuggest } from "@/hooks/use-doc-suggest";

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
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [includesFor, setIncludesFor] = useState<string | null>(null);
  const [newSectionOpen, setNewSectionOpen] = useState(false);
  const [newSection, setNewSection] = useState("");
  const { fetchItems } = useDocSuggest();

  const sections = useMemo(() => listSections(items), [items]);
  const grouped = useMemo(() => {
    const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);
    return sections.map((s) => [s, sorted.filter((it) => (it.section?.trim() || "") === s)] as const);
  }, [items, sections]);

  const replace = (id: string, patch: Partial<QuoteItem>) =>
    onChange(items.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  const remove = (id: string) => onChange(items.filter((it) => it.id !== id));

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
    onChange([...items, emptyQuoteItem(quoteId, items.length, { section })]);
  };

  const createSection = () => {
    const name = newSection.trim();
    if (!name) return;
    addInSection(name);
    setNewSection("");
    setNewSectionOpen(false);
  };

  const applyPaste = () => {
    const parsed = parsePastedQuoteRows(pasteText);
    if (!parsed.length) return;
    const base = items.length;
    const quoteId = items[0]?.quote_id ?? "";
    const created: QuoteItem[] = parsed.map((r, i) =>
      emptyQuoteItem(quoteId, base + i, { title: r.title, qty: r.qty, unit: r.unit, price: r.price, cost: r.cost }),
    );
    onChange([...items, ...created]);
    setPasteText("");
    setPasteOpen(false);
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
        <Button variant="outline" size="sm" onClick={() => setPasteOpen(true)}>
          <ClipboardPaste className="mr-1.5 h-4 w-4" />Вставить из Excel
        </Button>
      </div>

      {grouped.map(([section, list]) => {
        const sum = list.reduce((s, it) => s + lineTotal(it), 0);
        const isCollapsed = collapsed[section];
        return (
          <div key={section || "__none"} className="rounded-xl border border-border/60">
            <div className="flex items-center gap-2 border-b border-border/60 px-2 py-2">
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setCollapsed((p) => ({ ...p, [section]: !p[section] }))}
                aria-label={isCollapsed ? "Развернуть раздел" : "Свернуть раздел"}
              >
                {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              </button>
              <Input
                list="quote-sections"
                value={section}
                placeholder={NO_SECTION}
                className="h-8 flex-1 border-transparent bg-transparent px-1 font-medium focus-visible:border-input"
                onChange={(e) => onChange(renameSection(items, section, e.target.value))}
              />
              <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                {list.length} поз. · {fmtMoney(sum)}
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
                      <div className="flex-1">
                        <SuggestInput
                          value={it.title}
                          onChange={(v) => replace(it.id, { title: v })}
                          fetcher={(term) => fetchItems(term, section)}
                          onPick={(h) => replace(it.id, {
                            title: h.title,
                            description: h.description || it.description,
                            unit: h.unit || it.unit,
                            price: h.price || it.price,
                            cost: h.cost || it.cost,
                            includes: h.includes.length ? h.includes : it.includes,
                          })}
                          render={(h) => (
                            <>
                              <div className="font-medium">{h.title}</div>
                              <div className="text-xs text-muted-foreground">
                                {[h.section, fmtMoney(h.price), h.unit].filter(Boolean).join(" · ")}
                              </div>
                            </>
                          )}
                          placeholder="Наименование позиции"
                          className="h-9"
                        />
                      </div>
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
                        <Input type="number" min={0} value={it.qty}
                          className="h-8 text-center tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
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
