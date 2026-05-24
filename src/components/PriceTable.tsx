// Editable + read-only price table for catalog items.
// Storage shape: pricing = { from?: number; tiers?: PriceTier[] }
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";

export type PriceTier = {
  label: string;
  price: number | "";
  unit?: string;
  note?: string;
};

export type PricingValue = {
  from?: number;
  tiers?: PriceTier[];
} & Record<string, unknown>;

const fmt = (n: number) =>
  new Intl.NumberFormat("ru-BY", { style: "currency", currency: "BYN", maximumFractionDigits: 0 }).format(n);

export function getTiers(pricing: unknown): PriceTier[] {
  if (!pricing || typeof pricing !== "object") return [];
  const t = (pricing as PricingValue).tiers;
  return Array.isArray(t) ? t.filter((x) => x && typeof x === "object") : [];
}

export function minPriceFromTiers(tiers: PriceTier[]): number | null {
  const nums = tiers.map((t) => Number(t.price)).filter((n) => Number.isFinite(n) && n > 0);
  return nums.length ? Math.min(...nums) : null;
}

export function PriceTableEditor({
  value,
  onChange,
}: {
  value: PricingValue | null | undefined;
  onChange: (next: PricingValue) => void;
}) {
  const pricing: PricingValue = value && typeof value === "object" ? value : {};
  const tiers = getTiers(pricing);

  const update = (next: PriceTier[]) => {
    const min = minPriceFromTiers(next);
    onChange({ ...pricing, tiers: next, from: min ?? undefined });
  };

  const setRow = (i: number, patch: Partial<PriceTier>) => {
    const next = tiers.map((t, idx) => (idx === i ? { ...t, ...patch } : t));
    update(next);
  };

  const add = () => update([...tiers, { label: "", price: "", unit: "BYN", note: "" }]);
  const remove = (i: number) => update(tiers.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Таблица цен</Label>
        <Button type="button" size="sm" variant="outline" onClick={add}>
          <Plus className="h-3.5 w-3.5 mr-1" />Строка
        </Button>
      </div>

      {tiers.length === 0 ? (
        <div className="text-xs text-muted-foreground rounded-lg border border-dashed border-border/60 p-4 text-center">
          Нет цен — нажмите «Строка», чтобы добавить позицию
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border/50">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Название</th>
                <th className="text-left px-3 py-2 font-medium w-32">Цена</th>
                <th className="text-left px-3 py-2 font-medium w-28">Ед.</th>
                <th className="text-left px-3 py-2 font-medium">Примечание</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {tiers.map((t, i) => (
                <tr key={i} className="border-t border-border/40">
                  <td className="px-2 py-1.5">
                    <Input
                      value={t.label ?? ""}
                      onChange={(e) => setRow(i, { label: e.target.value })}
                      placeholder="Напр. Стандарт"
                      className="h-8"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      type="number"
                      inputMode="numeric"
                      value={t.price === "" || t.price == null ? "" : t.price}
                      onChange={(e) => {
                        const v = e.target.value;
                        setRow(i, { price: v === "" ? "" : Number(v) });
                      }}
                      placeholder="0"
                      className="h-8"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      value={t.unit ?? ""}
                      onChange={(e) => setRow(i, { unit: e.target.value })}
                      placeholder="BYN / час / шт."
                      className="h-8"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      value={t.note ?? ""}
                      onChange={(e) => setRow(i, { note: e.target.value })}
                      placeholder="до 50 гостей"
                      className="h-8"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => remove(i)}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      title="Удалить строку"
                      aria-label="Удалить строку"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        «Цена от» рассчитывается автоматически как минимум из заполненных строк.
      </p>
    </div>
  );
}

export function PriceTableView({
  pricing,
  selectable = false,
  selectedIndex = null,
  onSelect,
}: {
  pricing: unknown;
  selectable?: boolean;
  selectedIndex?: number | null;
  onSelect?: (i: number, tier: PriceTier) => void;
}) {
  const tiers = getTiers(pricing);
  if (tiers.length === 0) return null;
  // Mark the middle tier as "Популярный выбор" when there are 3+ tiers
  const popularIndex = tiers.length >= 3 ? Math.floor(tiers.length / 2) : -1;
  return (
    <div className="overflow-hidden rounded-lg border border-border/40">
      <table className="w-full text-sm">
        <tbody>
          {tiers.map((t, i) => {
            const price = Number(t.price);
            const hasPrice = Number.isFinite(price) && price > 0;
            const unit = (t.unit ?? "").trim();
            const showCurrency = !unit || /byn/i.test(unit);
            const isSelected = selectable && selectedIndex === i;
            const isPopular = i === popularIndex;
            const rowClass = selectable
              ? `cursor-pointer transition ${isSelected ? "bg-primary/15 ring-1 ring-primary/50" : "hover:bg-muted/40"}`
              : "";
            const handle = () => selectable && onSelect?.(i, t);
            return (
              <tr
                key={i}
                className={`border-t border-border/30 first:border-t-0 ${rowClass} ${isPopular && !isSelected ? "bg-accent/5" : ""}`}
                onClick={handle}
                onKeyDown={(e) => {
                  if (selectable && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    handle();
                  }
                }}
                role={selectable ? "button" : undefined}
                tabIndex={selectable ? 0 : undefined}
                aria-pressed={selectable ? isSelected : undefined}
              >
                {selectable && (
                  <td className="pl-3 pr-1 py-2 w-6 align-middle">
                    <span
                      aria-hidden
                      className={`inline-block h-3.5 w-3.5 rounded-full border ${isSelected ? "bg-primary border-primary" : "border-muted-foreground/50"}`}
                    />
                  </td>
                )}
                <td className="px-3 py-2">
                  <div className="font-medium flex items-center gap-2 flex-wrap">
                    <span>{t.label || "—"}</span>
                    {isPopular && (
                      <span className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-accent/20 text-accent border border-accent/30">
                        Популярный
                      </span>
                    )}
                  </div>
                  {t.note && <div className="text-xs text-muted-foreground mt-0.5">{t.note}</div>}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap font-semibold">
                  {hasPrice ? (
                    showCurrency ? (
                      <>
                        {fmt(price)}
                        {unit && !/byn/i.test(unit) ? <span className="text-xs font-normal text-muted-foreground"> / {unit}</span> : null}
                      </>
                    ) : (
                      <>
                        {price.toLocaleString("ru-BY")}
                        <span className="text-xs font-normal text-muted-foreground"> {unit}</span>
                      </>
                    )
                  ) : (
                    <span className="text-muted-foreground font-normal">по запросу</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

