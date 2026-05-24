// Универсальная пара Label + поле ввода для admin-форм.
import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";

export function Field({
  label, required, hint, children, className,
}: { label: ReactNode; required?: boolean; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <Label>{label}{required && <span className="text-destructive ml-0.5">*</span>}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
