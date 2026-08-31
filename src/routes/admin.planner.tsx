// Планер и умный ассистент: задачи и встречи по направлениям,
// двусторонняя синхронизация с Google Календарём, связка с Telegram-ботом.
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  deletePlannerItem,
  listPlannerData,
  reschedulePlannerItem,
  savePlannerPrefs,
  savePlannerItem,
  setPlannerStatus,
  syncPlannerGoogle,
} from "@/lib/calendar.functions";
import {
  fmtWhen,
  isOverdue,
  priorityScore,
  STATUS_LABEL,
  type CalDirection,
  type CalItem,
  type CalKind,
} from "@/lib/calendar/model";
import { CalendarClock, Check, RefreshCw, Trash2 } from "lucide-react";

export const Route = createFileRoute("/admin/planner")({
  head: () => ({
    meta: [
      { title: "Планер и ассистент — Админ" },
      { name: "description", content: "Умный планер: задачи, встречи, направления, Google Календарь и Telegram-ассистент." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: PlannerPage,
});

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocalInput(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

interface DraftItem {
  id?: string;
  kind: CalKind;
  title: string;
  notes: string;
  direction_id: string | null;
  starts_at: string;
  ends_at: string;
  due_at: string;
  importance: "normal" | "hard";
  location: string;
}

const emptyDraft: DraftItem = {
  kind: "task",
  title: "",
  notes: "",
  direction_id: null,
  starts_at: "",
  ends_at: "",
  due_at: "",
  importance: "normal",
  location: "",
};

function PlannerPage() {
  const qc = useQueryClient();
  const load = useServerFn(listPlannerData);
  const save = useServerFn(savePlannerItem);
  const setStatusFn = useServerFn(setPlannerStatus);
  const moveFn = useServerFn(reschedulePlannerItem);
  const delFn = useServerFn(deletePlannerItem);
  const prefsFn = useServerFn(savePlannerPrefs);
  const syncFn = useServerFn(syncPlannerGoogle);

  const range = useMemo(() => {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    from.setDate(from.getDate() - 7);
    const to = new Date(from.getTime() + 45 * 86_400_000);
    return { from: from.toISOString(), to: to.toISOString() };
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["planner", range.from],
    queryFn: () => load({ data: range }),
  });

  // Часовой пояс берём с устройства и запоминаем — им пользуется ассистент.
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz || !data) return;
    if (data.prefs.last_device_tz === tz) return;
    void prefsFn({ data: { device_tz: tz } });
  }, [data, prefsFn]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["planner"] });

  const saveMut = useMutation({
    mutationFn: (d: DraftItem) =>
      save({
        data: {
          id: d.id,
          kind: d.kind,
          title: d.title.trim(),
          notes: d.notes || null,
          direction_id: d.direction_id,
          starts_at: fromLocalInput(d.starts_at),
          ends_at: fromLocalInput(d.ends_at),
          due_at: fromLocalInput(d.due_at),
          importance: d.importance,
          location: d.location || null,
        },
      }),
    onSuccess: () => {
      toast.success("Сохранено");
      setDraft(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [draft, setDraft] = useState<DraftItem | null>(null);
  const [moveTarget, setMoveTarget] = useState<CalItem | null>(null);
  const [moveWhen, setMoveWhen] = useState("");

  const items = data?.items ?? [];
  const directions = data?.directions ?? [];
  const [dirFilter, setDirFilter] = useState<string>("all");

  const now = new Date();
  const visible = items
    .filter((i) => dirFilter === "all" || i.direction_id === dirFilter)
    .filter((i) => i.status !== "canceled");
  const today = visible.filter((i) => {
    const d = i.starts_at ?? i.due_at;
    return d && new Date(d).toDateString() === now.toDateString();
  });
  const overdue = visible.filter((i) => isOverdue(i, now));
  const upcoming = visible
    .filter((i) => {
      const d = i.starts_at ?? i.due_at;
      return d && new Date(d) > now && new Date(d).toDateString() !== now.toDateString();
    })
    .sort((a, b) => new Date(a.starts_at ?? a.due_at ?? 0).getTime() - new Date(b.starts_at ?? b.due_at ?? 0).getTime());
  const byPriority = [...visible]
    .filter((i) => i.status !== "done")
    .sort((a, b) => priorityScore(b, now) - priorityScore(a, now))
    .slice(0, 10);

  const dirOf = (item: CalItem): CalDirection | null => directions.find((d) => d.id === item.direction_id) ?? null;

  function ItemRow({ item }: { item: CalItem }) {
    const dir = dirOf(item);
    return (
      <div className="flex items-start gap-3 rounded-lg border p-3">
        <button
          type="button"
          aria-label="Отметить сделанным"
          onClick={() => setStatusFn({ data: { id: item.id, status: item.status === "done" ? "planned" : "done" } }).then(invalidate)}
          className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded border ${item.status === "done" ? "bg-primary text-primary-foreground" : "bg-background"}`}
        >
          {item.status === "done" ? <Check className="size-3.5" /> : null}
        </button>
        <div className="min-w-0 flex-1">
          <div className={`truncate font-medium ${item.status === "done" ? "text-muted-foreground line-through" : ""}`}>
            {item.importance === "hard" ? "🔒 " : ""}
            {item.title}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {dir ? (
              <span className="inline-flex items-center gap-1">
                <span className="size-2 rounded-full" style={{ background: dir.color }} />
                {dir.title}
              </span>
            ) : null}
            <span>{item.kind === "meeting" ? "Встреча" : "Задача"}</span>
            <span>{fmtWhen(item)}</span>
            {isOverdue(item, now) ? <Badge variant="destructive">Просрочено</Badge> : null}
            {item.reschedule_count > 0 ? <Badge variant="outline">переносов: {item.reschedule_count}</Badge> : null}
            {item.google_event_id ? <Badge variant="secondary">Google</Badge> : null}
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setMoveTarget(item);
              setMoveWhen(toLocalInput(item.starts_at ?? item.due_at));
            }}
          >
            <CalendarClock className="size-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              setDraft({
                id: item.id,
                kind: item.kind,
                title: item.title,
                notes: item.notes ?? "",
                direction_id: item.direction_id,
                starts_at: toLocalInput(item.starts_at),
                ends_at: toLocalInput(item.ends_at),
                due_at: toLocalInput(item.due_at),
                importance: item.importance,
                location: item.location ?? "",
              })
            }
          >
            Изм.
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (confirm("Удалить запись?")) void delFn({ data: { id: item.id } }).then(invalidate);
            }}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
    );
  }

  function List({ list, empty }: { list: CalItem[]; empty: string }) {
    if (!list.length) return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>;
    return (
      <div className="space-y-2">
        {list.map((i) => (
          <ItemRow key={i.id} item={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Планер и ассистент"
        description="Задачи и встречи по направлениям. Ассистент напоминает в Telegram и синхронизирует Google Календарь."
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() =>
                syncFn({}).then((r) => {
                  toast[r.configured ? "success" : "error"](
                    r.configured ? `Синхронизировано: ${r.applied}` : "Google Календарь не подключён",
                  );
                  invalidate();
                })
              }
            >
              <RefreshCw className="mr-2 size-4" /> Синхронизировать
            </Button>
            <Button onClick={() => setDraft({ ...emptyDraft })}>Новая запись</Button>
          </div>
        }
      />

      {data && !data.googleConnected ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          Google Календарь пока не подключён — планер работает локально. После подключения записи начнут выгружаться автоматически.
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={dirFilter === "all" ? "default" : "outline"} onClick={() => setDirFilter("all")}>
          Все направления
        </Button>
        {directions.map((d) => (
          <Button
            key={d.id}
            size="sm"
            variant={dirFilter === d.id ? "default" : "outline"}
            onClick={() => setDirFilter(d.id)}
          >
            <span className="mr-2 size-2 rounded-full" style={{ background: d.color }} />
            {d.title}
          </Button>
        ))}
      </div>

      <Tabs defaultValue="today">
        <TabsList>
          <TabsTrigger value="today">Сегодня ({today.length})</TabsTrigger>
          <TabsTrigger value="overdue">Просрочено ({overdue.length})</TabsTrigger>
          <TabsTrigger value="upcoming">Дальше ({upcoming.length})</TabsTrigger>
          <TabsTrigger value="priority">Приоритеты</TabsTrigger>
          <TabsTrigger value="inbox">Входящие ({data?.inbox.length ?? 0})</TabsTrigger>
          <TabsTrigger value="settings">Настройки</TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="mt-4">
          {isLoading ? <p className="text-sm text-muted-foreground">Загрузка…</p> : <List list={today} empty="На сегодня записей нет." />}
        </TabsContent>
        <TabsContent value="overdue" className="mt-4">
          <List list={overdue} empty="Просроченного нет 👌" />
        </TabsContent>
        <TabsContent value="upcoming" className="mt-4">
          <List list={upcoming} empty="Ближайших записей нет." />
        </TabsContent>
        <TabsContent value="priority" className="mt-4">
          <p className="mb-3 text-sm text-muted-foreground">Порядок по срочности, важности и числу переносов.</p>
          <List list={byPriority} empty="Всё закрыто." />
        </TabsContent>

        <TabsContent value="inbox" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Требуют уточнения</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(data?.inbox ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Всё разобрано.</p>
              ) : (
                (data?.inbox ?? []).map((i) => (
                  <div key={i.id} className="rounded-lg border p-3 text-sm">
                    <div className="font-medium">{i.raw_text}</div>
                    <div className="mt-1 text-muted-foreground">{i.question ?? STATUS_LABEL.planned}</div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <PrefsCard prefs={data?.prefs} onSave={(p) => prefsFn({ data: p }).then(() => { toast.success("Настройки сохранены"); invalidate(); })} />
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(draft)} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Изменить запись" : "Новая запись"}</DialogTitle>
          </DialogHeader>
          {draft ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Тип</Label>
                  <Select value={draft.kind} onValueChange={(v) => setDraft({ ...draft, kind: v as CalKind })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="task">Задача</SelectItem>
                      <SelectItem value="meeting">Встреча</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Направление</Label>
                  <Select
                    value={draft.direction_id ?? "none"}
                    onValueChange={(v) => setDraft({ ...draft, direction_id: v === "none" ? null : v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Без направления</SelectItem>
                      {directions.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Название</Label>
                <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{draft.kind === "meeting" ? "Начало" : "Начало (необязательно)"}</Label>
                  <Input type="datetime-local" value={draft.starts_at} onChange={(e) => setDraft({ ...draft, starts_at: e.target.value })} />
                </div>
                <div>
                  <Label>{draft.kind === "meeting" ? "Окончание" : "Дедлайн"}</Label>
                  <Input
                    type="datetime-local"
                    value={draft.kind === "meeting" ? draft.ends_at : draft.due_at}
                    onChange={(e) =>
                      setDraft(draft.kind === "meeting" ? { ...draft, ends_at: e.target.value } : { ...draft, due_at: e.target.value })
                    }
                  />
                </div>
              </div>
              <div>
                <Label>Место</Label>
                <Input value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} />
              </div>
              <div>
                <Label>Заметки</Label>
                <Textarea rows={3} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={draft.importance === "hard"}
                  onCheckedChange={(c) => setDraft({ ...draft, importance: c ? "hard" : "normal" })}
                />
                Жёсткая — перенос только вручную
              </label>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>Отмена</Button>
            <Button
              disabled={!draft?.title.trim() || saveMut.isPending}
              onClick={() => draft && saveMut.mutate(draft)}
            >
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(moveTarget)} onOpenChange={(o) => !o && setMoveTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Перенести «{moveTarget?.title}»</DialogTitle>
          </DialogHeader>
          <Input type="datetime-local" value={moveWhen} onChange={(e) => setMoveWhen(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveTarget(null)}>Отмена</Button>
            <Button
              disabled={!moveWhen}
              onClick={() => {
                const iso = fromLocalInput(moveWhen);
                if (!moveTarget || !iso) return;
                void moveFn({ data: { id: moveTarget.id, starts_at: iso } }).then(() => {
                  toast.success("Перенесено");
                  setMoveTarget(null);
                  invalidate();
                });
              }}
            >
              Перенести
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PrefsCard({
  prefs,
  onSave,
}: {
  prefs?: { morning_time: string; evening_time: string; followup_minutes: number; reminder_minutes: number[]; style_profile: string | null; tz: string };
  onSave: (p: Record<string, unknown>) => void;
}) {
  const [morning, setMorning] = useState(prefs?.morning_time ?? "08:00");
  const [evening, setEvening] = useState(prefs?.evening_time ?? "20:00");
  const [followup, setFollowup] = useState(String(prefs?.followup_minutes ?? 30));
  const [reminders, setReminders] = useState((prefs?.reminder_minutes ?? [60, 15]).join(", "));
  const [style, setStyle] = useState(prefs?.style_profile ?? "");

  useEffect(() => {
    if (!prefs) return;
    setMorning(prefs.morning_time);
    setEvening(prefs.evening_time);
    setFollowup(String(prefs.followup_minutes));
    setReminders(prefs.reminder_minutes.join(", "));
    setStyle(prefs.style_profile ?? "");
  }, [prefs]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Ассистент</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">Часовой пояс: {prefs?.tz ?? "—"} (берётся с вашего устройства).</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Утренний дайджест</Label>
            <Input type="time" value={morning} onChange={(e) => setMorning(e.target.value)} />
          </div>
          <div>
            <Label>Вечерний отчёт</Label>
            <Input type="time" value={evening} onChange={(e) => setEvening(e.target.value)} />
          </div>
          <div>
            <Label>Напоминания, мин до начала</Label>
            <Input value={reminders} onChange={(e) => setReminders(e.target.value)} placeholder="60, 15" />
          </div>
          <div>
            <Label>Контроль после задачи, мин</Label>
            <Input value={followup} onChange={(e) => setFollowup(e.target.value)} />
          </div>
        </div>
        <div>
          <Label>Мой стиль общения</Label>
          <Textarea rows={3} value={style} onChange={(e) => setStyle(e.target.value)} placeholder="Коротко, по делу, на «ты»" />
        </div>
        <Button
          onClick={() =>
            onSave({
              morning_time: morning,
              evening_time: evening,
              followup_minutes: Number(followup) || 30,
              reminder_minutes: reminders
                .split(",")
                .map((s) => Number(s.trim()))
                .filter((n) => Number.isFinite(n) && n >= 0),
              style_profile: style || null,
            })
          }
        >
          Сохранить настройки
        </Button>
      </CardContent>
    </Card>
  );
}
