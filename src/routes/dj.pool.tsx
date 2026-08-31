// Закрытая библиотека треков DJ-клуба.
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { MemberGate, useDjAccess } from "@/components/dj/MemberGate";
import { TrackFilters } from "@/components/dj/TrackFilters";
import { TrackList } from "@/components/dj/TrackList";
import { UploadTrackDialog } from "@/components/dj/UploadTrackDialog";
import { Button } from "@/components/ui/button";
import { djListTracks } from "@/lib/dj/dj.functions";
import type { DjTrackFilters } from "@/lib/dj/types";

export const Route = createFileRoute("/dj/pool")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Библиотека треков — DJ Hub event-hub.by" },
      { name: "description", content: "Треки клуба с фильтрами по BPM, тональности Camelot, жанру и версии. Прослушивание и скачивание для участников." },
      { property: "og:title", content: "Библиотека треков DJ Hub" },
      { property: "og:description", content: "Extended, Clean, Intro и мэшапы с метаданными для event-диджеев." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <MemberGate><PoolPage /></MemberGate>,
});

function PoolPage() {
  const { data: access } = useDjAccess();
  const [filters, setFilters] = useState<DjTrackFilters>({ sort: "new", page: 1, pageSize: 24 });
  const key = ["dj", "tracks", filters] as unknown[];

  const { data, isLoading, isFetching } = useQuery({
    queryKey: key,
    queryFn: () => djListTracks({ data: filters }),
    placeholderData: (prev) => prev,
  });

  const total = data?.total ?? 0;
  const pageSize = filters.pageSize ?? 24;
  const page = filters.page ?? 1;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold gradient-text">Библиотека треков</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isLoading ? "Загружаем…" : `Найдено ${total} ${plural(total)}`}
          </p>
        </div>
        {access?.isTrusted && <UploadTrackDialog invalidateKey={["dj", "tracks"]} />}
      </header>

      <TrackFilters value={filters} onChange={setFilters} />

      <div className="mt-6">
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <TrackList tracks={data?.items ?? []} invalidateKey={["dj", "tracks"]} />
        )}
      </div>

      {pages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" disabled={page <= 1 || isFetching} onClick={() => setFilters({ ...filters, page: page - 1 })}>Назад</Button>
          <span className="text-sm text-muted-foreground">{page} / {pages}</span>
          <Button variant="outline" size="sm" disabled={page >= pages || isFetching} onClick={() => setFilters({ ...filters, page: page + 1 })}>Вперёд</Button>
        </div>
      )}
    </div>
  );
}

function plural(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "трек";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "трека";
  return "треков";
}
