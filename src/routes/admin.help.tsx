// Layout раздела «Справка для сотрудников»: липкий сайдбар категорий + контент.
import { useMemo, useState } from "react";
import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import * as Icons from "lucide-react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  HELP_ARTICLES, HELP_CATEGORIES, articlesByCategory, searchHelp,
} from "@/content/help/registry";

export const Route = createFileRoute("/admin/help")({
  component: HelpLayout,
});

function CategoryIcon({ name, className }: { name: string; className?: string }) {
  const Cmp = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[name]
    ?? Icons.BookOpen;
  return <Cmp className={className} />;
}

function HelpLayout() {
  const loc = useLocation();
  const [term, setTerm] = useState("");
  const results = useMemo(() => searchHelp(term), [term]);

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <aside className="lg:w-72 lg:shrink-0">
        <div className="lg:sticky lg:top-16">
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Поиск по справке…"
              className="pl-9"
            />
          </div>

          <ScrollArea className="max-h-[calc(100dvh-11rem)]">
            {term.trim().length >= 2 ? (
              <div className="space-y-1 pr-2">
                <div className="px-2 py-1 text-xs text-muted-foreground">
                  Найдено: {results.length}
                </div>
                {results.map((a) => (
                  <Link
                    key={a.id}
                    to="/admin/help/$slug"
                    params={{ slug: a.id }}
                    className="block rounded-lg px-3 py-2 text-sm hover:bg-muted"
                  >
                    <div className="font-medium">{a.title}</div>
                    <div className="truncate text-xs text-muted-foreground">{a.summary}</div>
                  </Link>
                ))}
              </div>
            ) : (
              <nav className="space-y-4 pr-2">
                {HELP_CATEGORIES.map((c) => {
                  const items = articlesByCategory(c.id);
                  return (
                    <div key={c.id}>
                      <div className="flex items-center gap-2 px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        <CategoryIcon name={c.icon} className="h-3.5 w-3.5" />
                        {c.title}
                      </div>
                      <div className="space-y-0.5">
                        {items.map((a) => {
                          const active = loc.pathname === `/admin/help/${a.id}`;
                          return (
                            <Link
                              key={a.id}
                              to="/admin/help/$slug"
                              params={{ slug: a.id }}
                              className={cn(
                                "block rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
                                active && "bg-primary/10 font-medium text-foreground",
                              )}
                            >
                              {a.title}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                <div className="px-2 pt-2 text-xs text-muted-foreground">
                  Всего статей: {HELP_ARTICLES.length}
                </div>
              </nav>
            )}
          </ScrollArea>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}
