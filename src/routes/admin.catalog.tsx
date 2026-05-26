// Layout для каталогов: zones | tech_equipment | services | production_items.
import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/admin/catalog/zones", label: "Зоны", table: "zones" },
  { to: "/admin/catalog/tech_equipment", label: "Оборудование", table: "tech_equipment" },
  { to: "/admin/catalog/services", label: "Услуги", table: "services" },
  { to: "/admin/catalog/production_items", label: "Производство", table: "production_items" },
] as const;

export const Route = createFileRoute("/admin/catalog")({
  component: CatalogLayout,
});

function CatalogLayout() {
  const currentPath = useRouterState({ select: (s) => s.location.pathname });

  const { data: counts } = useQuery({
    queryKey: ["admin-catalog-counts"],
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      const entries = await Promise.all(
        TABS.map(async (t) => {
          const { count } = await supabase.from(t.table as any).select("id", { count: "exact", head: true });
          return [t.table, count ?? 0] as const;
        }),
      );
      return Object.fromEntries(entries) as Record<string, number>;
    },
  });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-display font-bold">Наполнение</h1>
        <p className="text-sm text-muted-foreground">Управление каталогами сайта</p>
      </header>

      <nav className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => {
          const active = currentPath === t.to || currentPath.startsWith(t.to + "/");
          const count = counts?.[t.table];
          return (
            <Link
              key={t.to}
              to={t.to}
              preload="intent"
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition inline-flex items-center gap-2",
                active
                  ? "bg-gradient-primary glow-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              )}
            >
              <span>{t.label}</span>
              {typeof count === "number" && (
                <span
                  className={cn(
                    "inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-[10px] font-semibold tabular-nums",
                    active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-foreground/70",
                  )}
                >
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <Outlet />
    </div>
  );
}
