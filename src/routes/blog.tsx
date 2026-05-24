import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MediaCard } from "@/components/ui/MediaCard";
import { PaginationControls, type PerPage } from "@/components/ui/PaginationControls";

type Post = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_url: string | null;
  tags: string[] | null;
  published_at: string | null;
};

export const Route = createFileRoute("/blog")({
  head: () => ({
    meta: [
      { title: "Блог о event-индустрии — event-hub.by" },
      { name: "description", content: "Кейсы, тренды и аналитика event-рынка Беларуси: оборудование, организация мероприятий, продакшн." },
      { property: "og:title", content: "Блог event-hub.by" },
      { property: "og:description", content: "Кейсы, тренды и аналитика event-рынка Беларуси." },
      { property: "og:url", content: "https://event-hub.by/blog" },
    ],
    links: [{ rel: "canonical", href: "https://event-hub.by/blog" }],
    scripts: [{
      type: "application/ld+json",
      children: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Blog",
        name: "Блог event-hub.by",
        description: "Кейсы, тренды и аналитика event-рынка Беларуси.",
        url: "https://event-hub.by/blog",
        publisher: { "@type": "Organization", name: "event-hub.by" },
      }),
    }],
  }),
  component: BlogIndex,
});

function BlogIndex() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<PerPage>(30);
  useEffect(() => { setPage(1); }, [perPage]);
  const paged = posts.slice((page - 1) * perPage, page * perPage);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("blog_posts")
        .select("id, slug, title, excerpt, cover_url, tags, published_at")
        .eq("published", true)
        .order("sort_order", { ascending: true })
        .order("published_at", { ascending: false, nullsFirst: false });
      setPosts((data ?? []) as Post[]);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="container mx-auto px-4 py-16 max-w-5xl">
      <header className="mb-10">
        <h1 className="text-4xl md:text-5xl font-display font-bold gradient-text">Блог</h1>
        <p className="mt-3 text-muted-foreground max-w-2xl">Кейсы, разбор оборудования и тренды белорусской event-индустрии.</p>
      </header>

      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5" aria-busy="true" aria-label="Загрузка публикаций">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass rounded-xl overflow-hidden">
              <div className="aspect-[16/10] bg-muted/40 animate-pulse" />
              <div className="p-4 space-y-2">
                <div className="h-4 w-1/3 bg-muted/40 rounded animate-pulse" />
                <div className="h-5 w-4/5 bg-muted/40 rounded animate-pulse" />
                <div className="h-4 w-full bg-muted/30 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="glass rounded-xl p-10 text-center text-muted-foreground">
          Скоро здесь появятся первые публикации.
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {posts.map((p) => (
            <MediaCard
              key={p.id}
              cover={p.cover_url}
              alt={p.title}
              to="/blog/$slug"
              params={{ slug: p.slug }}
            >
              {p.published_at && (
                <div className="text-xs text-muted-foreground mb-1">
                  {new Date(p.published_at).toLocaleDateString("ru-BY", { day: "numeric", month: "long", year: "numeric" })}
                </div>
              )}
              <h2 className="font-display font-semibold leading-tight group-hover:text-primary transition">{p.title}</h2>
              {p.excerpt && <p className="mt-2 text-sm text-muted-foreground line-clamp-3">{p.excerpt}</p>}
              {p.tags && p.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {p.tags.slice(0, 3).map((t) => (
                    <span key={t} className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border border-border/50 text-muted-foreground">{t}</span>
                  ))}
                </div>
              )}
            </MediaCard>
          ))}
        </div>
      )}
    </div>
  );
}

