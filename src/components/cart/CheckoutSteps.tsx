export function CheckoutSteps({ current }: { current: 0 | 1 | 2 }) {
  const steps = ["Корзина", "Контакты", "Реквизиты"] as const;
  return (
    <ol className="mb-8 flex items-center gap-2 text-xs sm:text-sm" aria-label="Шаги оформления">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex items-center gap-2 flex-1 min-w-0">
            <span
              aria-current={active ? "step" : undefined}
              className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold border transition ${
                done
                  ? "bg-success/20 text-success border-success/40"
                  : active
                  ? "bg-gradient-primary text-primary-foreground border-transparent glow-primary"
                  : "bg-muted/30 text-muted-foreground border-border"
              }`}
            >
              {done ? "✓" : i + 1}
            </span>
            <span className={`truncate ${active ? "text-foreground font-medium" : "text-muted-foreground"}`}>{label}</span>
            {i < steps.length - 1 && (
              <span className={`flex-1 h-px ${i < current ? "bg-success/40" : "bg-border"}`} aria-hidden="true" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
