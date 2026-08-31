import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { getCase } from "@/lib/cases.functions";
import { buildCaseEventJsonLd, safeJsonLd } from "@/lib/seo-jsonld";
import { MediaShield } from "@/components/MediaShield";
import { MapPin, Users, Calendar, Building2 } from "lucide-react";

const caseQuery = (slug: string) => queryOptions({
  queryKey: ["case", slug],
  queryFn: () => getCase({ data: { slug } }),
});

export const Route = createFileRoute("/cases/$slug")({
  loader: async ({ params, context }) => {
    const item = await context.queryClient.ensureQueryData(caseQuery(params.slug));
    if (!item) throw notFound();
    return { item };
  },
  head: ({ loaderData, params }) => {
    const c = loaderData?.item;
    if (!c) return { meta: [{ title: "Кейс — event-hub.by" }] };
    const url = `https://event-hub.by/cases/${params.slug}`;
    const eventLd = buildCaseEventJsonLd({
      title: c.title,
      slug: params.slug,
      summary: c.summary,
      description: c.description,
      cover_url: c.cover_url,
      event_date: c.event_date,
      location: c.location,
      client: c.client,
    });
    return {
      meta: [
        { title: c.seo_title ?? `${c.title} — кейс event-hub.by` },
        { name: "description", content: c.seo_description ?? c.summary ?? `Реализованный проект ${c.title}.` },
        { property: "og:title", content: c.title },
        { property: "og:description", content: c.summary ?? "" },
        { property: "og:type", content: "article" },
        ...(c.cover_url ? [{ property: "og:image", content: c.cover_url }] : []),
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [{ type: "application/ld+json", children: safeJsonLd(eventLd) }],
    };
  },
  component: CasePage,
  notFoundComponent: () => (
    <div className="page-shell section-y text-center">
      <h1 className="text-2xl font-display font-semibold">Кейс не найден</h1>
      <Link to="/cases" className="mt-4 inline-block text-primary underline">Все кейсы</Link>
    </div>
  ),
});

function CasePage() {
  const { slug } = Route.useParams();
  const { data: c } = useSuspenseQuery(caseQuery(slug));
  if (!c) return null;
  const metrics = c.metrics && typeof c.metrics === "object" ? Object.entries(c.metrics as Record<string, unknown>) : [];

  return (
    <article className="page-shell py-10 max-w-5xl">
      <Link to="/cases" className="text-sm text-muted-foreground hover:text-foreground">← Все кейсы</Link>

      <header className="mt-6">
        {c.event_type && <div className="text-xs uppercase tracking-wide text-primary">{c.event_type}</div>}
        <h1 className="mt-2 text-4xl md:text-5xl font-display font-bold gradient-text">{c.title}</h1>
        {c.summary && <p className="mt-3 text-lg text-muted-foreground max-w-3xl">{c.summary}</p>}
        <div className="mt-5 flex flex-wrap gap-4 text-sm text-muted-foreground">
          {c.client && <span className="inline-flex items-center gap-1.5"><Building2 className="h-4 w-4" />{c.client}</span>}
          {c.event_date && <span className="inline-flex items-center gap-1.5"><Calendar className="h-4 w-4" />{new Date(c.event_date).toLocaleDateString("ru-BY", { day: "numeric", month: "long", year: "numeric" })}</span>}
          {c.location && <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" />{c.location}</span>}
          {c.guests_count && <span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4" />{c.guests_count.toLocaleString("ru-BY")} гостей</span>}
        </div>
      </header>

      {c.cover_url && (
        <MediaShield className="mt-8 rounded-2xl overflow-hidden aspect-[16/9] glass">
          <img src={c.cover_url} alt={c.title} className="h-full w-full object-cover" loading="eager" decoding="async" fetchPriority="high" width={1280} height={720} />
        </MediaShield>
      )}

      {metrics.length > 0 && (
        <section className="mt-10 grid sm:grid-cols-2 md:grid-cols-4 gap-3">
          {metrics.map(([k, v]) => (
            <div key={k} className="glass rounded-xl p-5">
              <div className="text-2xl font-display font-bold gradient-text">{String(v)}</div>
              <div className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{k.replace(/_/g, " ")}</div>
            </div>
          ))}
        </section>
      )}

      {c.description && (
        <section className="mt-10 prose prose-invert max-w-3xl">
          <h2 className="text-2xl font-display font-semibold">О проекте</h2>
          <p className="whitespace-pre-wrap text-foreground/90">{c.description}</p>
        </section>
      )}

      {c.services_used && c.services_used.length > 0 && (
        <section className="mt-10 max-w-3xl">
          <h2 className="text-xl font-display font-semibold mb-4">Что мы использовали</h2>
          <ul className="flex flex-wrap gap-2">
            {c.services_used.map(s => <li key={s} className="rounded-full border border-primary/40 px-4 py-1.5 text-sm">{s}</li>)}
          </ul>
        </section>
      )}

      {c.photo_urls && c.photo_urls.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-display font-semibold mb-4">Галерея</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {c.photo_urls.map((p, i) => (
              <MediaShield key={p} className="aspect-[4/3] rounded-xl overflow-hidden glass">
                <img src={p} alt={`${c.title} — фото ${i + 1}`} loading="lazy" decoding="async" width={640} height={400} className="h-full w-full object-cover" />
              </MediaShield>
            ))}
          </div>
        </section>
      )}

      <div className="mt-12 glass rounded-2xl p-8 text-center">
        <h2 className="text-2xl font-display font-semibold">Хотите похожее мероприятие?</h2>
        <p className="mt-2 text-muted-foreground">Расскажите о своей задаче — подберём решение и пришлём смету.</p>
        <Link to="/contacts" className="mt-5 inline-flex rounded-md bg-gradient-primary px-6 py-3 text-sm font-medium text-primary-foreground glow-primary">Обсудить проект</Link>
      </div>
    </article>
  );
}
