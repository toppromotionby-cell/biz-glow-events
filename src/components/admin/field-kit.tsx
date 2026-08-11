// Общие поля для таблиц позиций (смета и промо-КП).
// Задача: ввод не должен «прыгать» — поле хранит то, что печатает человек,
// а в модель уходит уже нормализованное значение.
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";

type NumFieldProps = {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  step?: string | number;
  className?: string;
  placeholder?: string;
  "aria-label"?: string;
};

/**
 * Числовое поле: можно очистить, можно набирать «0,5» или «1.» — каретка не прыгает.
 * В модель значение уходит сразу (пустое поле = 0), а при уходе из поля текст нормализуется.
 */
export function NumField({ value, onChange, min = 0, step, className, placeholder, ...rest }: NumFieldProps) {
  const [text, setText] = useState(() => String(value ?? 0));
  const focused = useRef(false);

  // Внешние изменения (пересчёт, импорт, отмена) подхватываем только когда поле не редактируют.
  useEffect(() => {
    if (!focused.current && Number(text) !== Number(value)) setText(String(value ?? 0));
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const parse = (raw: string) => {
    const n = Number(raw.replace(",", "."));
    if (!Number.isFinite(n)) return null;
    return min !== undefined && n < min ? min : n;
  };

  return (
    <Input
      {...rest}
      type="text"
      inputMode="decimal"
      step={step}
      placeholder={placeholder}
      className={className}
      value={text}
      onFocus={(e) => {
        focused.current = true;
        e.currentTarget.select();
      }}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw !== "" && !/^-?\d*[.,]?\d*$/.test(raw)) return;
        setText(raw);
        if (raw === "" || raw === "," || raw === ".") { onChange(0); return; }
        const n = parse(raw);
        if (n !== null) onChange(n);
      }}
      onBlur={() => {
        focused.current = false;
        const n = parse(text);
        const next = n === null ? 0 : n;
        setText(String(next));
        onChange(next);
      }}
    />
  );
}

type TextCommitFieldProps = {
  value: string;
  onCommit: (v: string) => void;
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
};

/**
 * Текстовое поле с отложенным применением: значение уходит в модель по Enter или потере фокуса.
 * Нужно там, где изменение значения перестраивает список (названия разделов) —
 * иначе каждый символ пересобирает блок и сбивает курсор.
 */
export function TextCommitField({ value, onCommit, placeholder, className, ...rest }: TextCommitFieldProps) {
  const [text, setText] = useState(value);
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(value);
  }, [value]);

  const commit = () => {
    if (text !== value) onCommit(text);
  };

  return (
    <Input
      {...rest}
      value={text}
      placeholder={placeholder}
      className={className}
      onFocus={() => { focused.current = true; }}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => { focused.current = false; commit(); }}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); commit(); e.currentTarget.blur(); }
        if (e.key === "Escape") { setText(value); e.currentTarget.blur(); }
      }}
    />
  );
}
