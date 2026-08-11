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

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-border/60">
          <div className="border-b border-border/60 px-4 py-3 text-sm font-medium">Топ позиций в сметах</div>
          {!data.insights.topItems.length && (
            <div className="p-6 text-center text-sm text-muted-foreground">Пока нет данных по позициям</div>
          )}
          <ul className="divide-y divide-border/50">
            {data.insights.topItems.map((it) => (
              <li key={it.title} className="flex items-center gap-3 px-4 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{it.title}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {it.section} · включают в {it.includeRate}% смет
                  </span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">×{it.count}</span>
                <span className="w-24 shrink-0 text-right text-sm tabular-nums">{fmtMoney(it.amount)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-3">
          <div className="rounded-xl border border-border/60">
            <div className="border-b border-border/60 px-4 py-3 text-sm font-medium">Разделы по объёму</div>
            {!data.insights.topSections.length && (
              <div className="p-6 text-center text-sm text-muted-foreground">Нет данных</div>
            )}
            <ul className="divide-y divide-border/50">
              {data.insights.topSections.map((s2) => (
                <li key={s2.section} className="flex items-center gap-3 px-4 py-2">
                  <span className="min-w-0 flex-1 truncate text-sm">{s2.section}</span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">×{s2.count}</span>
                  <span className="w-24 shrink-0 text-right text-sm tabular-nums">{fmtMoney(s2.amount)}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-border/60">
            <div className="border-b border-border/60 px-4 py-3 text-sm font-medium">Чаще всего исключают</div>
            {!data.insights.mostExcluded.length && (
              <div className="p-6 text-center text-sm text-muted-foreground">Все позиции идут в итог</div>
            )}
            <ul className="divide-y divide-border/50">
              {data.insights.mostExcluded.map((it) => (
                <li key={it.title} className="flex items-center gap-3 px-4 py-2">
                  <span className="min-w-0 flex-1 truncate text-sm">{it.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    в итоге {it.includeRate}% · ×{it.count}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
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
