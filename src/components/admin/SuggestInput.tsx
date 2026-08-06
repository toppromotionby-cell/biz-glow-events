// Инпут с подсказками из базы знаний документов.
// Показывает ранее введённые значения (клиенты, позиции, тексты) при вводе/фокусе.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface SuggestInputProps<T> {
  value: string;
  onChange: (v: string) => void;
  onPick: (hit: T) => void;
  fetcher: (term: string) => Promise<T[]>;
  render: (hit: T) => ReactNode;
  placeholder?: string;
  className?: string;
  multiline?: boolean;
  rows?: number;
  onBlurCapture?: () => void;
}

export function SuggestInput<T>({
  value, onChange, onPick, fetcher, render,
  placeholder, className, multiline, rows = 3, onBlurCapture,
}: SuggestInputProps<T>) {
  const [open, setOpen] = useState(false);
  const [hits, setHits] = useState<T[]>([]);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const focused = useRef(false);

  // Дебаунс запроса подсказок.
  useEffect(() => {
    if (!focused.current) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await fetcher(value);
        if (cancelled) return;
        setHits(res);
        setActive(0);
        setOpen(res.length > 0);
      } catch {
        if (!cancelled) setOpen(false);
      }
    }, 220);
    return () => { cancelled = true; clearTimeout(t); };
  }, [value, fetcher]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const pick = (h: T) => { onPick(h); setOpen(false); };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || hits.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % hits.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a - 1 + hits.length) % hits.length); }
    else if (e.key === "Enter" && !multiline) { e.preventDefault(); pick(hits[active]!); }
    else if (e.key === "Escape") setOpen(false);
  };

  const common = {
    value,
    placeholder,
    className: cn(className),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value),
    onFocus: () => { focused.current = true; if (hits.length) setOpen(true); },
    onBlur: () => { onBlurCapture?.(); },
    onKeyDown,
  };

  return (
    <div ref={boxRef} className="relative">
      {multiline ? <Textarea rows={rows} {...common} /> : <Input {...common} />}
      {open && hits.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-64 overflow-auto rounded-md border bg-popover shadow-md">
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
