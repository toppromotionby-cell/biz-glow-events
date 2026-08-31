// Карточка трека для сетки витрины и библиотеки.
import { Play, Pause, Download, Heart, Star, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CoverArt } from "@/components/dj/CoverArt";
import { SECTION_LABEL } from "@/lib/dj/sections";
import { formatDuration, TRACK_VERSION_LABEL, type DjTrack, type TrackVersion } from "@/lib/dj/types";

export type TrackCardActions = {
  onPlay?: () => void;
  onToggleFavorite?: () => void;
  onRate?: (value: number) => void;
  onDownload?: () => void;
};

export function TrackCard({
  track, isCurrent, isPlaying, busy, actions,
}: {
  track: Pick<DjTrack, "id" | "artist" | "title" | "version" | "bpm" | "key_camelot" | "duration_sec" | "rating_avg"> &
    Partial<Pick<DjTrack, "section" | "artwork_url" | "is_favorite" | "my_rating" | "download_count" | "genre">>;
  isCurrent?: boolean;
  isPlaying?: boolean;
  busy?: boolean;
  actions?: TrackCardActions;
}) {
  const versionLabel = TRACK_VERSION_LABEL[track.version as TrackVersion] ?? track.version;

  return (
    <article
      className={cn(
        "dj-ring group relative overflow-hidden rounded-2xl border border-border/60 bg-card/70 transition-transform duration-300 hover:-translate-y-1",
        isCurrent && "dj-neon border-primary/50",
      )}
    >
      <div className="relative aspect-square overflow-hidden">
        <div className="h-full w-full transition-transform duration-500 group-hover:scale-105">
          <CoverArt track={track} rounded="rounded-none" />
        </div>

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/10 to-transparent opacity-80" />

        {track.version !== "original" && (
          <span className="absolute left-2 top-2 rounded-full bg-background/75 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-primary backdrop-blur">
            {versionLabel}
          </span>
        )}
        {track.section && (
          <span className="absolute right-2 top-2 rounded-full bg-background/60 px-2 py-0.5 text-[0.6rem] font-medium text-muted-foreground backdrop-blur">
            {SECTION_LABEL[track.section] ?? track.section}
          </span>
        )}

        {actions?.onPlay && (
          <button
            type="button"
            onClick={actions.onPlay}
            aria-label={isCurrent && isPlaying ? "Пауза" : `Слушать ${track.artist} — ${track.title}`}
            className={cn(
              "absolute bottom-3 right-3 flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-glow transition-all",
              "opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 focus-visible:opacity-100 focus-visible:translate-y-0",
              isCurrent && "opacity-100 translate-y-0",
            )}
          >
            {isCurrent && isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 translate-x-0.5" />}
          </button>
        )}

        {isCurrent && isPlaying && (
          <span className="dj-eq absolute bottom-4 left-3 text-primary" aria-hidden>
            <i /><i /><i /><i />
          </span>
        )}
      </div>

      <div className="space-y-2 p-3">
        <div>
          <p className="truncate text-[0.68rem] font-semibold uppercase tracking-wide text-muted-foreground">
            {track.artist}
          </p>
          <h3 className="truncate text-sm font-bold" title={track.title}>{track.title}</h3>
        </div>

        <div className="flex flex-wrap gap-1 text-[0.62rem] font-medium text-muted-foreground">
          {track.bpm ? <span className="rounded bg-muted/70 px-1.5 py-0.5 tabular-nums">{track.bpm} BPM</span> : null}
          {track.key_camelot ? <span className="rounded bg-muted/70 px-1.5 py-0.5">{track.key_camelot}</span> : null}
          <span className="rounded bg-muted/70 px-1.5 py-0.5 tabular-nums">{formatDuration(track.duration_sec)}</span>
          {track.genre ? <span className="rounded bg-muted/70 px-1.5 py-0.5">{track.genre}</span> : null}
        </div>

        {(actions?.onRate || actions?.onToggleFavorite || actions?.onDownload) && (
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center" role="group" aria-label="Оценка трека">
              {[1, 2, 3, 4, 5].map((v) => (
                <button
                  key={v}
                  type="button"
                  disabled={!actions?.onRate}
                  onClick={() => actions?.onRate?.(v)}
                  aria-label={`Оценить на ${v}`}
                  className="p-0.5 text-muted-foreground transition-colors hover:text-primary disabled:cursor-default"
                >
                  <Star className={cn("h-3.5 w-3.5", (track.my_rating ?? Math.round(track.rating_avg)) >= v && "fill-primary text-primary")} />
                </button>
              ))}
            </div>
            <div className="flex items-center">
              {actions?.onToggleFavorite && (
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={actions.onToggleFavorite} aria-label="В избранное">
                  <Heart className={cn("h-4 w-4", track.is_favorite && "fill-destructive text-destructive")} />
                </Button>
              )}
              {actions?.onDownload && (
                <Button size="icon" variant="ghost" className="h-8 w-8" disabled={busy} onClick={actions.onDownload} aria-label="Скачать">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
