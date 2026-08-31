import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { listBlogPosts } from "@/lib/blog.functions";
import { MediaCard } from "@/components/ui/MediaCard";
import { PaginationControls, type PerPage } from "@/components/ui/PaginationControls";

const blogQuery = queryOptions({
  queryKey: ["blog", "list"],
  queryFn: () => listBlogPosts({ data: {} }),
  staleTime: 5 * 60_000,
  gcTime: 30 * 60_000,
});

export const Route = createFileRoute("/blog")({
  loader: ({ context }) => context.queryClient.ensureQueryData(blogQuery),
  head: () => ({
    meta: [
      { title: "Блог о event-индустрии — event-hub.by" },
      {
        name: "description",
        content:
          "Кейсы, тренды и аналитика event-рынка Беларуси: оборудование, организация мероприятий, продакшн.",
      },
      { property: "og:title", content: "Блог event-hub.by" },
      { property: "og:description", content: "Кейсы, тренды и аналитика event-рынка Беларуси." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://event-hub.by/blog" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://event-hub.by/blog" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Blog",
          name: "Блог event-hub.by",
          description: "Кейсы, тренды и аналитика event-рынка Беларуси.",
          url: "https://event-hub.by/blog",
          publisher: { "@type": "Organization", name: "event-hub.by" },
        }),
      },
    ],
  }),
  component: BlogIndex,
});

function BlogIndex() {
  const { data: posts } = useSuspenseQuery(blogQuery);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<PerPage>(30);
  useEffect(() => {
    setPage(1);
  }, [perPage]);
  const paged = posts.slice((page - 1) * perPage, page * perPage);

  return (
    <div className="page-shell section-y max-w-5xl">
      <header className="mb-10">
        <h1 className="text-4xl md:text-5xl font-display font-bold gradient-text">Блог</h1>
        <p className="mt-3 text-muted-foreground max-w-2xl">
          Кейсы, разбор оборудования и тренды белорусской event-индустрии.
        </p>
      </header>

      {posts.length === 0 ? (
        <div className="glass rounded-xl p-10 text-center text-muted-foreground">
          Скоро здесь появятся первые публикации.
        </div>
      ) : (
        <>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {paged.map((p) => (
              <MediaCard
                key={p.id}
                cover={p.cover_url}
                alt={p.title}
                to="/blog/$slug"
                params={{ slug: p.slug }}
              >
                {p.published_at && (
                  <div className="text-xs text-muted-foreground mb-1">
                    {new Date(p.published_at).toLocaleDateString("ru-BY", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </div>
                )}
                <h2 className="font-display font-semibold leading-tight group-hover:text-primary transition">
                  {p.title}
                </h2>
                {p.excerpt && (
                  <p className="mt-2 text-sm text-muted-foreground line-clamp-3">{p.excerpt}</p>
                )}
                {p.tags && p.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {p.tags.slice(0, 3).map((t) => (
                      <span
                        key={t}
                        className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border border-border/50 text-muted-foreground"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </MediaCard>
            ))}
          </div>
          <PaginationControls
            total={posts.length}
            page={page}
            perPage={perPage}
            onPageChange={(p) => {
              setPage(p);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            onPerPageChange={setPerPage}
          />
        </>
      )}
    </div>
  );
}
