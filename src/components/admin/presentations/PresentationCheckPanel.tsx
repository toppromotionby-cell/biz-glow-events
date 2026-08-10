// Вкладка «Сверка с КП»: чего не хватает, что лишнее, где нет фото/описания.
import { AlertTriangle, CheckCircle2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/admin/StatusPill";
import type { PresentationCheck, QuoteItemLite } from "@/lib/presentations/check";
import type { PresentationSlide } from "@/lib/presentations/model";

export function PresentationCheckPanel({
  check,
  hasQuote,
  onAddMissing,
  onSelectSlide,
  onRemoveSlide,
}: {
  check: PresentationCheck;
  hasQuote: boolean;
  onAddMissing: (items: QuoteItemLite[]) => void;
  onSelectSlide: (id: string) => void;
  onRemoveSlide: (id: string) => void;
}) {
  if (!hasQuote) {
    return (
      <div className="rounded-xl border border-border/60 p-6 text-sm text-muted-foreground">
        Презентация не связана с КП — сверять нечего.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill tone={check.status === "synced" ? "success" : "danger"}>
          {check.status === "synced" ? (
            <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" />{check.statusLabel}</span>
          ) : (
            <span className="inline-flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" />{check.statusLabel}</span>
          )}
        </StatusPill>
        <span className="text-xs text-muted-foreground">
          Совпало позиций: {check.matched.length}
        </span>
      </div>

      {check.missing.length > 0 && (
        <Section
          title={`Нет слайдов для позиций КП (${check.missing.length})`}
          action={
            <Button size="sm" onClick={() => onAddMissing(check.missing)}>
              <Plus className="mr-1.5 h-4 w-4" />Добавить слайды
            </Button>
          }
        >
          {check.missing.map((i) => (
            <Row key={i.id} title={i.title} hint={`${i.qty} ${i.unit} · ${i.price.toFixed(2)} BYN`} />
          ))}
        </Section>
      )}

      {check.extra.length > 0 && (
        <Section title={`Слайды, которых нет в КП (${check.extra.length})`}>
          {check.extra.map((s) => (
            <Row
              key={s.id}
              title={s.title || "Без названия"}
              hint="нет соответствия в КП"
              onClick={() => onSelectSlide(s.id)}
              action={
                <Button variant="ghost" size="icon" onClick={() => onRemoveSlide(s.id)} title="Удалить слайд">
                  <Trash2 className="h-4 w-4" />
                </Button>
              }
            />
          ))}
        </Section>
      )}

      {check.incomplete.length > 0 && (
        <Section title={`Не хватает фото или описания (${check.incomplete.length})`}>
          {check.incomplete.map((s: PresentationSlide) => (
            <Row
              key={s.id}
              title={s.title || "Без названия"}
              hint={[!s.image_url ? "нет фото" : null, !s.content.description.trim() ? "нет описания" : null]
                .filter(Boolean)
                .join(" · ")}
              onClick={() => onSelectSlide(s.id)}
            />
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({
  title, action, children,
}: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/60">
      <div className="flex items-center justify-between gap-3 border-b border-border/50 px-4 py-2.5">
        <div className="text-sm font-medium">{title}</div>
        {action}
      </div>
      <div className="divide-y divide-border/40">{children}</div>
    </div>
  );
}

function Row({
  title, hint, onClick, action,
}: { title: string; hint?: string; onClick?: () => void; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5">
      <button type="button" className="text-left" onClick={onClick} disabled={!onClick}>
        <div className="text-sm">{title}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </button>
      {action}
    </div>
  );
}
