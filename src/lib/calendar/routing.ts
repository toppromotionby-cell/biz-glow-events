// Куда уходит запись: основной Google Календарь, календарь задач или оба.
// Клиент-безопасный модуль: одна и та же логика в UI, боте и на сервере.
import type { CalItem } from "@/lib/calendar/model";

export type TaskRouting = "auto" | "calendar" | "tasks" | "both";
export type RouteTarget = "calendar" | "tasks" | "both" | "none";

export const ROUTING_LABEL: Record<TaskRouting, string> = {
  auto: "Автоматически (встречи — в общий календарь, задачи — в календарь задач)",
  calendar: "Всё в основной Google Календарь",
  tasks: "Задачи всегда в календарь задач направления",
  both: "Задачи со временем — и туда, и туда",
};


/**
 * Правило маршрутизации:
 * - встреча всегда событие календаря;
 * - задача без конкретного времени — Google Tasks;
 * - задача со временем — по настройке (auto → календарь, tasks → задачи, both → оба).
 */
export function routeTarget(
  item: Pick<CalItem, "kind" | "starts_at" | "due_at">,
  routing: TaskRouting = "auto",
): RouteTarget {
  if (item.kind === "meeting") return "calendar";
  if (routing === "calendar") return item.starts_at ? "calendar" : "none";
  const timed = Boolean(item.starts_at);
  if (!timed) return "tasks";
  if (routing === "tasks") return "tasks";
  if (routing === "both") return "both";
  return "calendar";
}

export function targetLabel(t: RouteTarget): string {
  return t === "calendar"
    ? "Google Календарь"
    : t === "tasks"
      ? "Календарь задач"
      : t === "both"
        ? "Календарь + задачи"
        : "только в планере";
}
