// Календарь мероприятий: даты заказов (event_date). FullCalendar.
// Клик по дню открывает панель со списком заказов этого дня, статусы фильтруются.
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import { ClientOnly } from "@tanstack/react-router";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { displayOrderNumber } from "@/lib/order-number";
import { fmtDate } from "@/lib/formatters";

export const Route = createFileRoute("/admin/calendar")({
  head: () => ({ meta: [{ title: "Календарь мероприятий — Админ" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: CalendarPage,
});

const COLOR: Record<string, string> = {
  new: "#f59e0b",
  consultation: "#f59e0b",
  confirmed: "#7c3aed",
  paid: "#10b981",
  in_progress: "#3b82f6",
  completed: "#10b981",
  cancelled: "#ef4444",
};

// Группы легенды = группы фильтра: один клик скрывает/показывает статусы.
const LEGEND: Array<{ key: string; label: string; statuses: string[] }> = [
  { key: "new", label: "Новые / консультация", statuses: ["new", "consultation"] },
  { key: "confirmed", label: "Подтверждён", statuses: ["confirmed"] },
  { key: "in_progress", label: "В работе", statuses: ["in_progress"] },
  { key: "paid", label: "Оплачен / завершён", statuses: ["paid", "completed"] },
  { key: "cancelled", label: "Отменён", statuses: ["cancelled"] },
];

interface CalOrder {
  id: string;
  order_number: string | null;
  client_name: string | null;
  event_date: string;
  status: string;
}

function CalendarPage() {
  const navigate = useNavigate();
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [day, setDay] = useState<string | null>(null);

  const { data: orders = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["calendar-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, client_name, event_date, status")
        .not("event_date", "is", null)
        .limit(500);
      if (error) throw error;
      return (data ?? []) as CalOrder[];
    },
  });

  const visible = useMemo(() => {
    const off = new Set(LEGEND.filter((l) => hidden.has(l.key)).flatMap((l) => l.statuses));
    return orders.filter((o) => !off.has(o.status));
  }, [orders, hidden]);

  const events = useMemo(
    () =>
      visible.map((o) => ({
        id: o.id,
        title: `${displayOrderNumber(o)} · ${o.client_name ?? "—"}`,
        start: o.event_date,
        allDay: true,
        color: COLOR[o.status] ?? "#7c3aed",
      })),
    [visible],
  );

  const dayOrders = day ? visible.filter((o) => o.event_date.slice(0, 10) === day) : [];
  const todayKey = new Date().toISOString().slice(0, 10);
  const todayCount = visible.filter((o) => o.event_date.slice(0, 10) === todayKey).length;

  const toggle = (key: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Календарь"
        subtitle={
          isLoading
            ? "Загружаем даты мероприятий…"
            : `${visible.length} мероприятий · сегодня: ${todayCount} · клик по дню показывает список`
        }
        action={
          <Button size="sm" variant="outline" onClick={() => setDay(todayKey)}>
            События сегодня
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {LEGEND.map((l) => {
          const off = hidden.has(l.key);
          return (
            <button
              key={l.key}
              type="button"
              onClick={() => toggle(l.key)}
              aria-pressed={!off}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition ${
                off ? "opacity-40 border-border" : "border-primary/40 bg-primary/5"
              }`}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLOR[l.statuses[0]!] }} aria-hidden="true" />
              {l.label}
            </button>
          );
        })}
      </div>

      {isError && (
        <div className="glass rounded-xl p-4 text-sm text-destructive flex items-center gap-3">
          Не удалось загрузить события календаря.
          <Button size="sm" variant="outline" onClick={() => void refetch()}>Повторить</Button>
        </div>
      )}

      {!isLoading && !isError && orders.length === 0 && (
        <div className="glass rounded-xl p-4 text-sm text-muted-foreground">
          Пока нет заказов с указанной датой мероприятия — заполните «Дата мероприятия» в карточке заказа.
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <div className="glass rounded-xl p-4 [&_.fc]:text-foreground [&_.fc-button]:bg-primary [&_.fc-button]:border-0 [&_.fc-event]:cursor-pointer [&_.fc-daygrid-day]:cursor-pointer">
          <ClientOnly fallback={<div className="h-[500px] flex items-center justify-center text-muted-foreground">Загрузка календаря…</div>}>
            <FullCalendar
              plugins={[dayGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              locale="ru"
              firstDay={1}
              height={650}
              events={events}
              dateClick={(info) => setDay(info.dateStr)}
              eventClick={(info) => {
                info.jsEvent.preventDefault();
                void navigate({ to: "/admin/orders/$id", params: { id: info.event.id } });
              }}
              buttonText={{ today: "Сегодня", month: "Месяц", week: "Неделя" }}
              headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,dayGridWeek" }}
            />
          </ClientOnly>
        </div>

        <aside className="glass rounded-xl p-4 space-y-3 h-max">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">
              {day ? fmtDate(day) : "Выберите день"}
            </h2>
            {day && (
              <Button size="sm" variant="ghost" onClick={() => setDay(null)}>Очистить</Button>
            )}
          </div>
          {!day && (
            <p className="text-xs text-muted-foreground">
              Кликните по дате в календаре, чтобы увидеть все мероприятия этого дня.
            </p>
          )}
          {day && dayOrders.length === 0 && (
            <p className="text-xs text-muted-foreground">На этот день мероприятий нет.</p>
          )}
          <ul className="space-y-2">
            {dayOrders.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => void navigate({ to: "/admin/orders/$id", params: { id: o.id } })}
                  className="w-full text-left rounded-lg border border-border/60 p-2.5 hover:bg-muted/50 transition"
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: COLOR[o.status] ?? "#7c3aed" }} aria-hidden="true" />
                    {displayOrderNumber(o)}
                  </span>
                  <span className="block text-xs text-muted-foreground truncate">{o.client_name ?? "—"}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
