// Детали email-кампании: превью, запуск, журнал получателей.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCampaign, startCampaign, refreshCampaignStats } from "@/lib/campaigns.functions";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Send, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/newsletter/campaigns/$id")({ component: Page });

function Page() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const get = useServerFn(getCampaign);
  const start = useServerFn(startCampaign);
  const refresh = useServerFn(refreshCampaignStats);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-campaign", id],
    queryFn: () => get({ data: { id } }),
    refetchInterval: (q) => (q.state.data?.campaign?.status === "sending" ? 3000 : false),
  });

  const launch = useMutation({
    mutationFn: () => start({ data: { id } }),
    onSuccess: (r: any) => {
      toast.success(`Запущена отправка: ${r.total} получателей${r.suppressed ? `, ${r.suppressed} в чёрном списке` : ""}`);
      qc.invalidateQueries({ queryKey: ["admin-campaign", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const refreshStats = useMutation({
    mutationFn: () => refresh({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-campaign", id] }),
  });

  if (isLoading || !data) return <div className="p-8 text-center text-muted-foreground">Загрузка...</div>;

  const { campaign, recipients } = data;
  const stats = {
    pending: recipients.filter((r: any) => r.status === "pending").length,
    sent: recipients.filter((r: any) => r.status === "sent").length,
    failed: recipients.filter((r: any) => r.status === "failed").length,
    suppressed: recipients.filter((r: any) => r.status === "suppressed").length,
  };

  return (
    <div className="space-y-5">
      <div>
        <Link to="/admin/newsletter/campaigns" className="text-xs text-muted-foreground hover:underline flex items-center gap-1 mb-1">
          <ArrowLeft className="h-3 w-3" /> К списку кампаний
        </Link>
        <h1 className="text-2xl font-display font-bold">{campaign.subject}</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Статус: <strong>{campaign.status}</strong> · Создана {new Date(campaign.created_at).toLocaleString("ru-RU")}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Всего" value={campaign.total_recipients || recipients.length} />
        <StatCard label="Отправлено" value={stats.sent} color="text-green-600" />
        <StatCard label="Ошибок" value={stats.failed} color="text-red-600" />
        <StatCard label="В чёрном списке" value={stats.suppressed} color="text-yellow-600" />
      </div>

      <div className="flex gap-2">
        {campaign.status === "draft" && (
          <Button onClick={() => { if (confirm(`Запустить отправку? Получатели будут вычислены в момент запуска.`)) launch.mutate(); }} disabled={launch.isPending}>
            <Send className="h-4 w-4 mr-2" />Запустить отправку
          </Button>
        )}
        {(campaign.status === "sending" || campaign.status === "completed") && (
          <Button variant="outline" onClick={() => refreshStats.mutate()}>
            <RefreshCw className="h-4 w-4 mr-2" />Обновить статистику
          </Button>
        )}
      </div>

      <div className="glass rounded-xl p-5">
        <h2 className="font-semibold mb-3">Превью письма</h2>
        <iframe
          sandbox=""
          srcDoc={campaign.html_content}
          title="Email preview"
          className="w-full h-[500px] border rounded bg-white"
        />
      </div>

      {recipients.length > 0 && (
        <div className="glass rounded-xl overflow-hidden">
          <div className="p-3 border-b border-border/40 text-sm font-medium">Получатели ({recipients.length})</div>
          <div className="max-h-[400px] overflow-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/30 text-left sticky top-0">
                <tr>
                  <th className="p-2 font-medium">Email</th>
                  <th className="p-2 font-medium">Статус</th>
                  <th className="p-2 font-medium">Ошибка</th>
                </tr>
              </thead>
              <tbody>
                {recipients.slice(0, 500).map((r: any) => (
                  <tr key={r.id} className="border-t border-border/40">
                    <td className="p-2">{r.email}</td>
                    <td className="p-2">{r.status}</td>
                    <td className="p-2 text-red-600">{r.error ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="glass rounded-xl p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold ${color ?? ""}`}>{value}</div>
    </div>
  );
}
