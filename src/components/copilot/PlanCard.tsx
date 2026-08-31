// Карточка плана помощника: превью «было → стало» и живые кнопки решения.
import { useState } from "react";
import { Check, Loader2, RotateCcw, ShieldAlert, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { meaningfulOps, opDiff, opVerb } from "@/lib/copilot/diff";
import { RISK_LABEL, type CopilotRun } from "@/lib/copilot/types";

const STATUS_LABEL: Record<string, string> = {
  pending: "Ждёт решения",
  approved: "Утверждён",
  applied: "Применён",
  rejected: "Отклонён",
  failed: "Ошибка",
  rolled_back: "Откачен",
  expired: "Истёк",
};

export function PlanCard({
  run,
  busy,
  onDecide,
}: {
  run: CopilotRun;
  busy: boolean;
  onDecide: (decision: "approve" | "reject" | "rollback") => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const ops = meaningfulOps(run.preview);
  const shown = expanded ? ops : ops.slice(0, 4);
  const risky = run.risk === "destructive";

  return (
    <div className="rounded-xl border border-border/70 bg-card/70 p-3 space-y-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm truncate">📋 {run.title}</div>
          <div className="text-xs text-muted-foreground">{run.summary}</div>
        </div>
        <Badge variant={risky ? "destructive" : "secondary"} className="shrink-0">
          {STATUS_LABEL[run.status] ?? run.status}
        </Badge>
      </div>

      {risky && run.status === "pending" && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 text-destructive text-xs p-2">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          Необратимая операция ({RISK_LABEL[run.risk]}) — проверьте список перед утверждением.
        </div>
      )}

      <div className="space-y-2">
        {shown.map((op, i) => {
          const rows = opDiff(op);
          return (
            <div key={`${op.table}-${op.id ?? i}`} className="rounded-lg bg-muted/40 p-2 text-xs space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">
                  {opVerb(op.op)}
                </Badge>
                <span className="truncate font-medium">{op.label}</span>
                <span className="ml-auto text-muted-foreground shrink-0">{op.table}</span>
              </div>
              {rows.map((r) => (
                <div key={r.field} className="grid grid-cols-[minmax(0,7rem)_1fr] gap-2">
                  <span className="text-muted-foreground truncate">{r.label}</span>
                  <span className="min-w-0">
                    <span className="line-through text-muted-foreground/70 break-words">{r.before}</span>
                    <span className="mx-1">→</span>
                    <span className="text-foreground break-words">{r.after}</span>
                  </span>
                </div>
              ))}
            </div>
          );
        })}
        {ops.length > shown.length && (
          <button type="button" className="text-xs text-primary hover:underline" onClick={() => setExpanded(true)}>
            Показать ещё {ops.length - shown.length}
          </button>
        )}
      </div>

      {run.error && <div className="text-xs text-destructive break-words">{run.error}</div>}
      {run.result && run.status !== "pending" && <div className="text-xs text-muted-foreground">{run.result}</div>}

      <div className="flex flex-wrap gap-2">
        {run.status === "pending" && (
          <>
            <Button size="sm" disabled={busy} onClick={() => onDecide("approve")}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Утвердить
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => onDecide("reject")}>
              <X className="h-4 w-4" /> Отклонить
            </Button>
          </>
        )}
        {run.status === "applied" && (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => onDecide("rollback")}>
            <RotateCcw className="h-4 w-4" /> Откатить
          </Button>
        )}
      </div>
    </div>
  );
}
