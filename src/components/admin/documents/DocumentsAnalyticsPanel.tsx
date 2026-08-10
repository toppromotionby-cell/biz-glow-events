// Этап 4: мини-аналитика по документам и напоминания.
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Clock, TrendingUp } from "lucide-react";
import { fmtMoney } from "@/lib/formatters";
import { getDocumentsAnalytics } from "@/lib/documents-analytics.functions";

export function DocumentsAnalyticsPanel() {
  const fn = useServerFn(getDocumentsAnalytics);
  const { data, isLoading } = useQuery({ queryKey: ["documents-analytics"], queryFn: () => fn() });

  if (isLoading) return <div className="p-6 text-center text-muted-foreground">Загрузка…</div>;
  if (!data) return null;
  const s = data.stats;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Конверсия КП → согласовано" value={`${s.conversion}%`} hint={`${s.quotesAccepted} из ${s.quotesSent} отправленных`} />
        <Metric label="Средний чек" value={fmtMoney(s.avgCheck)} hint={`Выручка по согласованным ${fmtMoney(s.revenueAccepted)}`} />
        <Metric label="Маржинальность позиций" value={`${s.margin}%`} hint={`Прибыль ${fmtMoney(s.marginProfit)}`} />
        <Metric label="Неоплаченные счета" value={String(s.invoicesUnpaid)} hint={`На сумму ${fmtMoney(s.invoicesUnpaidSum)}`} />
      </div>

      <div className="rounded-xl border border-border/60">
        <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3 text-sm font-medium">
          <Clock className="h-4 w-4 text-primary" />Напоминания
          <span className="text-xs text-muted-foreground">{data.reminders.length}</span>
        </div>
        {!data.reminders.length && (
          <div className="p-8 text-center text-muted-foreground">Всё под контролем — напоминаний нет</div>
        )}
        <ul className="divide-y divide-border/50">
          {data.reminders.map((r, i) => (
            <li key={`${r.kind}-${r.id}-${i}`} className="flex items-start gap-3 px-4 py-3">
              {r.severity === "danger"
                ? <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
                : <TrendingUp className="mt-0.5 h-4 w-4 text-muted-foreground" />}
              <div>
                <div className="text-sm font-medium">{r.title}</div>
                <div className="text-xs text-muted-foreground">{r.detail}</div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-border/60 p-4">
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-[11px] text-muted-foreground/80">{hint}</div>
    </div>
  );
}
