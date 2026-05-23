// Lightweight breadcrumbs for inner pages (sections, detail pages).
import { Link } from "@tanstack/react-router";
import { ChevronRight, Home } from "lucide-react";

export type Crumb = { label: string; to?: string };

export function Breadcrumbs({ items, className = "" }: { items: Crumb[]; className?: string }) {
  if (!items.length) return null;
  return (
    <nav aria-label="Хлебные крошки" className={`text-xs text-muted-foreground ${className}`}>
      <ol className="flex flex-wrap items-center gap-1.5">
        <li className="flex items-center gap-1.5">
          <Link to="/" className="inline-flex items-center gap-1 hover:text-foreground transition" aria-label="Главная">
            <Home className="h-3 w-3" aria-hidden="true" />
            <span className="hidden sm:inline">Главная</span>
          </Link>
        </li>
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${c.label}-${i}`} className="flex items-center gap-1.5">
              <ChevronRight className="h-3 w-3 opacity-60" aria-hidden="true" />
              {c.to && !last ? (
                <Link to={c.to} className="hover:text-foreground transition truncate max-w-[40vw] sm:max-w-none">{c.label}</Link>
              ) : (
                <span aria-current={last ? "page" : undefined} className={`truncate max-w-[60vw] sm:max-w-none ${last ? "text-foreground" : ""}`}>
                  {c.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
