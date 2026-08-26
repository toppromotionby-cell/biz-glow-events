// Вкладка «Экономика» документа: себестоимость, маржа, подытоги по разделам.
// Только для внутреннего использования (право documents.cost_margin) —
// в клиентский HTML/PDF и публичную ссылку эти данные не попадают.
import { Fragment, useMemo, useState } from "react";
import { AlertTriangle, Download, EyeOff, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AdminTable } from "@/components/admin/AdminTable";
import {
  buildEconomics,
  marginTone,
  MARGIN_TONE_CLASS,
  type EconInput,
  type Economics,
} from "@/lib/documents/economics";

const fmt = (v: number) =>
  new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);
const pctText = (v: number) => `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(v || 0)}%`;

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 text-lg font-semibold tabular-nums ${tone ?? ""}`}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

const COLUMNS = [
  { key: "title", label: "Позиция" },
  { key: "qty", label: "Кол-во", className: "text-center w-[110px]" },
  { key: "price", label: "Цена", className: "text-right w-[110px]" },
  { key: "cost", label: "Себест./ед.", className: "text-right w-[120px]" },
  { key: "revenue", label: "Выручка", className: "text-right w-[120px]" },
  { key: "costSum", label: "Себестоимость", className: "text-right w-[130px]" },
  { key: "margin", label: "Маржа", className: "text-right w-[120px]" },
  { key: "marginPct", label: "%", className: "text-right w-[90px]" },
];

export function EconomicsPanel({
  docTitle,
  rows,
  netRevenue,
  netLabel = "После скидки и доставки",
}: {
  docTitle: string;
  rows: EconInput[];
  netRevenue?: number;
  netLabel?: string;
}) {
  const econ: Economics = useMemo(() => buildEconomics(rows, { netRevenue }), [rows, netRevenue]);
  const [busy, setBusy] = useState(false);

  const exportXlsx = async () => {
    setBusy(true);
    try {
      const { exportEconomicsXlsx } = await import("@/lib/documents/economics-xlsx.browser");
      await exportEconomicsXlsx(docTitle, econ);
      toast.success("Расчёт выгружен в XLSX");
    } catch (e) {
      toast.error((e as Error).message || "Не удалось выгрузить расчёт");
    } finally {
      setBusy(false);
    }
  };

  const totalTone = MARGIN_TONE_CLASS[marginTone(econ.marginPct, econ.hasAnyCost)];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" />Внутренний расчёт — клиент его не видит</span>
        <Button variant="outline" size="sm" onClick={exportXlsx} disabled={busy || !econ.rows.length}>
          <Download className="mr-1.5 h-4 w-4" />XLSX
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Выручка (позиции)" value={`${fmt(econ.revenue)} BYN`} />
        <Stat label="Себестоимость" value={`${fmt(econ.cost)} BYN`} hint={`Наценка ${pctText(econ.avgMarkupPct)}`} />
        <Stat label="Маржа" value={`${fmt(econ.margin)} BYN`} hint={pctText(econ.marginPct)} tone={totalTone} />
        <Stat
          label="Маржа по итогу"
          value={`${fmt(econ.netMargin)} BYN`}
          hint={`${netLabel} · ${pctText(econ.netMarginPct)}`}
          tone={MARGIN_TONE_CLASS[marginTone(econ.netMarginPct, econ.hasAnyCost)]}
        />
      </div>

      {!!econ.missingCount && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Себестоимость не заполнена у {econ.missingCount} поз. — маржа завышена.
        </div>
      )}

      <AdminTable
        columns={COLUMNS}
        isEmpty={!econ.rows.length}
        emptyText="Добавьте позиции, чтобы увидеть расчёт"
        textSize="xs"
      >
        {econ.sections.map((s) => (
          <Fragment key={s.name}>
            <tr className="bg-muted/40">
              <td className="p-2 font-semibold">{s.name}</td>
              <td colSpan={3} />
              <td className="p-2 text-right tabular-nums">{fmt(s.revenue)}</td>
              <td className="p-2 text-right tabular-nums">{fmt(s.cost)}</td>
              <td className={`p-2 text-right font-semibold tabular-nums ${MARGIN_TONE_CLASS[marginTone(s.marginPct, s.cost > 0)]}`}>
                {fmt(s.margin)}
              </td>
              <td className={`p-2 text-right tabular-nums ${MARGIN_TONE_CLASS[marginTone(s.marginPct, s.cost > 0)]}`}>
                {pctText(s.marginPct)}
              </td>
            </tr>
            {s.rows.map((r) => (
              <tr key={r.id} className={`border-t border-border/40 ${r.excluded ? "opacity-50" : ""}`}>
                <td className="p-2">
                  <span className="line-clamp-2">{r.title || "Без названия"}</span>
                  {r.excluded && (
                    <span className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                      <EyeOff className="h-3 w-3" />не в итоге
                    </span>
                  )}
                </td>
                <td className="p-2 text-center tabular-nums">{r.qtyLabel}</td>
                <td className="p-2 text-right tabular-nums">{fmt(r.price)}</td>
                <td className="p-2 text-right tabular-nums">
                  {fmt(r.unitCost)}
                  {r.costMode === "percent" && <span className="ml-1 text-[11px] text-muted-foreground">{pctText(r.costInput)}</span>}
                </td>
                <td className="p-2 text-right tabular-nums">{fmt(r.revenue)}</td>
                <td className="p-2 text-right tabular-nums">{fmt(r.cost)}</td>
                <td className={`p-2 text-right tabular-nums ${MARGIN_TONE_CLASS[marginTone(r.marginPct, r.hasCost)]}`}>{fmt(r.margin)}</td>
                <td className={`p-2 text-right tabular-nums ${MARGIN_TONE_CLASS[marginTone(r.marginPct, r.hasCost)]}`}>
                  {r.hasCost ? pctText(r.marginPct) : "—"}
                </td>
              </tr>
            ))}
          </Fragment>
        ))}
        <tr className="border-t-2 border-border bg-muted/30 font-semibold">
          <td className="p-2">Итого</td>
          <td colSpan={3} />
          <td className="p-2 text-right tabular-nums">{fmt(econ.revenue)}</td>
          <td className="p-2 text-right tabular-nums">{fmt(econ.cost)}</td>
          <td className={`p-2 text-right tabular-nums ${totalTone}`}>{fmt(econ.margin)}</td>
          <td className={`p-2 text-right tabular-nums ${totalTone}`}>{pctText(econ.marginPct)}</td>
        </tr>
      </AdminTable>
    </div>
  );
}
