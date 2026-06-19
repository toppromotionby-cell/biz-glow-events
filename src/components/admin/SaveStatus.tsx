// Индикатор статуса сохранения формы: dirty / saving / saved / error / draft.
import { Check, Loader2, AlertCircle, CircleDot, HardDrive } from "lucide-react";
import { cn } from "@/lib/utils";

export type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

export function SaveStatus({
  state,
  draftSavedAt,
  errorMessage,
  className,
}: {
  state: SaveState;
  draftSavedAt?: Date | null;
  errorMessage?: string | null;
  className?: string;
}) {
  const base = "inline-flex items-center gap-1.5 text-xs tabular-nums";
  if (state === "saving") {
    return (
      <span className={cn(base, "text-muted-foreground", className)} aria-live="polite">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Сохраняем…
      </span>
    );
  }
  if (state === "saved") {
    return (
      <span className={cn(base, "text-emerald-500", className)} aria-live="polite">
        <Check className="h-3.5 w-3.5" /> Сохранено
      </span>
    );
  }
  if (state === "error") {
    return (
      <span className={cn(base, "text-destructive", className)} role="alert" title={errorMessage ?? undefined}>
        <AlertCircle className="h-3.5 w-3.5" /> Ошибка{errorMessage ? `: ${errorMessage}` : ""}
      </span>
    );
  }
  if (state === "dirty") {
    return (
      <span className={cn(base, "text-amber-500", className)}>
        <CircleDot className="h-3.5 w-3.5" /> Есть изменения
        {draftSavedAt && (
          <span className="text-muted-foreground inline-flex items-center gap-1 ml-1">
            · <HardDrive className="h-3 w-3" /> черновик {formatTime(draftSavedAt)}
          </span>
        )}
      </span>
    );
  }
  if (draftSavedAt) {
    return (
      <span className={cn(base, "text-muted-foreground", className)}>
        <HardDrive className="h-3.5 w-3.5" /> черновик {formatTime(draftSavedAt)}
      </span>
    );
  }
  return null;
}

function formatTime(d: Date) {
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}
