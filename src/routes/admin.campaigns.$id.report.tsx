// Отчёт по кампании: счётчики + таблица получателей.
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getCampaignReport } from "@/lib/campaigns.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react";
import { AdminTable } from "@/components/admin/AdminTable";
import { fmtDateTime } from "@/lib/formatters";

const STATUS_LABEL: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  pending: { label: "Ожидает", variant: "outline" },
  sent: { label: "Отправлено", variant: "default" },
  failed: { label: "Ошибка", variant: "destructive" },
  skipped: { label: "Пропущено", variant: "secondary" },
};

export const Route = createFileRoute("/admin/campaigns/$id/report")({
  head: () => ({ meta: [{ title: "Отчёт кампании — Админ" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: ReportPage,
});

function ReportPage() {
  const { id } = useParams({ from: "/admin/campaigns/$id/report" });
  const fetchReport = useServerFn(getCampaignReport);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin", "campaign-report", id],
    queryFn: () => fetchReport({ data: { id } }),
    refetchInterval: (q) => {
      const status = q.state.data?.campaign?.status;
      return status === "sending" ? 3000 : false;
    },
  });

  if (isLoading || !data) {
    return <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Загрузка…</div>;
  }
  const { campaign, recipients } = data;
  if (!campaign) return <div>Кампания не найдена</div>;

  const total = campaign.total_recipients || recipients.length;
  const sent = campaign.sent_count;
  const failed = campaign.failed_count;
  const progress = total > 0 ? Math.round(((sent + failed) / total) * 100) : 0;

  return (
    <div className="space-y-5 max-w-5xl">
      <Link to="/admin/campaigns" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        <ArrowLeft className="h-4 w-4" />К списку рассылок
      </Link>

      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="admin-h1">{campaign.name}</h1>
          <p className="text-sm text-muted-foreground">{campaign.subject}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-1 ${isFetching ? "animate-spin" : ""}`} /> Обновить
        </Button>
      </header>

      <div className="grid sm:grid-cols-4 gap-3">
        <Stat label="Всего" value={total} />
        <Stat label="Отправлено" value={sent} color="text-emerald-400" />
        <Stat label="Ошибки" value={failed} color="text-destructive" />
        <Stat label="Прогресс" value={`${progress}%`} />
      </div>

      <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
        <div className="h-full bg-gradient-primary transition-all" style={{ width: `${progress}%` }} />
      </div>

      <AdminTable
        columns={[
          { key: "email", label: "Адрес" },
          { key: "status", label: "Статус" },
          { key: "sent_at", label: "Отправлено" },
          { key: "error", label: "Ошибка" },
        ]}
        isEmpty={recipients.length === 0}
        emptyText="Получателей нет"
      >
        {recipients.map((r) => {
          const s = STATUS_LABEL[r.status] ?? { label: r.status, variant: "outline" as const };
          return (
            <tr key={r.id} className="border-t border-border/40 align-top">
              <td className="px-4 py-2 text-sm">{r.email}</td>
              <td className="px-4 py-2"><Badge variant={s.variant}>{s.label}</Badge></td>
              <td className="px-4 py-2 text-xs text-muted-foreground">{r.sent_at ? fmtDateTime(r.sent_at) : "—"}</td>
              <td className="px-4 py-2 text-xs text-destructive truncate max-w-xs">{r.error ?? ""}</td>
            </tr>
          );
        })}
      </AdminTable>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div className="glass rounded-xl p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${color ?? ""}`}>{value}</div>
    </div>
  );
}
