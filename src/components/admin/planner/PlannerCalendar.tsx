// Полноценный календарь планера: день / неделя / месяц / год.
// Фильтры по типу (задачи/встречи), направлению и статусу; перетаскивание переносит запись.
import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import multiMonthPlugin from "@fullcalendar/multimonth";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventDropArg, EventInput } from "@fullcalendar/core";
import { ClientOnly } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { listPlannerRange } from "@/lib/calendar.functions";
import type { CalDirection, CalItem, CalKind } from "@/lib/calendar/model";
import { STATUS_LABEL } from "@/lib/calendar/model";

type StatusKey = CalItem["status"];

const STATUSES: StatusKey[] = ["planned", "in_progress", "done"];

export interface PlannerCalendarProps {
  directions: CalDirection[];
  onEdit: (item: CalItem) => void;
  onCreate: (startIso: string, endIso: string | null, allDay: boolean) => void;
  onMove: (item: CalItem, whenIso: string) => Promise<unknown> | void;
}

export function PlannerCalendar({ directions, onEdit, onCreate, onMove }: PlannerCalendarProps) {
  const load = useServerFn(listPlannerRange);
  const ref = useRef<FullCalendar | null>(null);

  const [span, setSpan] = useState<{ from: string; to: string }>(() => {
    const from = new Date();
    from.setDate(1);
    from.setHours(0, 0, 0, 0);
    from.setDate(from.getDate() - 10);
    const to = new Date(from.getTime() + 70 * 86_400_000);
    return { from: from.toISOString(), to: to.toISOString() };
  });

  const [kinds, setKinds] = useState<Set<CalKind>>(new Set<CalKind>(["task", "meeting"]));
  const [dirIds, setDirIds] = useState<Set<string>>(new Set());
  const [statuses, setStatuses] = useState<Set<StatusKey>>(new Set<StatusKey>(["planned", "in_progress"]));

  const { data, isFetching } = useQuery({
    queryKey: ["planner-range", span.from, span.to],
    queryFn: () => load({ data: span }),
  });

  const items = data?.items ?? [];

  const toggle = <T,>(set: Set<T>, value: T, apply: (s: Set<T>) => void) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    apply(next);
  };

  const filtered = useMemo(
    () =>
      items.filter(
        (i) =>
          kinds.has(i.kind) &&
          statuses.has(i.status) &&
          (dirIds.size === 0 || (i.direction_id ? dirIds.has(i.direction_id) : false)),
      ),
    [items, kinds, statuses, dirIds],
  );

  const events: EventInput[] = useMemo(
    () =>
      filtered.map((i) => {
        const dir = directions.find((d) => d.id === i.direction_id);
        const start = i.starts_at ?? i.due_at;
        const color = dir?.color ?? (i.kind === "meeting" ? "#3b82f6" : "#64748b");
        return {
          id: i.id,
          title: `${i.kind === "meeting" ? "🗓" : "✓"} ${i.title}`,
          start: start ?? undefined,
          end: i.ends_at ?? undefined,
          allDay: i.all_day || !i.starts_at,
          backgroundColor: i.status === "done" ? "#94a3b8" : color,
          borderColor: i.importance === "hard" ? "#ef4444" : color,
          textColor: "#ffffff",
          extendedProps: { item: i },
        } satisfies EventInput;
      }),
    [filtered, directions],
  );

  const counts = useMemo(
    () => ({
      task: filtered.filter((i) => i.kind === "task").length,
      meeting: filtered.filter((i) => i.kind === "meeting").length,
    }),
    [filtered],
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Показывать:</span>
        <Button
          size="sm"
          variant={kinds.has("task") ? "default" : "outline"}
          onClick={() => toggle(kinds, "task" as CalKind, setKinds)}
        >
          Задачи ({counts.task})
        </Button>
        <Button
          size="sm"
          variant={kinds.has("meeting") ? "default" : "outline"}
          onClick={() => toggle(kinds, "meeting" as CalKind, setKinds)}
        >
          Встречи ({counts.meeting})
        </Button>
        <span className="mx-1 h-5 w-px bg-border" />
        {STATUSES.map((s) => (
          <Button key={s} size="sm" variant={statuses.has(s) ? "secondary" : "outline"} onClick={() => toggle(statuses, s, setStatuses)}>
            {STATUS_LABEL[s] ?? s}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Направления:</span>
        <Button size="sm" variant={dirIds.size === 0 ? "default" : "outline"} onClick={() => setDirIds(new Set())}>
          Все
        </Button>
        {directions.map((d) => (
          <Button key={d.id} size="sm" variant={dirIds.has(d.id) ? "default" : "outline"} onClick={() => toggle(dirIds, d.id, setDirIds)}>
            <span className="mr-2 size-2 rounded-full" style={{ background: d.color }} />
            {d.title}
          </Button>
        ))}
        {isFetching ? <Badge variant="outline">обновление…</Badge> : null}
      </div>

      <div className="rounded-lg border p-2 [&_.fc]:text-sm">
        <ClientOnly fallback={<div className="p-10 text-center text-sm text-muted-foreground">Загрузка календаря…</div>}>
          <FullCalendar
            ref={ref}
            plugins={[dayGridPlugin, timeGridPlugin, multiMonthPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "timeGridDay,timeGridWeek,dayGridMonth,multiMonthYear",
            }}
            buttonText={{ today: "Сегодня", day: "День", week: "Неделя", month: "Месяц", year: "Год" }}
            locale="ru"
            firstDay={1}
            height="auto"
            nowIndicator
            slotMinTime="07:00:00"
            slotMaxTime="23:00:00"
            editable
            selectable
            dayMaxEvents={4}
            events={events}
            datesSet={(arg) => {
              const from = arg.start.toISOString();
              const to = arg.end.toISOString();
              setSpan((prev) => (prev.from === from && prev.to === to ? prev : { from, to }));
            }}
            eventClick={(arg) => {
              const item = arg.event.extendedProps["item"] as CalItem | undefined;
              if (item) onEdit(item);
            }}
            select={(arg) => onCreate(arg.start.toISOString(), arg.end ? arg.end.toISOString() : null, arg.allDay)}
            eventDrop={(arg: EventDropArg) => {
              const item = arg.event.extendedProps["item"] as CalItem | undefined;
              const when = arg.event.start;
              if (!item || !when) {
                arg.revert();
                return;
              }
              void Promise.resolve(onMove(item, when.toISOString())).catch(() => arg.revert());
            }}
          />
        </ClientOnly>
      </div>
    </div>
  );
}
