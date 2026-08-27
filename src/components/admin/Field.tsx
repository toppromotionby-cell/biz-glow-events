// Универсальная пара Label + поле ввода для admin-форм.
// Поддерживает hint, tooltip (HelpTip), inline-error и счётчик символов.
import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { HelpTip } from "@/components/admin/HelpTip";
import { cn } from "@/lib/utils";

type Props = {
  label: ReactNode;
  required?: boolean;
  hint?: ReactNode;
  tooltip?: ReactNode;
  /** id статьи «Справки для сотрудников» — иконка «?» откроет её в боковой панели. */
  help?: string;
  error?: string | null;
  counter?: { value: number; max: number };
  children: ReactNode;
  className?: string;
};

export function Field({ label, required, hint, tooltip, help, error, counter, children, className }: Props) {
  const overLimit = counter ? counter.value > counter.max : false;
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <Label className="flex items-center gap-1.5">
          <span>{label}{required && <span className="text-destructive ml-0.5" aria-label="обязательное">*</span>}</span>
          {(tooltip || help) && <HelpTip article={help}>{tooltip}</HelpTip>}
        </Label>
        {counter && (
          <span className={cn("text-[10px] tabular-nums", overLimit ? "text-destructive" : "text-muted-foreground")}>
            {counter.value} / {counter.max}
          </span>
        )}
      </div>
      {children}
      {error && (
        <p role="alert" className="text-xs text-destructive">{error}</p>
      )}
      {!error && hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
