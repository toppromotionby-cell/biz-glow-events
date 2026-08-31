// Верхняя полоса показателей планера: сегодня / просрочено / встречи / закрыто.
import { CalendarDays, AlarmClock, Users, CheckCircle2 } from "lucide-react";
import type { CalItem } from "@/lib/calendar/model";
import { isOverdue } from "@/lib/calendar/model";

export function PlannerStats({ items }: { items: CalItem[] }) {
  const now = new Date();
  const today = items.filter((i) => {
    const d = i.starts_at ?? i.due_at;
    return d && new Date(d).toDateString() === now.toDateString() && i.status !== "canceled";
  });
  const cells = [
    { label: "Сегодня", value: today.length, icon: CalendarDays, tone: "text-primary" },
    {
      label: "Просрочено",
      value: items.filter((i) => isOverdue(i, now)).length,
      icon: AlarmClock,
      tone: "text-destructive",
    },
    {
      label: "Встречи сегодня",
      value: today.filter((i) => i.kind === "meeting").length,
      icon: Users,
      tone: "text-blue-600 dark:text-blue-400",
    },
    {
      label: "Закрыто сегодня",
      value: items.filter((i) => i.completed_at && new Date(i.completed_at).toDateString() === now.toDateString()).length,
      icon: CheckCircle2,
      tone: "text-emerald-600 dark:text-emerald-400",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {cells.map((c) => (
        <div key={c.label} className="rounded-xl border bg-card p-3 shadow-sm">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <c.icon className={`size-4 ${c.tone}`} />
            {c.label}
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{c.value}</div>
        </div>
      ))}
    </div>
  );
}
