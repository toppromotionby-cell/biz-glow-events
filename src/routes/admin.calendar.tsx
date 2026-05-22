// Календарь бронирований оборудования и зон. FullCalendar.
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import { ClientOnly } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/calendar")({
  component: CalendarPage,
});

const COLOR: Record<string, string> = {
  booked: "#7c3aed", hold: "#f59e0b", maintenance: "#ef4444", released: "#10b981",
};

function CalendarPage() {
  const { data: events = [] } = useQuery({
    queryKey: ["availability"],
    queryFn: async () => {
      const { data } = await supabase.from("availability").select("*").limit(500);
      return (data ?? []).map((a: any) => ({
        id: a.id,
        title: `${a.entity_type} · ${a.status}`,
        start: a.start_date,
        end: a.end_date,
        color: COLOR[a.status] ?? "#7c3aed",
      }));
    },
  });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-3xl font-display font-bold gradient-text">Календарь</h1>
        <p className="text-sm text-muted-foreground">Бронирования и доступность ресурсов</p>
      </header>
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
