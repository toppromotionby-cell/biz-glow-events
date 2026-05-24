import { useState } from "react";
import { format } from "date-fns/format";
import { ru } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * Поле даты с кликабельным календарём (shadcn).
 * Скрытый input передаёт ISO-дату (YYYY-MM-DD) в FormData по имени `name`.
 */
export function DateField({
  label,
  name,
  required,
  minDate,
}: {
  label: string;
  name: string;
  required?: boolean;
  minDate?: Date;
}) {
  const [date, setDate] = useState<Date | undefined>(undefined);
  const iso = date ? format(date, "yyyy-MM-dd") : "";

  return (
    <div className="block text-sm">
      <span className="text-muted-foreground">{label}</span>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "mt-1 w-full inline-flex items-center justify-between rounded-md bg-background/50 border border-border px-3 py-2 text-left outline-none focus:border-primary transition",
              !date && "text-muted-foreground"
            )}
          >
            <span>{date ? format(date, "d MMMM yyyy", { locale: ru }) : "Выберите дату"}</span>
            <CalendarIcon className="h-4 w-4 opacity-60" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            disabled={(d) => (minDate ? d < minDate : false)}
            initialFocus
            locale={ru}
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
      <input type="hidden" name={name} value={iso} required={required} />
    </div>
  );
}
