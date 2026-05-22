// Mini availability calendar — shows booked/maintenance dates for an item.
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { listItemAvailability, type AvailabilityRow } from "@/lib/availability.functions";
import type { CatalogType } from "@/lib/catalog.functions";

const WD = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function ymd(d: Date) { return d.toISOString().slice(0, 10); }
function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
function addMonths(d: Date, n: number) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }

function buildStatusMap(rows: AvailabilityRow[]): Map<string, "booked" | "maintenance"> {
  const m = new Map<string, "booked" | "maintenance">();
  for (const r of rows) {
    const s = new Date(r.start_date);
    const e = new Date(r.end_date);
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
      const key = ymd(d);
      // booked wins over maintenance
      if (r.status === "booked" || !m.has(key)) m.set(key, r.status);
    }
  }
  return m;
}

export function AvailabilityCalendar({ entityType, itemId }: { entityType: CatalogType; itemId: string }) {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const from = ymd(startOfMonth(cursor));
  const to = ymd(endOfMonth(addMonths(cursor, 1)));

  const { data: rows = [] } = useQuery({
    queryKey: ["availability", entityType, itemId, from, to],
    queryFn: () => listItemAvailability({ data: { entity_type: entityType, item_id: itemId, from, to } }),
  });

  const status = useMemo(() => buildStatusMap(rows), [rows]);

  const today = ymd(new Date());
  const first = startOfMonth(cursor);
  const last = endOfMonth(cursor);
  // Monday-first offset
  const lead = (first.getDay() + 6) % 7;
  const cells: Array<{ key: string; date: Date | null }> = [];
  for (let i = 0; i < lead; i++) cells.push({ key: `lead-${i}`, date: null });
  for (let d = 1; d <= last.getDate(); d++) {
    const date = new Date(cursor.getFullYear(), cursor.getMonth(), d);
    cells.push({ key: ymd(date), date });
  }
  while (cells.length % 7 !== 0) cells.push({ key: `tail-${cells.length}`, date: null });

  const monthLabel = cursor.toLocaleDateString("ru-BY", { month: "long", year: "numeric" });

  return (
    <div className="glass rounded-xl p-5">
      <header className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">Занятость</h2>
        <div className="flex items-center gap-2">
          <button onClick={() => setCursor(addMonths(cursor, -1))} className="p-1.5 rounded hover:bg-muted/40" aria-label="Назад"><ChevronLeft className="h-4 w-4" /></button>
          <span className="text-sm font-medium capitalize w-36 text-center">{monthLabel}</span>
          <button onClick={() => setCursor(addMonths(cursor, 1))} className="p-1.5 rounded hover:bg-muted/40" aria-label="Вперёд"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </header>

      <div className="grid grid-cols-7 gap-1 text-xs">
        {WD.map(w => <div key={w} className="text-center text-muted-foreground py-1">{w}</div>)}
        {cells.map(({ key, date }) => {
          if (!date) return <div key={key} />;
          const k = ymd(date);
          const st = status.get(k);
          const isToday = k === today;
          const cls = st === "booked"
            ? "bg-destructive/20 text-destructive border-destructive/40"
            : st === "maintenance"
            ? "bg-warning/20 text-warning border-warning/40"
            : "border-border/40 hover:bg-muted/30";
          return (
            <div
              key={key}
              title={st === "booked" ? "Занято" : st === "maintenance" ? "Обслуживание" : "Свободно"}
              className={`aspect-square flex items-center justify-center rounded border text-xs ${cls} ${isToday ? "ring-1 ring-primary" : ""}`}
            >
              {date.getDate()}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded border border-border/40" />Свободно</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-destructive/30 border border-destructive/40" />Занято</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-warning/30 border border-warning/40" />Обслуживание</span>
      </div>
    </div>
  );
}
