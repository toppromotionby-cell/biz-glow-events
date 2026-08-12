// Единое окно выбора позиций из каталога сайта.
// mode="doc" — для КП: только текст, «что входит» и цена.
// mode="presentation" — для презентаций: дополнительно фото и характеристики.
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { fmtMoney } from "@/lib/formatters";
import { searchCatalogPicks } from "@/lib/catalog-pick.functions";
import {
  CATALOG_PICK_LABELS, CATALOG_PICK_TYPES, defaultPriceOption,
  type CatalogPick, type CatalogPickType, type CatalogPriceOption, type IncludesMode,
} from "@/lib/catalog-pick";

export type CatalogPickResult = { pick: CatalogPick; price: CatalogPriceOption };

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: "doc" | "presentation";
  /** Подтверждение выбора. includesMode приходит только в режиме документа. */
  onConfirm: (picks: CatalogPickResult[], opts: { includesMode: IncludesMode }) => void;
  /** Дополнительное действие «Заполнить текущий слайд» (только презентации). */
  onFillCurrent?: (result: CatalogPickResult) => void;
  title?: string;
};

const priceKey = (o: CatalogPriceOption) => `${o.label}|${o.price}|${o.unit}`;

export function CatalogPickerDialog({
  open, onOpenChange, mode, onConfirm, onFillCurrent, title,
}: Props) {
  const searchFn = useServerFn(searchCatalogPicks);
  const [term, setTerm] = useState("");
  const [type, setType] = useState<CatalogPickType | "all">("all");
  const [rows, setRows] = useState<CatalogPick[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Record<string, string>>({}); // id -> priceKey
  const [includesMode, setIncludesMode] = useState<IncludesMode>("list");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await searchFn({
          data: { term: term.trim() || undefined, type: type === "all" ? undefined : type, limit: 60 },
        });
        if (!cancelled) setRows(res);
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [open, term, type, searchFn]);

  useEffect(() => { if (!open) setSelected({}); }, [open]);

  const byId = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);

  const resultFor = (pick: CatalogPick): CatalogPickResult => {
    const key = selected[pick.id];
    const price = pick.priceOptions.find((o) => priceKey(o) === key) ?? defaultPriceOption(pick);
    return { pick, price };
  };

  const chosen = Object.keys(selected)
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((p) => resultFor(p as CatalogPick));

  const toggle = (pick: CatalogPick, on: boolean) =>
    setSelected((prev) => {
      const next = { ...prev };
      if (on) next[pick.id] = priceKey(defaultPriceOption(pick));
      else delete next[pick.id];
      return next;
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>{title ?? "Добавить из каталога"}</DialogTitle>
          <DialogDescription>
            {mode === "doc"
              ? "Подтягиваются название, описание, «что входит» и цена. Фотографии в КП не переносятся."
              : "Подтягиваются название, описание, «что входит», характеристики, цена и фотографии."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-end gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Поиск по каталогу"
              aria-label="Поиск по каталогу"
              className="pl-8"
            />
          </div>
          <div className="w-[190px] space-y-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Раздел</Label>
            <Select value={type} onValueChange={(v) => setType(v as CatalogPickType | "all")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все разделы</SelectItem>
                {CATALOG_PICK_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{CATALOG_PICK_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {mode === "doc" && (
            <div className="w-[210px] space-y-1">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Что входит</Label>
              <Select value={includesMode} onValueChange={(v) => setIncludesMode(v as IncludesMode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="list">Списком в блок «Что входит»</SelectItem>
                  <SelectItem value="text">Текстом в описание</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <ScrollArea className="h-[46vh] rounded-lg border border-border">
          <div className="divide-y divide-border">
            {loading && (
              <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />Загружаем каталог…
              </div>
            )}
            {!loading && rows.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">Ничего не найдено.</p>
            )}
            {rows.map((pick) => {
              const on = !!selected[pick.id];
              const price = resultFor(pick).price;
              return (
                <div key={`${pick.type}-${pick.id}`} className="flex items-start gap-3 p-3">
                  <Checkbox
                    checked={on}
                    onCheckedChange={(v) => toggle(pick, v === true)}
                    aria-label={`Выбрать ${pick.title}`}
                    className="mt-1 shrink-0"
                  />
                  {mode === "presentation" && pick.images[0] && (
                    <img
                      src={pick.images[0]}
                      alt=""
                      loading="lazy"
                      className="h-14 w-20 shrink-0 rounded-md object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="font-medium">{pick.title}</span>
                      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        {CATALOG_PICK_LABELS[pick.type]}
                      </span>
                    </div>
                    {pick.description && (
                      <p className="line-clamp-2 text-xs text-muted-foreground">{pick.description}</p>
                    )}
                    {pick.includes.length > 0 && (
                      <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                        Входит: {pick.includes.join(", ")}
                      </p>
                    )}
                  </div>
                  <div className="w-[190px] shrink-0 space-y-1">
                    {pick.priceOptions.length > 0 ? (
                      <Select
                        value={selected[pick.id] ?? priceKey(price)}
                        onValueChange={(v) => setSelected((prev) => ({ ...prev, [pick.id]: v }))}
                      >
                        <SelectTrigger className="h-8" aria-label={`Вариант цены: ${pick.title}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {pick.priceOptions.map((o) => (
                            <SelectItem key={priceKey(o)} value={priceKey(o)}>
                              {[o.label, fmtMoney(o.price), o.unit && `/ ${o.unit}`].filter(Boolean).join(" ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-xs text-muted-foreground">Цена по запросу</p>
                    )}
                    {mode === "presentation" && onFillCurrent && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-full text-xs"
                        onClick={() => { onFillCurrent(resultFor(pick)); onOpenChange(false); }}
                      >
                        В текущий слайд
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <DialogFooter className="items-center gap-2 sm:justify-between">
          <span className="text-xs text-muted-foreground">Выбрано: {chosen.length}</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
            <Button
              disabled={chosen.length === 0}
              onClick={() => { onConfirm(chosen, { includesMode }); onOpenChange(false); }}
            >
              {mode === "doc" ? "Добавить позиции" : "Создать слайды"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
