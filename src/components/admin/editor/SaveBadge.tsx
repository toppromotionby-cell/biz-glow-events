// Единый индикатор автосохранения для редакторов документов и презентаций.
import { AlertTriangle, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { saveStatus, type SaveState } from "@/lib/editor/save-state";

export function SaveBadge({
  state, savedAt, error, className,
}: {
  state: SaveState;
  savedAt: Date | null;
  error?: string | null;
  className?: string;
}) {
  const s = saveStatus(state, savedAt, error);
  const tone =
    s.tone === "error" ? "text-destructive"
      : s.tone === "ok" ? "text-emerald-600"
        : "text-muted-foreground";

  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs", tone, className)} aria-live="polite">
      {s.tone === "pending" && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
      {s.tone === "ok" && <Check className="h-3 w-3" aria-hidden />}
      {s.tone === "error" && <AlertTriangle className="h-3 w-3" aria-hidden />}
      {s.text}
    </span>
  );
}
