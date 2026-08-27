// Подсказка «?» рядом с label. Открывается по hover/focus, доступна с клавиатуры.
// Если передан `article` — клик открывает боковую панель со статьёй справки.
import type { ReactNode } from "react";
import { HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { openHelp } from "@/components/admin/help/help-store";
import { getHelpArticle } from "@/content/help/registry";

export function HelpTip({
  children,
  className,
  article,
}: {
  children?: ReactNode;
  className?: string;
  /** id статьи в «Справке для сотрудников» */
  article?: string;
}) {
  const doc = article ? getHelpArticle(article) : undefined;
  const hint = children ?? doc?.summary ?? "Открыть справку";

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={doc ? `Справка: ${doc.title}` : "Подсказка"}
            onClick={doc ? () => openHelp(doc.id) : undefined}
            className={`inline-flex h-4 w-4 items-center justify-center text-muted-foreground transition hover:text-foreground ${className ?? ""}`}
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs leading-snug">
          {hint}
          {doc ? <div className="mt-1 text-[11px] opacity-70">Нажмите, чтобы открыть инструкцию</div> : null}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
