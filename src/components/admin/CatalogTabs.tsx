// Единая навигация по разделам каталога: вместо 6 пунктов в сайдбаре — табы на странице.
import { Link, useLocation } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { CATALOG_TABLES, CATALOG_LABELS } from "@/lib/admin/catalog-types";

export function CatalogTabs() {
  const { pathname } = useLocation();

  const tabs: { to: string; label: string; active: boolean }[] = [
    ...CATALOG_TABLES.map((t) => ({
      to: `/admin/catalog/${t}`,
      label: CATALOG_LABELS[t],
      active: pathname === `/admin/catalog/${t}`,
    })),
    {
      to: "/admin/catalog-structure",
      label: "Структура каталога",
      active: pathname.startsWith("/admin/catalog-structure"),
    },
  ];

  return (
    <nav
      aria-label="Разделы каталога"
      className="flex flex-wrap items-center gap-1.5 overflow-x-auto -mx-1 px-1 pb-1"
    >
      {tabs.map((t) => (
        <Link
          key={t.to}
          to={t.to}
          preload="intent"
          className={cn(
            "shrink-0 rounded-full border px-3 py-1.5 text-sm transition",
            t.active
              ? "bg-gradient-primary text-primary-foreground border-transparent"
              : "border-border/60 bg-muted/20 text-muted-foreground hover:text-foreground hover:bg-muted/50",
          )}
          aria-current={t.active ? "page" : undefined}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
