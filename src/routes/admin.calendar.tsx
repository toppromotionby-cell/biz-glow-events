// Календарь мероприятий: даты заказов (event_date). FullCalendar.
import { createFileRoute } from "@tanstack/react-router";
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

function CalendarPage() {
  const { data: events = [] } = useQuery({
    queryKey: ["calendar-orders"],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, order_number, client_name, event_date, status")
        .not("event_date", "is", null)
        .limit(500);
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
      <AdminPageHeader title="Календарь" subtitle="Даты мероприятий по заказам" />

      <div className="glass rounded-xl p-4 [&_.fc]:text-foreground [&_.fc-button]:bg-primary [&_.fc-button]:border-0">
        <ClientOnly fallback={<div className="h-[500px] flex items-center justify-center text-muted-foreground">Загрузка календаря…</div>}>
          <FullCalendar
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            locale="ru"
            firstDay={1}
            height={650}
            events={events}
            headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,dayGridWeek" }}
          />
        </ClientOnly>
      </div>
    </div>
  );
}
