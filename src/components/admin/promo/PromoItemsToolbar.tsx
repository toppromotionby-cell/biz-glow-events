// Панель быстрого наполнения позиций: новый раздел и библиотека блоков.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FolderPlus, Library, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { deletePromoSnippet, listPromoSnippets } from "@/lib/promo-quotes.functions";
import { newPromoItem, reindexPromo, type PromoItem } from "@/lib/promo-quote-model";
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

  const snippets = useQuery({ queryKey: ["promo-snippets"], queryFn: () => listSnippets() });
  const removeSnippet = useMutation({
    mutationFn: (id: string) => delSnippet({ data: { id } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["promo-snippets"] });
      toast.success("Блок удалён");
    },
  });

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

      <ClearCompositionButton count={items.length} onClear={() => { onChange([]); toast.success("Разделы и позиции убраны"); }} />

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
