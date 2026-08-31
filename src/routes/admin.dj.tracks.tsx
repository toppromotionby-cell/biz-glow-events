// Админка DJ: библиотека треков с модерацией и удалением.
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Search, Trash2, X } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { djAdminDeleteTrack, djAdminModerateTrack, djAdminTracks } from "@/lib/dj/dj-admin.functions";
import { CONTENT_STATUS_LABEL, type DjContentStatus } from "@/lib/dj/types";

export const Route = createFileRoute("/admin/dj/tracks")({
  component: Page,
});

const STATUSES: (DjContentStatus | "all")[] = ["all", "pending", "published", "rejected", "draft"];

function Page() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<DjContentStatus | "all">("all");
  const [page, setPage] = useState(1);
  const params = { q: q || undefined, status, page, pageSize: 25 };

  const { data, isLoading } = useQuery({
    queryKey: ["dj", "admin", "tracks", params],
    queryFn: () => djAdminTracks({ data: params }),
    placeholderData: (prev) => prev,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["dj", "admin"] });

  const moderate = useMutation({
    mutationFn: (v: { id: string; status: DjContentStatus }) => djAdminModerateTrack({ data: v }),
    onSuccess: () => { toast.success("Статус обновлён"); void refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => djAdminDeleteTrack({ data: { id } }),
    onSuccess: () => { toast.success("Трек удалён"); void refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / 25));

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Библиотека треков" subtitle={`Всего записей: ${total}`} />

      <div className="glass grid gap-3 rounded-2xl p-4 sm:grid-cols-[1fr_200px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Артист или название" className="pl-9" aria-label="Поиск треков" />
        </div>
        <Select value={status} onValueChange={(v) => { setStatus(v as DjContentStatus | "all"); setPage(1); }}>
          <SelectTrigger aria-label="Статус"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{s === "all" ? "Все статусы" : CONTENT_STATUS_LABEL[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (data?.items.length ?? 0) === 0 ? (
        <div className="glass rounded-2xl p-12 text-center text-muted-foreground">Ничего не найдено.</div>
      ) : (
        <ul className="space-y-2">
          {data?.items.map((t) => (
            <li key={t.id} className="glass flex flex-col gap-3 rounded-xl p-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{t.artist} — {t.title}</p>
                <p className="text-xs text-muted-foreground">
                  {t.genre ?? "—"} · {t.bpm ?? "—"} BPM · {t.key_camelot ?? "—"} · ▶ {t.play_count} · ↓ {t.download_count}
                </p>
              </div>
              <Badge variant={t.status === "published" ? "default" : "secondary"} className="w-fit font-normal">
                {CONTENT_STATUS_LABEL[t.status]}
              </Badge>
              <div className="flex gap-2">
                {t.status !== "published" && (
                  <Button size="sm" onClick={() => moderate.mutate({ id: t.id, status: "published" })}>
                    <Check className="mr-1 h-4 w-4" /> Опубликовать
                  </Button>
                )}
                {t.status !== "rejected" && (
                  <Button size="sm" variant="outline" onClick={() => moderate.mutate({ id: t.id, status: "rejected" })}>
                    <X className="mr-1 h-4 w-4" /> Скрыть
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Удалить трек"
                  onClick={() => { if (window.confirm("Удалить трек вместе с файлом?")) remove.mutate(t.id); }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Назад</Button>
          <span className="text-sm text-muted-foreground">{page} / {pages}</span>
          <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)}>Вперёд</Button>
        </div>
      )}
    </div>
  );
}
