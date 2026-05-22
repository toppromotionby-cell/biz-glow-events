import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Post = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string | null;
  cover_url: string | null;
  tags: string[] | null;
  published_at: string | null;
  seo_title: string | null;
  seo_description: string | null;
};

export const Route = createFileRoute("/blog/$slug")({
  component: BlogPostPage,
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug} — блог event-hub.by` },
      { name: "robots", content: "index,follow" },
    ],
  }),
  notFoundComponent: () => (
    <div className="container mx-auto px-4 py-20 text-center">
      <h1 className="text-3xl font-display font-bold">Запись не найдена</h1>
      <Link to="/blog" className="mt-4 inline-block text-primary hover:underline">← Ко всем записям</Link>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="container mx-auto px-4 py-20 text-center text-muted-foreground">
      Ошибка загрузки: {String(error?.message ?? error)}
    </div>
  ),
});

function BlogPostPage() {
  const { slug } = Route.useParams();
  const [post, setPost] = useState<Post | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "404">("loading");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("slug", slug)
        .eq("published", true)
        .maybeSingle();
      if (!data) { setState("404"); return; }
      setPost(data as Post);
      setState("ok");
      if (data.seo_title || data.title) document.title = (data.seo_title ?? data.title) + " — event-hub.by";
    })();
  }, [slug]);

  if (state === "loading") return <div className="container mx-auto px-4 py-16 text-muted-foreground">Загрузка...</div>;
  if (state === "404" || !post) {
    throw notFound();
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt ?? post.seo_description ?? undefined,
    image: post.cover_url ?? undefined,
    datePublished: post.published_at ?? undefined,
    author: { "@type": "Organization", name: "event-hub.by" },
  };

  return (
    <article className="container mx-auto px-4 py-12 max-w-3xl">
      <Link to="/blog" className="text-sm text-muted-foreground hover:text-foreground">← Ко всем записям</Link>

      <header className="mt-6 mb-8">
        {post.published_at && (
          <div className="text-xs uppercase tracking-wide text-primary mb-2">
            {new Date(post.published_at).toLocaleDateString("ru-BY", { day: "numeric", month: "long", year: "numeric" })}
          </div>
        )}
        <h1 className="text-3xl md:text-4xl font-display font-bold leading-tight gradient-text">{post.title}</h1>
        {post.excerpt && <p className="mt-4 text-lg text-muted-foreground">{post.excerpt}</p>}
        {post.tags && post.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {post.tags.map((t) => (
              <span key={t} className="text-xs px-2.5 py-1 rounded-full border border-border/50 text-muted-foreground">#{t}</span>
            ))}
          </div>
        )}
      </header>

      {post.cover_url && (
        <div className="rounded-2xl overflow-hidden mb-8 glass">
          <img src={post.cover_url} alt={post.title} className="w-full h-auto" />
        </div>
      )}

      {post.body && (
        <div className="prose prose-invert max-w-none whitespace-pre-wrap text-foreground/90 leading-relaxed">
          {post.body}
        </div>
      )}

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </article>
  );
}
