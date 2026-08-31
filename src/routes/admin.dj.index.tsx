// Админка DJ Хаба: сводка и очередь модерации.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, X, Disc3, Users, Download, MessageSquare } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { djAdminModerateTrack, djAdminQueue, djAdminStats } from "@/lib/dj/dj-admin.functions";

export const Route = createFileRoute("/admin/dj/")({
  component: Page,
});

function Page() {
  const qc = useQueryClient();

  const stats = useQuery({ queryKey: ["dj", "admin", "stats"], queryFn: () => djAdminStats() });
  const queue = useQuery({ queryKey: ["dj", "admin", "queue"], queryFn: () => djAdminQueue() });

  const moderate = useMutation({
    mutationFn: (v: { id: string; status: "published" | "rejected" }) => djAdminModerateTrack({ data: v }),
    onSuccess: () => {
      toast.success("Готово");
      void qc.invalidateQueries({ queryKey: ["dj", "admin"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const s = stats.data;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="DJ Хаб"
        subtitle="Модерация загрузок, участники клуба и статистика закрытого раздела."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} label="Участники" value={sum(s?.members)} hint={`на модерации: ${s?.members?.["pending"] ?? 0}`} />
        <StatCard icon={Disc3} label="Треки" value={sum(s?.tracks)} hint={`ждут проверки: ${s?.tracks?.["pending"] ?? 0}`} />
        <StatCard icon={Download} label="Скачиваний за 7 дней" value={s?.downloads7d ?? 0} />
        <StatCard icon={MessageSquare} label="Комментарии" value={s?.comments ?? 0} />
      </div>

      <section className="glass rounded-2xl p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-medium">Треки на модерации</h2>
          <Button asChild size="sm" variant="outline"><Link to="/admin/dj/tracks">Вся библиотека</Link></Button>
        </div>
        {queue.isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (queue.data?.tracks.length ?? 0) === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Очередь пуста.</p>
        ) : (
          <ul className="space-y-2">
            {queue.data?.tracks.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{t.artist} — {t.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.version} · {new Date(t.created_at).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" disabled={moderate.isPending} onClick={() => moderate.mutate({ id: t.id, status: "published" })}>
                    <Check className="mr-1 h-4 w-4" /> Опубликовать
                  </Button>
                  <Button size="sm" variant="outline" disabled={moderate.isPending} onClick={() => moderate.mutate({ id: t.id, status: "rejected" })}>
                    <X className="mr-1 h-4 w-4" /> Отклонить
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="glass rounded-2xl p-5">
        <h2 className="mb-4 font-medium">Топ треков по скачиваниям</h2>
        {(s?.topTracks.length ?? 0) === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Пока нет данных.</p>
        ) : (
          <ol className="space-y-2">
            {s?.topTracks.map((t, i) => (
              <li key={t.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2 text-sm">
                <span className="truncate"><span className="mr-2 text-muted-foreground">{i + 1}.</span>{t.artist} — {t.title}</span>
                <span className="flex shrink-0 gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary" className="font-normal">↓ {t.download_count}</Badge>
                  <Badge variant="secondary" className="font-normal">★ {t.rating_avg?.toFixed(1) ?? "—"}</Badge>
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function sum(rec?: Record<string, number>): number {
  return Object.values(rec ?? {}).reduce((a, b) => a + b, 0);
}

function StatCard({ icon: Icon, label, value, hint }: { icon: typeof Users; label: string; value: number; hint?: string }) {
  return (
    <div className="glass rounded-2xl p-4">
      <Icon className="h-5 w-5 text-primary" />
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
