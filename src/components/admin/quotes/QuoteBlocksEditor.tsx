// Конструктор документа КП: шаблон, блоки с условиями показа, формулы и библиотека сниппетов.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDown, ArrowUp, BookmarkPlus, GripVertical, Library, Plus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  EDITABLE_BLOCK_TYPES, QUOTE_BLOCK_CONDITIONS, QUOTE_BLOCK_CONDITION_LABELS,
  QUOTE_BLOCK_LABELS, QUOTE_BLOCK_TYPES, QUOTE_PLACEHOLDERS, QUOTE_SNIPPET_PRESETS,
  QUOTE_TEMPLATES, QUOTE_TEMPLATE_HINTS, QUOTE_TEMPLATE_LABELS,
  blockFromSnippet, defaultBlocksForTemplate, newBlock, normalizeBlockType, normalizeCondition,
  type QuoteBlock, type QuoteBlockCondition, type QuoteBlockType, type QuoteTemplate,
} from "@/lib/quote-blocks";
import { deleteQuoteSnippet, listQuoteSnippets, saveQuoteSnippet } from "@/lib/quotes.functions";
import { QuoteTextEditor } from "@/components/admin/quotes/QuoteTextEditor";


type Props = {
  template: QuoteTemplate;
  blocks: QuoteBlock[];
  onChange: (patch: { template?: QuoteTemplate; blocks?: QuoteBlock[] }) => void;
};

const PLACEHOLDER_GROUPS = [...new Set(QUOTE_PLACEHOLDERS.map((p) => p.group))];

