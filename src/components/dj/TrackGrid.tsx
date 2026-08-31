// Плиточное отображение библиотеки: те же действия, что и в списке.
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { TrackCard } from "@/components/dj/TrackCard";
import { useDjPlayer } from "@/components/dj/player";
import { djDownloadTrack, djRate, djToggleFavorite } from "@/lib/dj/dj.functions";
import type { DjTrack } from "@/lib/dj/types";

export function TrackGrid({ tracks, invalidateKey }: { tracks: DjTrack[]; invalidateKey: unknown[] }) {
  const { current, playing, play, toggle } = useDjPlayer();
  const qc = useQueryClient();
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
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {tracks.map((t) => (
        <TrackCard
          key={t.id}
          track={t}
          isCurrent={current?.id === t.id}
          isPlaying={playing}
          busy={busy === t.id}
          actions={{
            onPlay: () => (current?.id === t.id ? toggle() : play(t, tracks)),
            onToggleFavorite: () => favorite.mutate(t.id),
            onRate: (value) => rate.mutate({ id: t.id, value }),
            onDownload: () => void download(t),
          }}
        />
      ))}
    </div>
  );
}
