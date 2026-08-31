// Общий каркас DJ-раздела: навигация клуба и глобальный плеер.
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { Disc3 } from "lucide-react";
import { DjPlayerProvider } from "@/components/dj/player";

export const Route = createFileRoute("/dj")({
  component: DjLayout,
});

const TABS = [
  { to: "/dj", label: "О клубе", exact: true },
  { to: "/dj/pool", label: "Библиотека" },
  { to: "/dj/software", label: "Софт" },
] as const;

function DjLayout() {
  return (
    <DjPlayerProvider>
      <div className="pb-28">
        <div className="border-b border-border/60">
          <div className="container mx-auto flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
            <Link to="/dj" className="flex items-center gap-2 font-display text-lg font-bold">
              <Disc3 className="h-5 w-5 text-primary" /> DJ Hub
            </Link>
            <nav className="flex flex-wrap items-center gap-4 text-sm">
              {TABS.map((t) => (
                <Link
                  key={t.to}
                  to={t.to}
                  activeOptions={{ exact: "exact" in t ? t.exact : false }}
                  activeProps={{ className: "text-primary font-medium" }}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  {t.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
        <Outlet />
      </div>
    </DjPlayerProvider>
  );
}
