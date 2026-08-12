// Календарь мероприятий: даты заказов (event_date). FullCalendar.
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import { ClientOnly } from "@tanstack/react-router";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { displayOrderNumber } from "@/lib/order-number";

export const Route = createFileRoute("/admin/calendar")({
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

const LEGEND: Array<{ status: string; label: string }> = [
  { status: "new", label: "Новые / консультация" },
  { status: "confirmed", label: "Подтверждён" },
  { status: "in_progress", label: "В работе" },
  { status: "paid", label: "Оплачен / завершён" },
  { status: "cancelled", label: "Отменён" },
];

function CalendarPage() {
  const navigate = useNavigate();
  const { data: events = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["calendar-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, client_name, event_date, status")
        .not("event_date", "is", null)
        .limit(500);
      if (error) throw error;
      return (data ?? []).map((o) => ({
        id: o.id,
        title: `${displayOrderNumber(o)} · ${o.client_name}`,
        start: o.event_date as string,
        allDay: true,
        color: COLOR[o.status] ?? "#7c3aed",
      }));
    },
  });

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Календарь"
        subtitle={
          isLoading
            ? "Загружаем даты мероприятий…"
            : `${events.length} мероприятий с датой · клик по событию открывает заказ`
        }
      />

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {LEGEND.map((l) => (
          <span key={l.status} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLOR[l.status] }} aria-hidden="true" />
            {l.label}
          </span>
        ))}
      </div>

      {isError && (
        <div className="glass rounded-xl p-4 text-sm text-destructive flex items-center gap-3">
          Не удалось загрузить события календаря.
          <Button size="sm" variant="outline" onClick={() => void refetch()}>Повторить</Button>
        </div>
      )}

      {!isLoading && !isError && events.length === 0 && (
        <div className="glass rounded-xl p-4 text-sm text-muted-foreground">
          Пока нет заказов с указанной датой мероприятия — заполните «Дата мероприятия» в карточке заказа.
        </div>
      )}

      <div className="glass rounded-xl p-4 [&_.fc]:text-foreground [&_.fc-button]:bg-primary [&_.fc-button]:border-0 [&_.fc-event]:cursor-pointer">
        <ClientOnly fallback={<div className="h-[500px] flex items-center justify-center text-muted-foreground">Загрузка календаря…</div>}>
          <FullCalendar
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            locale="ru"
            firstDay={1}
            height={650}
            events={events}
            eventClick={(info) => {
              info.jsEvent.preventDefault();
              void navigate({ to: "/admin/orders/$id", params: { id: info.event.id } });
            }}
            buttonText={{ today: "Сегодня", month: "Месяц", week: "Неделя" }}
            headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,dayGridWeek" }}
          />
        </ClientOnly>
      </div>
    </div>
  );
}
