// Layout для каталогов: zones | tech_equipment | services | production_items.
import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/admin/catalog/zones", label: "Зоны" },
  { to: "/admin/catalog/tech_equipment", label: "Оборудование" },
  { to: "/admin/catalog/services", label: "Услуги" },
  { to: "/admin/catalog/production_items", label: "Производство" },
] as const;

export const Route = createFileRoute("/admin/catalog")({
  component: CatalogLayout,
});

function CatalogLayout() {
  const currentPath = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-display font-bold">Наполнение</h1>
        <p className="text-sm text-muted-foreground">Управление каталогами сайта</p>
      </header>

      <nav className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => {
          const active = currentPath === t.to || currentPath.startsWith(t.to + "/");
          return (
            <Link
              key={t.to}
              to={t.to}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition",
                active
                  ? "bg-gradient-primary glow-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      <Outlet />
    </div>
  );
}
