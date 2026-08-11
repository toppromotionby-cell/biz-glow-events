// Инпут с подсказками из базы знаний документов.
// Правило одно: список открывается только когда человек сам печатает в этом поле
// (от MIN_TERM символов) или явно вызвал подсказки по Ctrl/Cmd+Space.
// Любое внешнее событие — программная подстановка, перерисовка, прокрутка,
// потеря фокуса, Escape, выбор варианта — список закрывает.
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const MIN_TERM = 3;
const DEBOUNCE_MS = 250;

interface SuggestInputProps<T> {
  value: string;
  onChange: (v: string) => void;
  onPick: (hit: T) => void;
  fetcher: (term: string) => Promise<T[]>;
  render: (hit: T) => ReactNode;
  /** Текстовое представление подсказки — чтобы не предлагать то, что уже введено. */
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

  // Колбэки держим в ref: их идентичность меняется на каждой перерисовке
  // таблицы позиций и не должна перезапускать логику подсказок.
  const fetcherRef = useRef(fetcher);
  const labelRef = useRef(labelOf);
  fetcherRef.current = fetcher;
  labelRef.current = labelOf;

  // Взведён ли поиск: ставится только реальным вводом или ручным вызовом.
  const armed = useRef(false);
  // Токен ручного вызова — чтобы повторно запустить поиск по тому же тексту.
  const [manual, setManual] = useState(0);

  const close = useCallback(() => { armed.current = false; setOpen(false); }, []);

  useEffect(() => {
    if (!armed.current) return;
    const term = value.trim();
    if (term.length < MIN_TERM) { setHits([]); setOpen(false); return; }

    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await fetcherRef.current(term);
        if (cancelled || !armed.current) return;
        const label = labelRef.current;
        // Уже введено дословно — предлагать нечего.
        const exact = !!label && res.some((h) => label(h).trim().toLowerCase() === term.toLowerCase());
        setHits(res);
        setActive(0);
        setOpen(res.length > 0 && !exact);
      } catch {
        if (!cancelled) setOpen(false);
      }
    }, DEBOUNCE_MS);
    return () => { cancelled = true; clearTimeout(t); };
  }, [value, manual]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) close();
    };
    const onScroll = () => close();
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, close]);

  const pick = (h: T) => {
    close();
    setHits([]);
    onPick(h);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === " " && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      armed.current = true;
      setManual((n) => n + 1);
      return;
    }
    if (e.key === "Escape") { close(); return; }
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
      armed.current = true;
      onChange(e.target.value);
    },
    // Фокус сам по себе подсказки не открывает.
    onFocus: () => { close(); },
    onBlur: () => { close(); onBlurCapture?.(); },
    onKeyDown,
  };

  return (
    <div ref={boxRef} className="relative">
      {multiline ? <Textarea rows={rows} {...common} /> : <Input {...common} />}
      {open && hits.length > 0 && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full max-h-[13.5rem] overflow-auto rounded-md border bg-popover shadow-md">
          {hits.slice(0, 5).map((h, i) => (
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
