// Админка: список подписчиков рассылки + удаление.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listSubscribers, deleteSubscriber } from "@/lib/newsletter.functions";
import { Button } from "@/components/ui/button";
import { Trash2, Download, Mail, Megaphone } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/newsletter")({ component: Page });

function Page() {
  const qc = useQueryClient();
  const fetchList = useServerFn(listSubscribers);
  const del = useServerFn(deleteSubscriber);

  const { data = [], isLoading } = useQuery({
    queryKey: ["admin-newsletter"],
    queryFn: () => fetchList(),
  });

  const remove = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-newsletter"] }); toast.success("Удалён"); },
    onError: (e: Error) => toast.error(e.message),
  });

  function exportCsv() {
    const rows = [["email", "source", "confirmed", "created_at"], ...data.map((r) => [r.email, r.source ?? "", String(r.confirmed), r.created_at])];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `subscribers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-display font-bold gradient-text flex items-center gap-2">
            <Mail className="h-7 w-7" /> Подписчики рассылки
          </h1>
          <p className="text-sm text-muted-foreground">{data.length} записей</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="default">
            <Link to="/admin/newsletter/campaigns"><Megaphone className="h-4 w-4 mr-2" />Кампании</Link>
          </Button>
          <Button onClick={exportCsv} variant="outline" disabled={!data.length}>
            <Download className="h-4 w-4 mr-2" />Экспорт CSV
          </Button>
        </div>
      </header>

      <div className="glass rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Загрузка...</div>
        ) : data.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">Пока нет подписчиков.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-left">
              <tr>
                <th className="p-3 font-medium">Email</th>
                <th className="p-3 font-medium">Источник</th>
                <th className="p-3 font-medium">Дата</th>
                <th className="p-3 font-medium w-12"></th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.id} className="border-t border-border/40">
                  <td className="p-3">{r.email}</td>
                  <td className="p-3 text-muted-foreground">{r.source ?? "—"}</td>
                  <td className="p-3 text-muted-foreground">{new Date(r.created_at).toLocaleDateString("ru-RU")}</td>
                  <td className="p-3">
                    <Button variant="ghost" size="sm" onClick={() => { if (confirm("Удалить?")) remove.mutate(r.id); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
