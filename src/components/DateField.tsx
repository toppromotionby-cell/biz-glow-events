import { useState } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * Поле даты с поддержкой одиночной даты и периода (range).
 *  - Без `endName`: одиночная дата, скрытый input `name` = ISO (YYYY-MM-DD).
 *  - С `endName`: появляется переключатель «Один день / Период».
 *    В режиме «Период» помимо `name` (начало) заполняется `endName` (конец).
 */
export function DateField({
  label,
  name,
  endName,
  required,
  minDate,
}: {
  label: string;
  name: string;
  /** Если задано — включён режим выбора периода с этим именем для даты окончания. */
  endName?: string;
  required?: boolean;
  minDate?: Date;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"single" | "range">("single");
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [range, setRange] = useState<DateRange | undefined>(undefined);

  const startIso =
    mode === "single"
      ? date ? format(date, "yyyy-MM-dd") : ""
      : range?.from ? format(range.from, "yyyy-MM-dd") : "";
  const endIso =
    mode === "range" && range?.to ? format(range.to, "yyyy-MM-dd") : "";

  // Закрываем popover автоматически, когда выбор завершён.
  const onPickSingle = (d: Date | undefined) => {
    setDate(d);
    if (d) setOpen(false);
  };
  const onPickRange = (r: DateRange | undefined) => {
    setRange(r);
    if (r?.from && r?.to) setOpen(false);
  };

  const buttonLabel = (() => {
    if (mode === "single") {
      return date ? format(date, "d MMMM yyyy", { locale: ru }) : "Выберите дату";
    }
    if (range?.from && range?.to) {
      return `${format(range.from, "d MMM", { locale: ru })} — ${format(range.to, "d MMM yyyy", { locale: ru })}`;
    }
    if (range?.from) {
      return `${format(range.from, "d MMM yyyy", { locale: ru })} — выберите конец`;
    }
    return "Выберите период";
  })();

  return (
    <div className="block text-sm">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-muted-foreground">{label}</span>
        {endName ? (
          <div className="inline-flex rounded-md border border-border bg-background/50 p-0.5 text-[11px]">
            <button
              type="button"
              onClick={() => { setMode("single"); setRange(undefined); }}
              aria-pressed={mode === "single"}
              className={cn(
                "px-2 py-0.5 rounded transition",
                mode === "single" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              Один день
            </button>
            <button
              type="button"
              onClick={() => { setMode("range"); setDate(undefined); }}
              aria-pressed={mode === "range"}
              className={cn(
                "px-2 py-0.5 rounded transition",
                mode === "range" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              Период
            </button>
          </div>
        ) : null}
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "mt-1 w-full inline-flex items-center justify-between rounded-md bg-background/50 border border-border px-3 py-2 text-left outline-none focus:border-primary transition",
              !startIso && "text-muted-foreground",
            )}
          >
            <span className="truncate">{buttonLabel}</span>
            <CalendarIcon className="h-4 w-4 opacity-60 shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 z-50 bg-popover" align="start">
          {mode === "single" ? (
            <Calendar
              mode="single"
              selected={date}
              onSelect={onPickSingle}
              disabled={(d) => (minDate ? d < minDate : false)}
              initialFocus
              locale={ru}
              className={cn("p-3 pointer-events-auto")}
            />
          ) : (
            <Calendar
              mode="range"
              selected={range}
              onSelect={onPickRange}
              numberOfMonths={1}
              disabled={(d) => (minDate ? d < minDate : false)}
              initialFocus
              locale={ru}
              className={cn("p-3 pointer-events-auto")}
            />
          )}
        </PopoverContent>
      </Popover>

      <input type="hidden" name={name} value={startIso} required={required} />
      {endName ? <input type="hidden" name={endName} value={endIso} /> : null}
    </div>
  );
}
