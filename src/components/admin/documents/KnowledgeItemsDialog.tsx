// Массовое добавление позиций в документ из базы знаний (каталог, прошлые КП, заказы).
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { browseKnowledgeItems, type ItemBrowseHit } from "@/lib/doc-knowledge.functions";
import { fmtMoney } from "@/lib/formatters";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Раздел документа, в который добавляются позиции (пусто — берётся из базы знаний). */
  targetSection?: string;
  onAdd: (picked: ItemBrowseHit[], section: string) => void;
};

export function KnowledgeItemsDialog({ open, onOpenChange, targetSection, onAdd }: Props) {
  const browse = useServerFn(browseKnowledgeItems);
  const [term, setTerm] = useState("");
  const [section, setSection] = useState("");
  const [picked, setPicked] = useState<Record<string, ItemBrowseHit>>({});
  const [dest, setDest] = useState(targetSection ?? "");

  const q = useQuery({
    queryKey: ["kb-browse", term, section],
    queryFn: () => browse({ data: { term, section: section || undefined, limit: 80 } }),
    enabled: open,
    staleTime: 30_000,
  });

  const rows = q.data?.rows ?? [];
  const sections = q.data?.sections ?? [];
  const pickedList = useMemo(() => Object.values(picked), [picked]);

  const toggle = (hit: ItemBrowseHit) =>
    setPicked((p) => {
      const next = { ...p };
      if (next[hit.id]) delete next[hit.id];
      else next[hit.id] = hit;
      return next;
    });

  const submit = () => {
    if (!pickedList.length) return;
    onAdd(pickedList, dest.trim());
    setPicked({});
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setPicked({}); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Добавить из базы знаний</DialogTitle>
          <DialogDescription>
            Позиции из каталога сайта, прошлых КП, смет и заказов. Отметьте нужные и добавьте в документ.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Поиск по названию или описанию"
                className="h-9 pl-8"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Раздел документа</Label>
              <Input
                value={dest}
                onChange={(e) => setDest(e.target.value)}
                placeholder="как в базе знаний"
                className="h-9 w-[220px]"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant={section ? "outline" : "secondary"} className="h-7" onClick={() => setSection("")}>
              Все разделы
            </Button>
            {sections.map((s) => (
              <Button
                key={s}
                size="sm"
                variant={section === s ? "secondary" : "outline"}
                className="h-7"
                onClick={() => setSection(section === s ? "" : s)}
              >
                {s}
              </Button>
            ))}
          </div>

          <div className="max-h-[45vh] space-y-1 overflow-y-auto rounded-lg border p-1">
            {q.isLoading && <div className="p-4 text-sm text-muted-foreground">Загрузка…</div>}
            {!q.isLoading && rows.length === 0 && (
              <div className="p-4 text-sm text-muted-foreground">
                Ничего не найдено. Пополните базу знаний синхронизацией с каталогом.
              </div>
            )}
            {rows.map((hit) => {
              const active = !!picked[hit.id];
              return (
                <button
                  key={hit.id}
                  type="button"
                  onClick={() => toggle(hit)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-md px-3 py-2 text-left hover:bg-accent",
                    active && "bg-accent",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                      active ? "border-primary bg-primary text-primary-foreground" : "border-input",
                    )}
                  >
                    {active && <Check className="h-3 w-3" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{hit.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[hit.section, hit.unit, hit.description].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  {hit.usage_count > 0 && (
                    <Badge variant="outline" className="shrink-0 text-[10px]">×{hit.usage_count}</Badge>
                  )}
                  <span className="w-24 shrink-0 text-right text-sm tabular-nums">
                    {hit.price > 0 ? fmtMoney(hit.price) : "—"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <DialogFooter className="items-center gap-2 sm:justify-between">
          <span className="text-xs text-muted-foreground">Выбрано: {pickedList.length}</span>
          <Button onClick={submit} disabled={!pickedList.length}>
            Добавить в документ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
