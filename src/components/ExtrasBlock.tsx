// Универсальный блок "Дополнительно" для карточек каталога.
import { Info } from "lucide-react";

type Row = { label?: string; value?: string };

export function ExtrasBlock({
  extras,
  variant = "page",
}: {
  extras: unknown;
  variant?: "page" | "modal";
}) {
  const items: Row[] = Array.isArray(extras)
    ? (extras as Row[]).filter((r) => (r?.label ?? "").toString().trim() || (r?.value ?? "").toString().trim())
    : [];
  if (items.length === 0) return null;
  const isModal = variant === "modal";
  return (
    <div className="glass rounded-xl p-5">
      <h2 className={`font-display font-semibold mb-4 flex items-center gap-2 ${isModal ? "text-sm" : ""}`}>
        <Info className="h-4 w-4 text-primary" />
        Дополнительно
      </h2>
      <dl className="grid gap-x-4 gap-y-2 text-sm">
        {items.map((r, i) => (
          <div key={i} className="flex justify-between items-baseline gap-3 border-b border-border/30 pb-1.5 last:border-0 last:pb-0">
            <dt className="text-muted-foreground">{r.label}</dt>
            <dd className="font-medium text-right text-foreground/90">{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
