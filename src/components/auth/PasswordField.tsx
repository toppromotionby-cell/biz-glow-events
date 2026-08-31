// Поле пароля с чек-листом требований, полосой надёжности, показом и генератором.
import { useMemo, useState } from "react";
import { Check, Copy, Eye, EyeOff, Sparkles, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  PASSWORD_RULES,
  PASSWORD_STRENGTH_LABEL,
  checkPassword,
  generatePassword,
} from "@/lib/password-policy";
import { cn } from "@/lib/utils";

interface Props {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  email?: string | null;
  error?: string | undefined;
  /** Показывать чек-лист требований и генератор (для новых паролей). */
  showChecklist?: boolean;
  autoComplete?: string;
  placeholder?: string;
  hint?: string;
}

export function PasswordField({
  id = "password",
  label = "Пароль",
  value,
  onChange,
  email,
  error,
  showChecklist = true,
  autoComplete = "new-password",
  placeholder = "Например: Sv3t-Zvuk!2026",
  hint,
}: Props) {
  const [visible, setVisible] = useState(false);
  const check = useMemo(() => checkPassword(value, { email }), [value, email]);
  const bars = value ? check.score + 1 : 0;

  const handleGenerate = async () => {
    const pwd = generatePassword(16);
    onChange(pwd);
    setVisible(true);
    try {
      await navigator.clipboard.writeText(pwd);
      toast.success("Пароль сгенерирован и скопирован — сохраните его");
    } catch {
      toast.success("Пароль сгенерирован — сохраните его");
    }
  };

  const copy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Скопировано");
    } catch {
      toast.error("Браузер не дал скопировать — выделите вручную");
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {showChecklist && (
          <button
            type="button"
            onClick={handleGenerate}
            className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
          >
            <Sparkles className="h-3 w-3" aria-hidden />
            Сгенерировать надёжный
          </button>
        )}
      </div>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          aria-invalid={!!error}
          aria-describedby={showChecklist ? `${id}-rules` : undefined}
          className="pr-20"
        />
        <div className="absolute inset-y-0 right-1 flex items-center gap-0.5">
          {showChecklist && value && (
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={copy} aria-label="Скопировать пароль">
              <Copy className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Скрыть пароль" : "Показать пароль"}
          >
            {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      {showChecklist && (
        <>
          <div className="flex gap-1" aria-hidden>
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors",
                  i < bars
                    ? bars <= 2
                      ? "bg-destructive"
                      : bars === 3
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                    : "bg-border",
                )}
              />
            ))}
          </div>
          {value && (
            <p className="text-xs text-muted-foreground">
              Надёжность: {PASSWORD_STRENGTH_LABEL[Math.min(4, check.score)]}
            </p>
          )}
          <ul id={`${id}-rules`} className="mt-1 grid gap-0.5 text-xs sm:grid-cols-2">
            {PASSWORD_RULES.map((rule) => {
              const ok = rule.test(value, { email });
              return (
                <li
                  key={rule.id}
                  className={cn("flex items-center gap-1.5", ok ? "text-emerald-500" : "text-muted-foreground")}
                >
                  {ok ? <Check className="h-3 w-3 shrink-0" /> : <X className="h-3 w-3 shrink-0 opacity-50" />}
                  {rule.label}
                </li>
              );
            })}
          </ul>
        </>
      )}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
