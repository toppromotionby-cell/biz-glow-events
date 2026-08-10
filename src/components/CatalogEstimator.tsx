// Калькулятор предварительной сметы на реальных позициях каталога.
// Никаких зашитых цен: всё берётся из опубликованных карточек сайта.
// Порядок подсказок — по рейтингу спроса (запросы, корзины, заказы).
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Search, Plus, Minus, Trash2, TrendingUp, ArrowRight, ShoppingCart, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCalculatorCatalog, type CalcItem } from "@/lib/calculator.functions";
import { maxQtyForItem, formatBYNTotal } from "@/lib/pricing";
import { addToCart, type CartEntityType } from "@/lib/cart";

const TYPE_LABEL: Record<CalcItem["type"], string> = {
  zones: "Зоны",
  tech_equipment: "Оборудование",
  services: "Услуги",
  production_items: "Продакшн",
  attractions: "Аттракционы",
};

const TYPES = Object.keys(TYPE_LABEL) as CalcItem["type"][];

export function CatalogEstimator({ compact = false }: { compact?: boolean }) {
  const { data, isLoading } = useQuery({
    queryKey: ["calculator-catalog"],
    queryFn: () => getCalculatorCatalog(),
    staleTime: 5 * 60 * 1000,
  });
  const items = useMemo(() => data ?? [], [data]);

  const [qty, setQty] = useState<Record<string, number>>({});
  const [tab, setTab] = useState<CalcItem["type"] | "popular">("popular");
  const [q, setQ] = useState("");

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const popular = useMemo(
    () => items.filter((i) => i.popularity > 0).slice(0, 12),
    [items],
  );
  const popularList = popular.length > 0 ? popular : items.slice(0, 12);

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    let list = tab === "popular" ? popularList : items.filter((i) => i.type === tab);
    if (term) list = items.filter((i) => i.title.toLowerCase().includes(term));
    return list.slice(0, compact ? 24 : 120);
  }, [q, tab, items, popularList, compact]);

  const selected = useMemo(
    () => Object.entries(qty).filter(([, n]) => n > 0).map(([id, n]) => ({ item: byId.get(id), n })).filter((x): x is { item: CalcItem; n: number } => !!x.item),
    [qty, byId],
  );

  const total = selected.reduce((s, { item, n }) => s + (item.price ?? 0) * n, 0);
  const onRequest = selected.filter(({ item }) => item.price === null);

  const bump = (item: CalcItem, delta: number) => {
    const max = maxQtyForItem(item.type, item.unit);
    setQty((prev) => {
      const next = Math.max(0, Math.min(max, (prev[item.id] ?? 0) + delta));
      const copy = { ...prev };
      if (next === 0) delete copy[item.id];
      else copy[item.id] = next;
      return copy;
    });
  };

  const toCart = () => {
    if (selected.length === 0) return;
    let added = 0;
    for (const { item, n } of selected) {
      const res = addToCart({
        entity_type: item.type as CartEntityType,
        id: item.id,
        slug: item.slug,
        title: item.title,
        price: item.price ?? 0,
        qty: n,
        unit: item.unit,
      });
      if (res.added) added += 1;
    }
    toast.success(added > 0 ? `Добавлено в корзину: ${added}` : "Позиции уже в корзине");
  };

  return (
    <div className={compact ? "grid lg:grid-cols-[1fr_340px] gap-6" : "grid lg:grid-cols-[1fr_380px] gap-8"}>
      <section aria-label="Выбор позиций" className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setTab("popular")}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition ${
              tab === "popular" ? "border-primary/60 bg-primary/10 text-foreground" : "border-border/50 text-muted-foreground hover:text-foreground"
            }`}
          >
            <TrendingUp className="h-3.5 w-3.5" /> Чаще всего заказывают
          </button>
          {TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-full border px-3 py-1.5 text-xs transition ${
                tab === t ? "border-primary/60 bg-primary/10 text-foreground" : "border-border/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              {TYPE_LABEL[t]}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск по каталогу"
            aria-label="Поиск позиции"
            className="pl-9"
          />
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-10">
            <Loader2 className="h-4 w-4 animate-spin" /> Загружаем позиции каталога…
          </div>
        ) : visible.length === 0 ? (
          <p className="text-sm text-muted-foreground py-10">Ничего не найдено — измените запрос.</p>
        ) : (
          <ul className="grid sm:grid-cols-2 gap-2">
            {visible.map((item) => {
              const n = qty[item.id] ?? 0;
              return (
                <li
                  key={`${item.type}-${item.id}`}
                  className={`glass rounded-xl border p-3 transition ${n > 0 ? "border-primary/60 bg-primary/5" : "border-border/50"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium line-clamp-2">{item.title}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {TYPE_LABEL[item.type]}
                        {item.unit ? ` · ${item.unit}` : ""}
                        {item.popularity > 0 ? " · популярно" : ""}
                      </div>
                    </div>
                    <div className="text-right whitespace-nowrap">
                      <div className="text-sm text-primary">
                        {item.price !== null ? `от ${formatBYNTotal(item.price)}` : "по запросу"}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    {n > 0 && (
                      <button type="button" aria-label="Уменьшить" onClick={() => bump(item, -1)} className="rounded-md border border-border/60 p-1.5 hover:bg-muted/40">
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {n > 0 && <span className="text-sm w-6 text-center">{n}</span>}
                    <button
                      type="button"
                      onClick={() => bump(item, 1)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 px-3 py-1.5 text-xs font-medium hover:bg-primary/10 transition"
                    >
                      <Plus className="h-3.5 w-3.5" /> {n > 0 ? "Ещё" : "Добавить"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <aside aria-label="Предварительный расчёт" className="lg:sticky lg:top-24 self-start">
        <div className="glass-strong rounded-3xl border border-border/50 p-6">
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground">Предварительный расчёт</h2>
          <div className="mt-3 text-3xl md:text-4xl font-display font-bold gradient-text">
            {formatBYNTotal(total)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            По ценам каталога сайта. Итог уточняет менеджер с учётом дат, логистики и монтажа.
          </p>

          {selected.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">Добавьте позиции слева — сумма посчитается автоматически.</p>
          ) : (
            <ul className="mt-5 space-y-2 text-sm max-h-72 overflow-auto pr-1">
              {selected.map(({ item, n }) => (
                <li key={item.id} className="flex items-start justify-between gap-2">
                  <span className="min-w-0">
                    <span className="line-clamp-2">{item.title}</span>
                    <span className="text-xs text-muted-foreground">× {n}</span>
                  </span>
                  <span className="flex items-center gap-2 whitespace-nowrap">
                    {item.price !== null ? formatBYNTotal(item.price * n) : "по запросу"}
                    <button type="button" aria-label={`Убрать ${item.title}`} onClick={() => bump(item, -n)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}

          {onRequest.length > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              {onRequest.length} позиц{onRequest.length === 1 ? "ия" : "ий"} без цены в каталоге — посчитаем индивидуально.
            </p>
          )}

          <div className="mt-6 space-y-2">
            <Button onClick={toCart} disabled={selected.length === 0} size="lg" className="w-full">
              <ShoppingCart className="mr-2 h-4 w-4" /> Перенести в корзину
            </Button>
            <Button asChild variant="outline" size="lg" className="w-full">
              <Link to="/contacts">
                Получить точную смету <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </aside>
    </div>
  );
}
