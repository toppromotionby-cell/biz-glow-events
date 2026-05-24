// Унифицированная шапка admin-страницы.
import type { ReactNode } from "react";

export function AdminPageHeader({
  title, subtitle, action, icon,
}: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <header className="flex items-end justify-between flex-wrap gap-3">
      <div>
        <h1 className="admin-h1 flex items-center gap-2">
          {icon}{title}
        </h1>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}
