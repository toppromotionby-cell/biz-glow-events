// Стартовая страница справки: карточки категорий.
import { createFileRoute, Link } from "@tanstack/react-router";
import * as Icons from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { HELP_ARTICLES, HELP_CATEGORIES, articlesByCategory } from "@/content/help/registry";

export const Route = createFileRoute("/admin/help/")({
  component: HelpIndex,
});

function CategoryIcon({ name }: { name: string }) {
  const Cmp = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[name]
    ?? Icons.BookOpen;
  return <Cmp className="h-5 w-5 text-primary" />;
}

function HelpIndex() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Справка для сотрудников</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Пошаговые инструкции по всем разделам админки. Сейчас доступно {HELP_ARTICLES.length} статей.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {HELP_CATEGORIES.map((c) => {
          const items = articlesByCategory(c.id);
          const first = items[0];
          if (!first) return null;
          return (
            <Card key={c.id} className="transition hover:border-primary/40 hover:shadow-sm">
              <CardHeader className="pb-3">
                <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                  <CategoryIcon name={c.icon} />
                </div>
                <CardTitle className="text-base">{c.title}</CardTitle>
                <CardDescription className="text-xs">{c.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {items.slice(0, 4).map((a) => (
                    <li key={a.id}>
                      <Link
                        to="/admin/help/$slug"
                        params={{ slug: a.id }}
                        className="text-sm text-muted-foreground hover:text-foreground hover:underline"
                      >
                        {a.title}
                      </Link>
                    </li>
                  ))}
                </ul>
                {items.length > 4 && (
                  <Link
                    to="/admin/help/$slug"
                    params={{ slug: items[4]!.id }}
                    className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
                  >
                    Ещё {items.length - 4} — смотреть
                  </Link>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
