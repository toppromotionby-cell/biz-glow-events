// Универсальный бейдж статуса для админки.
import type { ReactNode } from "react";

export type PillTone = "neutral" | "success" | "warning" | "danger" | "info" | "muted";

const TONE: Record<PillTone, string> = {
  neutral: "border-border/50 text-muted-foreground",
  success: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30",
  warning: "bg-amber-500/15 text-amber-300 border-amber-400/30",
  danger:  "bg-red-500/15 text-red-300 border-red-400/30",
  info:    "bg-cyan-500/15 text-cyan-300 border-cyan-400/30",
  muted:   "bg-muted/30 text-muted-foreground border-border/50",
};

export function StatusPill({
  tone = "neutral", className = "", children,
}: { tone?: PillTone; className?: string; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide border ${TONE[tone]} ${className}`}>
      {children}
    </span>
  );
}
