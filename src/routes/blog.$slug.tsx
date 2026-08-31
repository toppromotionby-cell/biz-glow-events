import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { getBlogPostBySlug } from "@/lib/blog.functions";
import { buildBlogPostJsonLd, safeJsonLd } from "@/lib/seo-jsonld";

export const Route = createFileRoute("/blog/$slug")({
  loader: async ({ params }) => {
    const { post } = await getBlogPostBySlug({ data: { slug: params.slug } });
    if (!post) throw notFound();
    return { post };
  },
  head: ({ params, loaderData }) => {
    const post = loaderData?.post;
    const title = post ? `${post.seo_title ?? post.title} — event-hub.by` : `Запись — event-hub.by`;
    const desc = post?.seo_description ?? post?.excerpt ?? "Статья блога event-hub.by об event-индустрии Беларуси.";
    const url = `https://event-hub.by/blog/${params.slug}`;
    const image = post?.cover_url ?? undefined;
    const meta: Array<Record<string, string>> = [
      { title },
      { name: "description", content: desc },
      { name: "robots", content: "index,follow" },
      { property: "og:type", content: "article" },
      { property: "og:title", content: post?.title ?? title },
      { property: "og:description", content: desc },
      { property: "og:url", content: url },
      { name: "twitter:title", content: post?.title ?? title },
      { name: "twitter:description", content: desc },
    ];
    if (image) {
      meta.push({ property: "og:image", content: image });
      meta.push({ name: "twitter:image", content: image });
    }
    return {
      meta,
      links: [{ rel: "canonical", href: url }],
      scripts: post
        ? [{
            type: "application/ld+json",
            children: safeJsonLd(buildBlogPostJsonLd({
              title: post.title,
              slug: post.slug,
              excerpt: post.excerpt,
              seo_description: post.seo_description,
              cover_url: post.cover_url,
              published_at: post.published_at,
            })),
          }]
        : [],
    };
  },
  component: BlogPostPage,
  notFoundComponent: () => (
    <div className="page-shell section-y">
      <div className="max-w-md mx-auto text-center border border-border rounded-2xl p-8">
        <h1 className="text-xl font-display font-semibold">Не найдено</h1>
        <Link to="/blog" className="mt-4 inline-block text-sm text-primary hover:underline">← Ко всем записям</Link>
      </div>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="page-shell section-y text-center text-muted-foreground">
      Ошибка загрузки: {String(error?.message ?? error)}
    </div>
  ),
});

function BlogPostPage() {
  const { post } = Route.useLoaderData();

  return (
    <article className="page-shell py-12 max-w-3xl">
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
            {post.tags.map((t: string) => (
              <span key={t} className="text-xs px-2.5 py-1 rounded-full border border-border/50 text-muted-foreground">#{t}</span>
            ))}
          </div>
        )}
      </header>

      {post.cover_url && (
        <div className="rounded-2xl overflow-hidden mb-8 glass">
          <img src={post.cover_url} alt={post.title} loading="eager" decoding="async" fetchPriority="high" width={1280} height={720} className="w-full h-auto" />
        </div>
      )}

      {post.body && (
        <div className="prose prose-invert max-w-none whitespace-pre-wrap text-foreground/90 leading-relaxed">
          {post.body}
        </div>
      )}
    </article>
  );
}
