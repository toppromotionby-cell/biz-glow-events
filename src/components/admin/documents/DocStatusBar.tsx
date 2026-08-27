// Единая полоса проверок документа: одинаково выглядит в КП, промо-КП и презентациях.
// Сворачивается в одну строку, разворачивается в список с переходом к проблемному полю.
import { useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export type DocCheckLevel = "error" | "warn" | "info";

export interface DocCheckLike {
  level: DocCheckLevel;
  message: string;
}

interface DocStatusBarProps<T extends DocCheckLike> {
  checks: T[];
  /** Переход к проблемному полю по клику (необязательно). */
  onGoto?: (check: T) => void;
  okLabel?: string;
  className?: string;
}

export function DocStatusBar<T extends DocCheckLike>({
  checks, onGoto, okLabel = "КП готово к отправке", className,
}: DocStatusBarProps<T>) {
  const errors = checks.filter((c) => c.level === "error");
  const warns = checks.filter((c) => c.level === "warn");
  const infos = checks.filter((c) => c.level === "info");
  const [open, setOpen] = useState(false);

  if (!errors.length && !warns.length && !infos.length) {
    return (
      <div className={cn("flex items-center gap-2 rounded-xl border border-border/60 px-3 py-2 text-sm text-muted-foreground", className)}>
        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        {okLabel}
      </div>
    );
  }

  const tone = errors.length
    ? "border-destructive/50 bg-destructive/10 text-destructive"
    : warns.length
      ? "border-amber-500/50 bg-amber-500/10 text-amber-700"
      : "border-border/60 text-muted-foreground";

  const summary = errors.length
    ? `Не хватает данных: ${errors.length} — суммы и блоки в превью могут быть некорректны`
    : warns.length
      ? `Предупреждений: ${warns.length} — проверьте перед отправкой`
      : `Подсказок: ${infos.length}`;

  return (
    <div className={cn("rounded-xl border text-sm", tone, className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs"
      >
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        <span className="flex-1">{summary}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="space-y-0.5 border-t border-current/20 px-1.5 py-1.5">
          {[...errors, ...warns, ...infos].map((c, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onGoto?.(c)}
              className={cn(
                "flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-background/50",
                c.level === "error" ? "text-destructive" : c.level === "warn" ? "text-amber-600" : "text-muted-foreground",
                !onGoto && "cursor-default",
              )}
            >
              {c.level === "info"
                ? <Info className="mt-0.5 h-4 w-4 shrink-0" />
                : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
              <span className="flex-1">{c.message}</span>
              {onGoto && <span className="shrink-0 text-[10px] text-muted-foreground">перейти →</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
