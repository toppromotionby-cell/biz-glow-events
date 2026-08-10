// Липкая панель итогов промо-КП: скидка, комиссия, НДС, маржа.
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { formatMoney, type PromoQuote, type PromoTotals } from "@/lib/promo-quote-model";

export function PromoTotalsPanel({
  quote, totals, showMargin,
}: {
  quote: PromoQuote;
  totals: PromoTotals;
  showMargin: boolean;
}) {
  const c = quote.currency;
  return (
    <div className="rounded-xl border border-border bg-card p-3 text-sm">
      <Line label="Позиции" value={formatMoney(totals.itemsSum, c)} />
      {quote.commission_enabled && (
        <Line label={`${quote.commission_label} ${quote.commission_rate}%`} value={formatMoney(totals.commission, c)} />
      )}
      {quote.management_enabled && <Line label={quote.management_label} value={formatMoney(totals.management, c)} />}
      {totals.discount > 0 && (
        <Line
          label={`Скидка${quote.discount_type === "percent" ? ` ${quote.discount_value}%` : ""}`}
          value={`− ${formatMoney(totals.discount, c)}`}
          tone="accent"
        />
      )}
      <Separator className="my-2" />
      <Line label={totals.vatEnabled ? "Стоимость позиций (без НДС)" : "Всего"} value={formatMoney(totals.net, c)} />
      {totals.vatEnabled && <Line label={`НДС ${totals.vatRate}%`} value={formatMoney(totals.vat, c)} />}
      <div className="mt-2 flex items-baseline justify-between">
        <span className="font-semibold">Итого</span>
        <span className="text-lg font-semibold tabular-nums">{formatMoney(totals.totalWithVat, c)}</span>
      </div>

      {showMargin && totals.costSum > 0 && (
        <div className="mt-3 rounded-lg bg-muted/40 p-2">
          <Line label="Себестоимость" value={formatMoney(totals.costSum, c)} />
          <Line label="Маржа" value={`${formatMoney(totals.margin, c)} · ${totals.marginPct}%`} />
          <Progress value={Math.max(0, Math.min(100, totals.marginPct))} className="mt-2 h-1.5" />
        </div>
      )}
    </div>
  );
}

function Line({ label, value, tone }: { label: string; value: string; tone?: "accent" }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums ${tone === "accent" ? "text-primary" : ""}`}>{value}</span>
    </div>
  );
}
