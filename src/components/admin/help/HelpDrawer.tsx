// Боковая панель контекстной справки. Монтируется один раз в layout админки.
import { Link } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { getHelpArticle } from "@/content/help/registry";
import { ArticleBody } from "./ArticleBody";
import { closeHelp, openHelp, useHelpArticleId } from "./help-store";

export function HelpDrawer() {
  const id = useHelpArticleId();
  const article = id ? getHelpArticle(id) : undefined;

  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && closeHelp()}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="border-b border-border/60 px-5 py-4 text-left">
          <SheetTitle className="text-base">{article?.title ?? "Справка"}</SheetTitle>
          <SheetDescription className="text-xs">
            {article?.summary ?? "Статья не найдена. Откройте справку целиком."}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100dvh-9.5rem)]">
          <div className="px-5 py-4">
            {article ? <ArticleBody article={article} /> : null}

            {article?.related?.length ? (
              <div className="mt-6 border-t border-border/60 pt-4">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Смотрите также
                </div>
                <div className="flex flex-wrap gap-2">
                  {article.related.map((rid) => {
                    const rel = getHelpArticle(rid);
                    if (!rel) return null;
                    return (
                      <button
                        key={rid}
                        type="button"
                        onClick={() => openHelp(rid)}
                        className="rounded-full border border-border/60 px-3 py-1 text-xs hover:bg-muted"
                      >
                        {rel.title}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </ScrollArea>

        <div className="border-t border-border/60 px-5 py-3">
          <Button asChild variant="outline" size="sm" className="w-full">
            {article ? (
              <Link to="/admin/help/$slug" params={{ slug: article.id }} onClick={() => closeHelp()}>
                <ExternalLink className="mr-2 h-3.5 w-3.5" />
                Открыть в справке
              </Link>
            ) : (
              <Link to="/admin/help" onClick={() => closeHelp()}>
                <ExternalLink className="mr-2 h-3.5 w-3.5" />
                Открыть справку
              </Link>
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