function PlaceholderMenu({ onPick }: { onPick: (token: string) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs">
          {"{{ }}"} плейсхолдер
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto w-72">
        {PLACEHOLDER_GROUPS.map((group) => (
          <div key={group}>
            <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">{group}</DropdownMenuLabel>
            {QUOTE_PLACEHOLDERS.filter((p) => p.group === group).map((p) => (
              <DropdownMenuItem key={p.key} onSelect={() => onPick(`{{${p.key}}}`)} className="text-xs">
                <span className="flex-1">{p.label}</span>
                <code className="text-[10px] text-muted-foreground">{p.key}</code>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function QuoteBlocksEditor({ template, blocks, onChange }: Props) {
  const [confirmReset, setConfirmReset] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [saveTarget, setSaveTarget] = useState<QuoteBlock | null>(null);
  const [snippetName, setSnippetName] = useState("");
  const [snippetDesc, setSnippetDesc] = useState("");

  const qc = useQueryClient();
  const fetchSnippets = useServerFn(listQuoteSnippets);
  const saveSnippetFn = useServerFn(saveQuoteSnippet);
  const deleteSnippetFn = useServerFn(deleteQuoteSnippet);

  const snippetsQuery = useQuery({
    queryKey: ["quote-snippets"],
    queryFn: () => fetchSnippets(),
    staleTime: 60_000,
  });

  const saveSnippet = useMutation({
    mutationFn: (payload: { name: string; description: string; block_type: string; title: string; content: string; condition: string }) =>
      saveSnippetFn({ data: payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quote-snippets"] });
      toast.success("Блок сохранён в библиотеку");
      setSaveTarget(null);
    },
    onError: (e: Error) => toast.error(e.message || "Не удалось сохранить блок"),
  });

  const removeSnippet = useMutation({
    mutationFn: (id: string) => deleteSnippetFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quote-snippets"] }),
    onError: (e: Error) => toast.error(e.message || "Не удалось удалить"),
  });

  const list = blocks?.length ? blocks : defaultBlocksForTemplate(template);

  const update = (id: string, patch: Partial<QuoteBlock>) =>
    onChange({ blocks: list.map((b) => (b.id === id ? { ...b, ...patch } : b)) });

  const move = (index: number, dir: -1 | 1) => {
    const next = [...list];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    const a = next[index]!;
    next[index] = next[target]!;
    next[target] = a;
    onChange({ blocks: next });
  };

  const add = (type: QuoteBlockType) => onChange({ blocks: [...list, newBlock(type)] });
  const remove = (id: string) => onChange({ blocks: list.filter((b) => b.id !== id) });
  const applyTemplate = (t: QuoteTemplate) => onChange({ template: t, blocks: defaultBlocksForTemplate(t) });

  const insertSnippet = (s: { block_type?: string; type?: string; title?: string; content?: string; condition?: string }) => {
    onChange({ blocks: [...list, blockFromSnippet(s)] });
    setLibraryOpen(false);
    toast.success("Блок добавлен в документ");
  };

  const openSaveDialog = (b: QuoteBlock) => {
    setSaveTarget(b);
    setSnippetName(b.title || QUOTE_BLOCK_LABELS[b.type]);
    setSnippetDesc("");
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Шаблон документа</Label>
        <div className="grid gap-2 sm:grid-cols-3">
          {QUOTE_TEMPLATES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => applyTemplate(t)}
              className={`text-left rounded-xl border p-3 transition ${
                template === t ? "border-primary bg-primary/5" : "border-border/60 hover:border-border"
              }`}
            >
              <div className="text-sm font-medium">{QUOTE_TEMPLATE_LABELS[t]}</div>
              <div className="text-[11px] text-muted-foreground mt-1 leading-snug">{QUOTE_TEMPLATE_HINTS[t]}</div>
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Смена шаблона пересобирает набор блоков заново — тексты полей документа сохраняются.
        </p>
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Label className="text-xs text-muted-foreground">Блоки документа ({list.length})</Label>
        <div className="flex items-center gap-1">
          <Button
            type="button" variant="ghost" size="sm"
            onClick={() => (confirmReset ? (applyTemplate(template), setConfirmReset(false)) : setConfirmReset(true))}
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />{confirmReset ? "Точно сбросить?" : "Сбросить"}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setLibraryOpen(true)}>
            <Library className="h-3.5 w-3.5 mr-1.5" />Библиотека
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm"><Plus className="h-3.5 w-3.5 mr-1.5" />Блок</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {QUOTE_BLOCK_TYPES.map((t) => (
                <DropdownMenuItem key={t} onSelect={() => add(t)} className="text-xs">
                  {QUOTE_BLOCK_LABELS[t]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Условие показа скрывает блок автоматически, если данных нет (нет доставки, скидки, реквизитов и т.д.).
        В текстах работают формулы: <code>{"{{= total - advance }}"}</code>, <code>{"{{= subtotal * 20 / 100 }}"}</code>.
      </p>

      <div className="space-y-2">
        {list.map((b, i) => {
          const editable = EDITABLE_BLOCK_TYPES.includes(b.type);
          return (
            <div key={b.id} className={`rounded-xl border p-3 space-y-2 ${b.enabled ? "border-border/60" : "border-dashed border-border/60 opacity-60"}`}>
              <div className="flex items-center gap-2">
                <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                <Input
                  value={b.title}
                  onChange={(e) => update(b.id, { title: e.target.value })}
                  className="h-8 text-sm"
                  placeholder={QUOTE_BLOCK_LABELS[b.type]}
                />
                <Badge variant="secondary" className="text-[10px] shrink-0">{QUOTE_BLOCK_LABELS[b.type]}</Badge>
                <Switch checked={b.enabled} onCheckedChange={(v) => update(b.id, { enabled: v })} />
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => move(i, -1)} disabled={i === 0}>
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => move(i, 1)} disabled={i === list.length - 1}>
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" title="Сохранить как блок библиотеки" onClick={() => openSaveDialog(b)}>
                  <BookmarkPlus className="h-3.5 w-3.5" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(b.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              {b.enabled && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground shrink-0">Показывать:</span>
                  <Select
                    value={b.condition ?? "always"}
                    onValueChange={(v) => update(b.id, { condition: normalizeCondition(v) })}
                  >
                    <SelectTrigger className="h-8 text-xs w-full sm:w-72"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {QUOTE_BLOCK_CONDITIONS.map((c: QuoteBlockCondition) => (
                        <SelectItem key={c} value={c} className="text-xs">{QUOTE_BLOCK_CONDITION_LABELS[c]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {editable && b.enabled && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">
                      {b.type === "text" ? "Текст блока" : "Свой текст (пусто — берётся из «Тексты документа»)"}
                    </span>
                    <PlaceholderMenu onPick={(token) => update(b.id, { content: `${b.content ?? ""}${b.content ? " " : ""}${token}` })} />
                  </div>
                  <QuoteTextEditor
                    value={b.content ?? ""}
                    onChange={(v) => update(b.id, { content: v })}
                    onValidityChange={(hasErr) => setBlockErrors((prev) => (prev[b.id] === hasErr ? prev : { ...prev, [b.id]: hasErr }))}
                  />
                </div>
              )}

            </div>
          );
        })}
      </div>

      {/* Библиотека блоков */}
      <Dialog open={libraryOpen} onOpenChange={setLibraryOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Библиотека блоков</DialogTitle>
            <DialogDescription>Готовые части документа с условиями и формулами — добавляются в конец КП.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Стандартные заготовки</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {QUOTE_SNIPPET_PRESETS.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => insertSnippet(p)}
                    className="text-left rounded-lg border border-border/60 p-3 hover:border-primary transition"
                  >
                    <div className="text-sm font-medium">{p.name}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{p.description}</div>
                    <Badge variant="secondary" className="text-[10px] mt-2">
                      {QUOTE_BLOCK_CONDITION_LABELS[p.condition]}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Мои блоки</Label>
              {snippetsQuery.isLoading ? (
                <p className="text-xs text-muted-foreground">Загрузка…</p>
              ) : !snippetsQuery.data?.length ? (
                <p className="text-xs text-muted-foreground">
                  Пока пусто. Сохраните любой блок из документа кнопкой «закладка» — он появится здесь.
                </p>
              ) : (
                <div className="space-y-2">
                  {snippetsQuery.data.map((s) => (
                    <div key={s.id} className="flex items-start gap-2 rounded-lg border border-border/60 p-3">
                      <button type="button" className="flex-1 text-left" onClick={() => insertSnippet(s)}>
                        <div className="text-sm font-medium">{s.name}</div>
                        {s.description && <div className="text-[11px] text-muted-foreground mt-0.5">{s.description}</div>}
                        <div className="flex gap-1 mt-2">
                          <Badge variant="secondary" className="text-[10px]">{QUOTE_BLOCK_LABELS[normalizeBlockType(s.block_type)]}</Badge>
                          <Badge variant="outline" className="text-[10px]">{QUOTE_BLOCK_CONDITION_LABELS[normalizeCondition(s.condition)]}</Badge>
                        </div>
                      </button>
                      <Button
                        type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                        onClick={() => removeSnippet.mutate(s.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Сохранение блока как сниппета */}
      <Dialog open={!!saveTarget} onOpenChange={(v) => !v && setSaveTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Сохранить блок в библиотеку</DialogTitle>
            <DialogDescription>Блок можно будет вставлять в любое новое КП.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Название</Label>
              <Input value={snippetName} onChange={(e) => setSnippetName(e.target.value)} placeholder="Например: Порядок оплаты" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Описание</Label>
              <Input value={snippetDesc} onChange={(e) => setSnippetDesc(e.target.value)} placeholder="Короткая подсказка для команды" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setSaveTarget(null)}>Отмена</Button>
            <Button
              type="button"
              disabled={!snippetName.trim() || saveSnippet.isPending}
              onClick={() =>
                saveTarget &&
                saveSnippet.mutate({
                  name: snippetName.trim(),
                  description: snippetDesc.trim(),
                  block_type: saveTarget.type,
                  title: saveTarget.title,
                  content: saveTarget.content ?? "",
                  condition: saveTarget.condition ?? "always",
                })
              }
            >
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
