// Подсказка «?» рядом с label. Открывается по hover/focus, доступна с клавиатуры.
import type { ReactNode } from "react";
import { HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function HelpTip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Подсказка"
            className={`inline-flex h-4 w-4 items-center justify-center text-muted-foreground hover:text-foreground transition ${className ?? ""}`}
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs leading-snug">
          {children}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
