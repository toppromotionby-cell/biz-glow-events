import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { listCases } from "@/lib/cases.functions";
import { MapPin, Users, Calendar } from "lucide-react";
import { MediaCard } from "@/components/ui/MediaCard";
import { PaginationControls, type PerPage } from "@/components/ui/PaginationControls";

const casesQuery = queryOptions({
  queryKey: ["cases", "all"],
  queryFn: () => listCases({ data: {} }),
});

export const Route = createFileRoute("/cases")({
  loader: ({ context }) => context.queryClient.ensureQueryData(casesQuery),
  head: () => ({
    meta: [
      { title: "Кейсы и портфолио — event-hub.by" },
      { name: "description", content: "Реализованные мероприятия event-hub.by в Минске: корпоративы, конференции, презентации, фестивали." },
      { property: "og:title", content: "Кейсы event-hub.by" },
      { property: "og:description", content: "Прошедшие мероприятия: технический продакшн, интерактивные зоны, шоу." },
    ],
  }),
  component: CasesPage,
});

function CasesPage() {
  const { data: cases } = useSuspenseQuery(casesQuery);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<PerPage>(30);
  useEffect(() => { setPage(1); }, [perPage]);
  const paged = cases.slice((page - 1) * perPage, page * perPage);
  return (
    <div className="page-shell py-12 max-w-6xl">
      <header className="mb-10">
        <h1 className="text-4xl md:text-5xl font-display font-bold gradient-text">Кейсы и портфолио</h1>
        <p className="mt-3 text-muted-foreground max-w-2xl">Реальные мероприятия, реализованные командой event-hub.by — от корпоративов на 100 человек до фестивалей на 5000.</p>
      </header>

      {cases.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center text-muted-foreground">Скоро здесь появятся наши работы.</div>
      ) : (
        <>
        <ul className="grid md:grid-cols-2 gap-6">
          {paged.map((c) => (
            <li key={c.id}>
              <MediaCard
                cover={c.cover_url}
                alt={c.title}
                rounded="2xl"
                to="/cases/$slug"
                params={{ slug: c.slug }}
              >
                {c.event_type && <div className="text-xs uppercase tracking-wide text-primary">{c.event_type}</div>}
                <h2 className="mt-1 text-xl font-display font-semibold">{c.title}</h2>
                {c.summary && <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{c.summary}</p>}
                <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
                  {c.event_date && <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{new Date(c.event_date).toLocaleDateString("ru-BY", { year: "numeric", month: "long" })}</span>}
                  {c.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{c.location}</span>}
                  {c.guests_count && <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{c.guests_count.toLocaleString("ru-BY")} гостей</span>}
                </div>
              </MediaCard>
            </li>
          ))}
        </ul>
        <PaginationControls
          total={cases.length}
          page={page}
          perPage={perPage}
          onPageChange={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); }}
          onPerPageChange={setPerPage}
        />
        </>
      )}
    </div>
  );
}


