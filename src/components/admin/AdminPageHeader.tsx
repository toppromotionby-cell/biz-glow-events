// Унифицированная шапка admin-страницы.
import type { ReactNode } from "react";
import { HelpCircle } from "lucide-react";
import { openHelp } from "@/components/admin/help/help-store";
import { getHelpArticle } from "@/content/help/registry";

export function AdminPageHeader({
  title, subtitle, action, icon, help,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  /** id статьи справки для этого раздела */
  help?: string;
}) {
  const doc = help ? getHelpArticle(help) : undefined;
  return (
    <header className="flex items-end justify-between flex-wrap gap-3">
      <div>
        <h1 className="admin-h1 flex items-center gap-2">
          {icon}{title}
          {doc && (
            <button
              type="button"
              onClick={() => openHelp(doc.id)}
              title={`Справка: ${doc.title}`}
              aria-label={`Справка: ${doc.title}`}
              className="inline-flex h-6 items-center gap-1 rounded-full border border-border/60 px-2 text-[11px] font-normal text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              Справка
            </button>
          )}
        </h1>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}
