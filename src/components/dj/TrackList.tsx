// Список треков библиотеки: воспроизведение, рейтинг, избранное, скачивание, комментарии.
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Play, Pause, Download, Heart, Star, MessageSquare, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useDjPlayer } from "@/components/dj/player";
import { CommentsDialog } from "@/components/dj/CommentsDialog";
import { djDownloadTrack, djRate, djToggleFavorite } from "@/lib/dj/dj.functions";
import { formatDuration, TRACK_VERSION_LABEL, type DjTrack, type TrackVersion } from "@/lib/dj/types";

export function TrackList({ tracks, invalidateKey }: { tracks: DjTrack[]; invalidateKey: unknown[] }) {
  const { current, playing, play, toggle } = useDjPlayer();
  const qc = useQueryClient();
  const [commentsFor, setCommentsFor] = useState<DjTrack | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: invalidateKey });

  const favorite = useMutation({
    mutationFn: (id: string) => djToggleFavorite({ data: { id } }),
    onSuccess: () => refresh(),
    onError: (e: Error) => toast.error(e.message),
  });

  const rate = useMutation({
    mutationFn: (v: { id: string; value: number }) => djRate({ data: v }),
    onSuccess: () => { toast.success("Оценка сохранена"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  async function download(track: DjTrack) {
    setBusy(track.id);
    try {
      const { url } = await djDownloadTrack({ data: { id: track.id } });
      const a = document.createElement("a");
      a.href = url;
      a.download = "";
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось скачать файл");
    } finally {
      setBusy(null);
    }
  }

  if (tracks.length === 0) {
    return <div className="glass rounded-2xl p-12 text-center text-muted-foreground">Ничего не найдено — измените фильтры.</div>;
  }

  return (
    <>
      <ul className="space-y-2">
        {tracks.map((t) => {
          const isCurrent = current?.id === t.id;
          return (
            <li
              key={t.id}
              className={cn(
                "glass flex flex-col gap-3 rounded-xl p-3 transition-colors sm:flex-row sm:items-center",
                isCurrent && "ring-1 ring-primary/60",
              )}
            >
              <Button
                size="icon"
                variant={isCurrent ? "default" : "secondary"}
                className="shrink-0"
                onClick={() => (isCurrent ? toggle() : play(t, tracks))}
                aria-label={isCurrent && playing ? "Пауза" : `Слушать ${t.artist} — ${t.title}`}
              >
                {isCurrent && playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>

              {t.artwork_url ? (
                <img src={t.artwork_url} alt="" loading="lazy" className="hidden h-12 w-12 shrink-0 rounded-md object-cover sm:block" />
              ) : null}

              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {t.artist} — {t.title}
                  {t.version !== "original" && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {TRACK_VERSION_LABEL[t.version as TrackVersion] ?? t.version}
                    </span>
                  )}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  {t.genre && <Badge variant="secondary" className="font-normal">{t.genre}</Badge>}
                  {t.bpm && <span>{t.bpm} BPM</span>}
                  {t.key_camelot && <span>· {t.key_camelot}</span>}
                  {t.year && <span>· {t.year}</span>}
                  <span>· {formatDuration(t.duration_sec)}</span>
                  <span>· ▶ {t.play_count}</span>
                  <span>· ↓ {t.download_count}</span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <div className="mr-1 flex items-center" role="group" aria-label="Оценка трека">
                  {[1, 2, 3, 4, 5].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => rate.mutate({ id: t.id, value: v })}
                      aria-label={`Оценить на ${v}`}
                      className="p-0.5 text-muted-foreground transition-colors hover:text-primary"
                    >
                      <Star className={cn("h-3.5 w-3.5", (t.my_rating ?? Math.round(t.rating_avg)) >= v && "fill-primary text-primary")} />
                    </button>
                  ))}
                  <span className="ml-1 text-xs tabular-nums text-muted-foreground">
                    {t.rating_count ? t.rating_avg.toFixed(1) : "—"}
                  </span>
                </div>

                <Button size="icon" variant="ghost" onClick={() => favorite.mutate(t.id)} aria-label="В избранное">
                  <Heart className={cn("h-4 w-4", t.is_favorite && "fill-destructive text-destructive")} />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => setCommentsFor(t)} aria-label="Комментарии">
                  <MessageSquare className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" disabled={busy === t.id} onClick={() => void download(t)} aria-label="Скачать">
                  {busy === t.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      {commentsFor && (
        <CommentsDialog
          open
          onOpenChange={(o) => !o && setCommentsFor(null)}
          targetType="track"
          targetId={commentsFor.id}
          title={`${commentsFor.artist} — ${commentsFor.title}`}
        />
      )}
    </>
  );
}
