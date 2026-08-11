// Инпут с подсказками из базы знаний документов.
// Подсказки показываются только при реальном вводе (от MIN_TERM символов)
// и не переоткрываются после выбора варианта.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const MIN_TERM = 2;

interface SuggestInputProps<T> {
  value: string;
  onChange: (v: string) => void;
  onPick: (hit: T) => void;
  fetcher: (term: string) => Promise<T[]>;
  render: (hit: T) => ReactNode;
  /** Текстовое представление подсказки — чтобы скрывать единственный дословный дубль. */
  labelOf?: (hit: T) => string;
  placeholder?: string;
  className?: string;
  multiline?: boolean;
  rows?: number;
  onBlurCapture?: () => void;
}

export function SuggestInput<T>({
  value, onChange, onPick, fetcher, render, labelOf,
  placeholder, className, multiline, rows = 3, onBlurCapture,
}: SuggestInputProps<T>) {
  const [open, setOpen] = useState(false);
  const [hits, setHits] = useState<T[]>([]);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  // Пользователь реально печатает в поле (а не программная подстановка).
  const typed = useRef(false);
  // Пропустить ближайший запрос — значение изменил выбор подсказки.
  const skipNext = useRef(false);

  // Дебаунс запроса подсказок.
  useEffect(() => {
    if (skipNext.current) { skipNext.current = false; return; }
    if (!typed.current) return;
    const term = value.trim();
    if (term.length < MIN_TERM) { setHits([]); setOpen(false); return; }

    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await fetcher(term);
        if (cancelled) return;
        const onlyExactDupe =
          res.length === 1 && !!labelOf &&
          labelOf(res[0]!).trim().toLowerCase() === term.toLowerCase();
        setHits(res);
        setActive(0);
        setOpen(res.length > 0 && !onlyExactDupe);
      } catch {
        if (!cancelled) setOpen(false);
      }
    }, 220);
    return () => { cancelled = true; clearTimeout(t); };
  }, [value, fetcher, labelOf]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const pick = (h: T) => {
    skipNext.current = true;
    typed.current = false;
    setOpen(false);
    setHits([]);
    onPick(h);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { setOpen(false); return; }
    if (!open || hits.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % hits.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a - 1 + hits.length) % hits.length); }
    else if (e.key === "Enter" && !multiline) { e.preventDefault(); pick(hits[active]!); }
  };

  const common = {
    value,
    placeholder,
    className: cn(className),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      typed.current = true;
      onChange(e.target.value);
    },
    // При фокусе не показываем устаревшие результаты — ждём ввода.
    onFocus: () => { setOpen(false); },
    onBlur: () => { typed.current = false; setOpen(false); onBlurCapture?.(); },
    onKeyDown,
  };

  return (
    <div ref={boxRef} className="relative">
      {multiline ? <Textarea rows={rows} {...common} /> : <Input {...common} />}
      {open && hits.length > 0 && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full max-h-64 overflow-auto rounded-md border bg-popover shadow-md">
          {hits.map((h, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); pick(h); }}
              onMouseEnter={() => setActive(i)}
              className={cn(
                "block w-full px-3 py-2 text-left text-sm hover:bg-accent",
                i === active && "bg-accent",
              )}
            >
              {render(h)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
