// Страница одной статьи справки.
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArticleBody } from "@/components/admin/help/ArticleBody";
import { getCategory, getHelpArticle } from "@/content/help/registry";

export const Route = createFileRoute("/admin/help/$slug")({
  component: HelpArticlePage,
});

function HelpArticlePage() {
  const { slug } = Route.useParams();
  const article = getHelpArticle(slug);

  if (!article) {
    return (
      <div className="rounded-xl border border-border/60 p-8 text-center">
        <p className="text-sm text-muted-foreground">Статья не найдена.</p>
        <Button asChild variant="outline" size="sm" className="mt-4">
          <Link to="/admin/help">
            <ArrowLeft className="mr-2 h-3.5 w-3.5" />
            Ко всем разделам
          </Link>
        </Button>
      </div>
    );
  }

  const category = getCategory(article.category);

  return (
    <article className="mx-auto max-w-3xl">
      <div className="mb-5">
        <Link to="/admin/help" className="text-xs text-muted-foreground hover:text-foreground">
          Справка
        </Link>
        {category && <span className="mx-1.5 text-xs text-muted-foreground">/ {category.title}</span>}
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{article.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{article.summary}</p>
      </div>

      <ArticleBody article={article} />

      {article.related?.length ? (
        <div className="mt-8 border-t border-border/60 pt-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Смотрите также
          </div>
          <div className="flex flex-wrap gap-2">
            {article.related.map((rid) => {
              const rel = getHelpArticle(rid);
              if (!rel) return null;
              return (
                <Link key={rid} to="/admin/help/$slug" params={{ slug: rid }}>
                  <Badge variant="outline" className="cursor-pointer hover:bg-muted">
                    {rel.title}
                  </Badge>
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}
    </article>
  );
}
