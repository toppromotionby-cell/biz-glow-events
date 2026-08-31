// Настройка Google Задач: куда уходят задачи и как связаны списки с направлениями.
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { plannerTasksStatus } from "@/lib/calendar.functions";
import { ROUTING_LABEL, type TaskRouting } from "@/lib/calendar/routing";
import type { AssistantPrefs, CalDirection } from "@/lib/calendar/model";

export interface TasksRoutingCardProps {
  prefs: AssistantPrefs | undefined;
  directions: CalDirection[];
  onSave: (patch: { task_routing?: TaskRouting; gtasks_enabled?: boolean }) => void;
}

export function TasksRoutingCard({ prefs, directions, onSave }: TasksRoutingCardProps) {
  const statusFn = useServerFn(plannerTasksStatus);
  const { data: status } = useQuery({ queryKey: ["planner-tasks-status"], queryFn: () => statusFn({}) });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Задачи в Google</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {status && status.configured && !status.scopeOk ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            Google отклонил запрос: подключение потеряло доступ. Переподключите Google в настройках подключений —
            задачи пока остаются только в планере.
          </div>
        ) : null}

        <p className="text-xs text-muted-foreground">
          Задачи уходят в отдельные календари «Задачи · Направление» событиями на весь день. Отметка ✅ в начале
          названия события вернётся в планер как выполненная задача.
        </p>

        <div className="flex items-center justify-between gap-4">
          <div>
            <Label>Синхронизировать задачи</Label>
            <p className="text-xs text-muted-foreground">Дела без времени попадают в календарь задач по направлению.</p>
          </div>
          <Switch
            checked={prefs?.gtasks_enabled ?? true}
            onCheckedChange={(v) => onSave({ gtasks_enabled: v })}
          />
        </div>

        <div>
          <Label>Правило распределения</Label>
          <Select
            value={prefs?.task_routing ?? "auto"}
            onValueChange={(v) => onSave({ task_routing: v as TaskRouting })}
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(ROUTING_LABEL) as TaskRouting[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {ROUTING_LABEL[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Календари задач по направлениям</Label>
          <div className="mt-2 space-y-1">
            {directions.map((d) => {
              const linked = Boolean((d as { google_calendar_id?: string | null }).google_calendar_id);
              return (
                <div key={d.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <span className="inline-flex items-center gap-2">
                    <span className="size-2 rounded-full" style={{ background: d.color }} />
                    {d.title}
                  </span>
                  <Badge variant={linked ? "secondary" : "outline"}>
                    {linked ? "календарь создан" : "создастся при первой задаче"}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

