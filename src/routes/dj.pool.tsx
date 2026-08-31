// Закрытая библиотека треков DJ-клуба.
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, LayoutGrid, Rows3 } from "lucide-react";
import { MemberGate, useDjAccess } from "@/components/dj/MemberGate";
import { TrackFilters } from "@/components/dj/TrackFilters";
import { TrackList } from "@/components/dj/TrackList";
import { TrackGrid } from "@/components/dj/TrackGrid";
import { UploadTrackDialog } from "@/components/dj/UploadTrackDialog";
import { Button } from "@/components/ui/button";
import { djListTracks } from "@/lib/dj/dj.functions";
import type { DjTrackFilters } from "@/lib/dj/types";

/** URL — единственный источник правды для фильтров: ссылками можно делиться. */
const poolSearchSchema = z.object({
  section: z.string().optional(),
  category: z.string().optional(),
  format: z.string().optional(),
  q: z.string().optional(),
  genre: z.string().optional(),
  version: z.string().optional(),
  key: z.string().optional(),
  remix: z.enum(["only", "exclude"]).optional(),
  sort: z.enum(["new", "popular", "rating", "bpm", "az"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
});
export type DjPoolSearch = z.infer<typeof poolSearchSchema>;

export const Route = createFileRoute("/dj/pool")({
  ssr: false,
  validateSearch: poolSearchSchema,
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
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/dj/pool" });

  const filters: DjTrackFilters = {
    section: search.section as DjTrackFilters["section"],
    categoryId: search.category,
    formatSlug: search.format,
    q: search.q,
    genres: search.genre ? search.genre.split(",").filter(Boolean) : undefined,
    version: search.version,
    key: search.key,
    remix: search.remix,
    sort: search.sort ?? "new",
    page: search.page ?? 1,
    pageSize: 24,
  };

  // Двусторонняя синхронизация: любое изменение фильтра пишется в URL.
  const setFilters = useCallback(
    (next: DjTrackFilters) => {
      void navigate({
        search: {
          section: next.section || undefined,
          category: next.categoryId || undefined,
          format: next.formatSlug || undefined,
          q: next.q || undefined,
          genre: next.genres?.length ? next.genres.join(",") : undefined,
          version: next.version || undefined,
          key: next.key || undefined,
          remix: next.remix,
          sort: next.sort && next.sort !== "new" ? next.sort : undefined,
          page: next.page && next.page > 1 ? next.page : undefined,
        } satisfies DjPoolSearch,
        replace: true,
      });
    },
    [navigate],
  );
  const [view, setView] = useState<"grid" | "list">("grid");
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
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border/70 p-0.5" role="group" aria-label="Вид библиотеки">
            <Button
              size="icon" variant={view === "grid" ? "secondary" : "ghost"} className="h-8 w-8"
              onClick={() => setView("grid")} aria-label="Плитками" aria-pressed={view === "grid"}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              size="icon" variant={view === "list" ? "secondary" : "ghost"} className="h-8 w-8"
              onClick={() => setView("list")} aria-label="Списком" aria-pressed={view === "list"}
            >
              <Rows3 className="h-4 w-4" />
            </Button>
          </div>
          {access?.isTrusted && <UploadTrackDialog invalidateKey={["dj", "tracks"]} />}
        </div>
      </header>

      <TrackFilters value={filters} onChange={setFilters} />

      <div className="mt-6">
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          view === "grid" ? (
            <TrackGrid tracks={data?.items ?? []} invalidateKey={["dj", "tracks"]} />
          ) : (
            <TrackList tracks={data?.items ?? []} invalidateKey={["dj", "tracks"]} />
          )
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
