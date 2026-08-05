// Редактор текста блока КП: автодополнение переменных, проверка синтаксиса и ошибки до сохранения.
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, Calculator } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { QUOTE_PLACEHOLDERS } from "@/lib/quote-blocks";
import {
  FORMULA_VARIABLES,
  previewFormula,
  validateQuoteText,
  type TextIssue,
} from "@/lib/quote-formula";

type Suggestion = { insert: string; label: string; hint: string; formula: boolean };

const PLACEHOLDER_SUGGESTIONS: Suggestion[] = QUOTE_PLACEHOLDERS.filter((p) => !p.key.startsWith("=")).map((p) => ({
  insert: p.key,
  label: p.label,
  hint: p.group,
  formula: false,
}));

const FORMULA_SUGGESTIONS: Suggestion[] = FORMULA_VARIABLES.map((v) => ({
  insert: v.key,
  label: v.label,
  hint: "переменная формулы",
  formula: true,
}));

type Props = {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
  /** Сообщать наружу, есть ли ошибки (например, чтобы блокировать сохранение). */
  onValidityChange?: (hasErrors: boolean) => void;
};

export function QuoteTextEditor({ value, onChange, rows = 3, placeholder, onValidityChange }: Props) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const [caret, setCaret] = useState(0);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const issues = useMemo(() => validateQuoteText(value), [value]);
  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");

  useEffect(() => {
    onValidityChange?.(errors.length > 0);
  }, [errors.length, onValidityChange]);

  // Контекст автодополнения: курсор внутри незакрытого {{ ... }}
  const ctx = useMemo(() => {
    const before = value.slice(0, caret);
    const openIdx = before.lastIndexOf("{{");
    if (openIdx === -1) return null;
    const between = before.slice(openIdx + 2);
    if (between.includes("}}")) return null;
    const isFormula = /^\s*=/.test(between);
    // слово под курсором (последний идентификатор)
    const word = (between.match(/[a-z0-9_]*$/i) ?? [""])[0]!;
    return { openIdx, word, isFormula, wordStart: caret - word.length };
  }, [value, caret]);

  const suggestions = useMemo(() => {
    if (!ctx) return [];
    const pool = ctx.isFormula ? FORMULA_SUGGESTIONS : [...PLACEHOLDER_SUGGESTIONS, ...FORMULA_SUGGESTIONS.slice(0, 0)];
    const q = ctx.word.toLowerCase();
    const filtered = pool.filter((s) => !q || s.insert.includes(q) || s.label.toLowerCase().includes(q));
    return filtered.slice(0, 8);
  }, [ctx]);

  useEffect(() => {
    setActive(0);
    setOpen(!!ctx && suggestions.length > 0);
  }, [ctx, suggestions.length]);

  const sync = () => setCaret(ref.current?.selectionStart ?? 0);

  const applySuggestion = (s: Suggestion) => {
    if (!ctx) return;
    const head = value.slice(0, ctx.wordStart);
    const tailRaw = value.slice(caret);
    // Автозакрытие }} если его нет сразу после
    const needsClose = !/^\s*\}\}/.test(tailRaw);
    const inserted = `${s.insert}${needsClose ? " }}" : ""}`;
    const next = `${head}${inserted}${tailRaw}`;
    onChange(next);
    setOpen(false);
    requestAnimationFrame(() => {
      const pos = head.length + inserted.length;
      ref.current?.focus();
      ref.current?.setSelectionRange(pos, pos);
      setCaret(pos);
    });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (open && suggestions.length) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => (a + 1) % suggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => (a - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        applySuggestion(suggestions[active]!);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        return;
      }
    }
    // Автопара: ввод "{" после "{" превращается в {{  }}
    if (e.key === "{" && value.slice(0, caret).endsWith("{")) {
      e.preventDefault();
      const head = value.slice(0, caret);
      const tail = value.slice(caret);
      const next = `${head}{  }}${tail}`;
      onChange(next);
      requestAnimationFrame(() => {
        const pos = head.length + 2;
        ref.current?.setSelectionRange(pos, pos);
        setCaret(pos);
      });
    }
  };

  // Предпросмотр всех формул в тексте на демо-данных
  const formulaPreviews = useMemo(() => {
    const out: Array<{ expr: string; result: string }> = [];
    const re = /\{\{\s*=\s*([^{}]+?)\s*\}\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(value))) {
      const expr = m[1]!.trim();
      const result = previewFormula(expr);
      if (result) out.push({ expr, result });
    }
    return out.slice(0, 4);
  }, [value]);

  return (
    <div className="relative space-y-1.5">
      <Textarea
        ref={ref}
        rows={rows}
        value={value}
        placeholder={placeholder ?? "Плейсхолдеры {{client_company}}, {{total}} и формулы {{= total - advance }}"}
        onChange={(e) => {
          onChange(e.target.value);
          setCaret(e.target.selectionStart ?? 0);
        }}
        onKeyUp={sync}
        onClick={sync}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKeyDown}
        className={`font-mono text-xs ${errors.length ? "border-destructive focus-visible:ring-destructive/40" : ""}`}
      />

      {open && suggestions.length > 0 && (
        <div className="absolute z-50 left-2 top-full -mt-1 w-80 max-h-64 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg">
          <div className="px-2.5 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground border-b border-border/60">
            {ctx?.isFormula ? "Переменные формулы" : "Плейсхолдеры"} · ↑↓ выбрать, Enter вставить
          </div>
          {suggestions.map((s, i) => (
            <button
              key={s.insert}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applySuggestion(s)}
              onMouseEnter={() => setActive(i)}
              className={`w-full text-left px-2.5 py-1.5 flex items-center gap-2 text-xs ${
                i === active ? "bg-accent" : ""
              }`}
            >
              <span className="flex-1 truncate">{s.label}</span>
              <code className="text-[10px] text-muted-foreground shrink-0">{s.insert}</code>
            </button>
          ))}
        </div>
      )}

      {issues.length > 0 && (
        <ul className="space-y-1">
          {issues.slice(0, 5).map((it: TextIssue, i) => (
            <li
              key={`${it.start}-${i}`}
              className={`flex items-start gap-1.5 text-[11px] ${
                it.level === "error" ? "text-destructive" : "text-amber-600 dark:text-amber-500"
              }`}
            >
              {it.level === "error" ? (
                <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
              ) : (
                <Info className="h-3 w-3 mt-0.5 shrink-0" />
              )}
              <span>
                {it.message}
                {it.excerpt ? <code className="ml-1 font-mono opacity-80">{it.excerpt}</code> : null}
              </span>
            </li>
          ))}
        </ul>
      )}

      {errors.length === 0 && warnings.length === 0 && value.trim() && (
        <p className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-500">
          <CheckCircle2 className="h-3 w-3" /> Синтаксис в порядке
        </p>
      )}

      {formulaPreviews.length > 0 && (
        <div className="rounded-md border border-border/60 bg-muted/40 px-2.5 py-1.5 space-y-0.5">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            <Calculator className="h-3 w-3" /> Проверка на демо-данных
          </div>
          {formulaPreviews.map((p, i) => (
            <div key={i} className="text-[11px] text-muted-foreground">
              <code className="font-mono">{p.expr}</code> → <span className="text-foreground">{p.result}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
