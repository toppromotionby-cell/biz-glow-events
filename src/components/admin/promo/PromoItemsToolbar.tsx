// Панель быстрого наполнения позиций: новый раздел, вставка из Excel, библиотека блоков.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { BookOpen, ClipboardPaste, FolderPlus, Library, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { deletePromoSnippet, listPromoSnippets } from "@/lib/promo-quotes.functions";
import { newPromoItem, parsePastedPromoRows, type PromoItem } from "@/lib/promo-quote-model";
import { KnowledgeItemsDialog } from "@/components/admin/documents/KnowledgeItemsDialog";
import { ClearCompositionButton } from "@/components/admin/documents/ClearCompositionButton";

export function PromoItemsToolbar({
  items, onChange,
}: {
  items: PromoItem[];
  onChange: (next: PromoItem[]) => void;
}) {
  const qc = useQueryClient();
  const listSnippets = useServerFn(listPromoSnippets);
  const delSnippet = useServerFn(deletePromoSnippet);

  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteSection, setPasteSection] = useState("");
  const [kbOpen, setKbOpen] = useState(false);

  const snippets = useQuery({ queryKey: ["promo-snippets"], queryFn: () => listSnippets() });
  const removeSnippet = useMutation({
    mutationFn: (id: string) => delSnippet({ data: { id } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["promo-snippets"] });
      toast.success("Блок удалён");
    },
  });

  const addFromKnowledge = (
    picked: Array<{ title: string; section: string; unit: string; price: number; cost: number; description: string; includes: Array<{ text: string; note: string }> }>,
    section: string,
  ) => {
    const created = picked.map((h, i) =>
      newPromoItem(section || h.section || "", {
        title: h.title,
        unit: h.unit || "услуга",
        price: h.price,
        cost: h.cost,
        note: h.description,
        includes: h.includes.map((x) => ({ ...x })),
        sort_order: items.length + i,
      }),
    );
    onChange([...items, ...created]);
    toast.success(`Добавлено позиций: ${created.length}`);
  };

  const applyPaste = () => {
    const parsed = parsePastedPromoRows(pasteText, pasteSection.trim());
    if (!parsed.length) return toast.error("Не удалось распознать строки");
    onChange([...items, ...parsed]);
    setPasteOpen(false);
    setPasteText("");
    toast.success(`Добавлено строк: ${parsed.length}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        onClick={() =>
          onChange(reindexPromo([...items, newPromoItem(`Раздел ${new Set(items.map((i) => (i.section ?? "").trim())).size + 1}`)]))
        }

      >
        <FolderPlus className="mr-1 h-4 w-4" />Новый раздел
      </Button>

      <Dialog open={pasteOpen} onOpenChange={setPasteOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline"><ClipboardPaste className="mr-1 h-4 w-4" />Вставить из Excel</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Вставка таблицы</DialogTitle>
            <DialogDescription>
              Скопируйте строки из Excel и вставьте сюда. Колонки: наименование, кол-во, цена, примечание.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Раздел для новых строк</Label>
              <Input value={pasteSection} onChange={(e) => setPasteSection(e.target.value)} placeholder="Персонал" />
            </div>
            <Textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              className="min-h-[180px] font-mono text-xs"
              placeholder={"Промоутер\t4\t120\t8 часов\nСупервайзер\t1\t200"}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPasteOpen(false)}>Отмена</Button>
            <Button onClick={applyPaste}>Добавить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ClearCompositionButton count={items.length} onClear={() => { onChange([]); toast.success("Разделы и позиции убраны"); }} />

      <Button size="sm" variant="outline" onClick={() => setKbOpen(true)}>
        <BookOpen className="mr-1 h-4 w-4" />Из базы знаний
      </Button>

      <KnowledgeItemsDialog open={kbOpen} onOpenChange={setKbOpen} onAdd={addFromKnowledge} />

      <Popover>
        <PopoverTrigger asChild>
          <Button size="sm" variant="outline"><Library className="mr-1 h-4 w-4" />Блоки</Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[320px] p-2">
          {snippets.isLoading && <div className="p-2 text-sm text-muted-foreground">Загрузка…</div>}
          {snippets.data?.length === 0 && (
            <div className="p-2 text-sm text-muted-foreground">
              Пока нет сохранённых блоков. Сохраните раздел через меню «⋯» рядом с его названием.
            </div>
          )}
          <div className="max-h-[280px] space-y-1 overflow-auto">
            {snippets.data?.map((s) => (
              <div key={s.id} className="flex items-center gap-1 rounded-md p-1 hover:bg-muted/50">
                <button
                  type="button"
                  className="flex-1 text-left"
                  onClick={() => {
                    const add = s.items.map((it) => ({ ...it, id: crypto.randomUUID(), quote_id: "" }));
                    onChange([...items, ...add]);
                    toast.success(`Блок «${s.name}» добавлен`);
                  }}
                >
                  <div className="text-sm">{s.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {s.section || "без раздела"} · {s.items.length} поз.
                  </div>
                </button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive"
                  onClick={() => removeSnippet.mutate(s.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
