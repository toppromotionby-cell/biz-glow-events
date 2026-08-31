// Ember Copilot: журнал планов, построчный аудит и настройки доступа помощника.
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Flame, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCopilot } from "@/components/copilot/copilot-context";
import { copilotJournal, copilotSaveSettings } from "@/lib/copilot/copilot.functions";
import { MODULE_TITLES, type CopilotModule, type CopilotSettings } from "@/lib/copilot/types";

export const Route = createFileRoute("/admin/copilot")({
  component: Page,
  head: () => ({
    meta: [
      { title: "ИИ-управленец Ember · Админка Event-Hub" },
      { name: "description", content: "Журнал планов помощника, аудит изменений и настройки доступа." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

const STATUS: Record<string, { label: string; className: string }> = {
  pending: { label: "Ждёт решения", className: "bg-amber-500/15 text-amber-600" },
  applied: { label: "Применён", className: "bg-emerald-500/15 text-emerald-600" },
  rejected: { label: "Отклонён", className: "bg-muted text-muted-foreground" },
  rolled_back: { label: "Откачен", className: "bg-sky-500/15 text-sky-600" },
  failed: { label: "Ошибка", className: "bg-destructive/15 text-destructive" },
};

function when(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" });
}

function Page() {
  const qc = useQueryClient();
  const { setOpen } = useCopilot();

  const journal = useQuery({ queryKey: ["copilot", "journal"], queryFn: () => copilotJournal({ data: {} }) });

  const save = useMutation({
    mutationFn: (patch: Partial<CopilotSettings>) => copilotSaveSettings({ data: patch }),
    onSuccess: () => {
      toast.success("Настройки сохранены");
      void qc.invalidateQueries({ queryKey: ["copilot"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const s = journal.data?.settings;
  const modules = Object.keys(MODULE_TITLES) as CopilotModule[];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="ИИ-управленец Ember"
        description="Помощник работает по всей админке: предлагает план, показывает «было → стало» и меняет данные только после вашего утверждения."
        actions={
          <Button onClick={() => setOpen(true)} className="gap-2">
            <Flame className="h-4 w-4" /> Открыть помощника
          </Button>
        }
      />

      {journal.isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Загружаю журнал…
        </div>
      )}

      <Tabs defaultValue="runs">
        <TabsList>
          <TabsTrigger value="runs">Планы</TabsTrigger>
          <TabsTrigger value="audit">Аудит изменений</TabsTrigger>
          <TabsTrigger value="settings">Настройки</TabsTrigger>
        </TabsList>

        <TabsContent value="runs" className="mt-4 space-y-3">
          {!journal.data?.runs.length && !journal.isLoading && (
            <p className="text-sm text-muted-foreground">Планов пока нет — задайте помощнику первую задачу.</p>
          )}
          {journal.data?.runs.map((r) => {
            const st = STATUS[r.status] ?? STATUS.pending!;
            return (
              <Card key={r.id}>
                <CardHeader className="pb-2 flex-row items-start gap-3 space-y-0">
                  <CardTitle className="text-base font-semibold leading-snug">{r.title}</CardTitle>
                  <Badge className={`ml-auto shrink-0 ${st.className}`} variant="secondary">
                    {st.label}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-1 text-sm text-muted-foreground">
                  {r.summary && <p className="text-foreground/80">{r.summary}</p>}
                  <p>
                    {when(r.created_at)} · изменений: {r.preview.length}
                    {r.result ? ` · ${r.result}` : ""}
                  </p>
                  {r.error && <p className="text-destructive">{r.error}</p>}
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <div className="overflow-x-auto rounded-xl border border-border/60">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Когда</th>
                  <th className="px-3 py-2">Действие</th>
                  <th className="px-3 py-2">Таблица</th>
                  <th className="px-3 py-2">Запись</th>
                  <th className="px-3 py-2">Инструмент</th>
                </tr>
              </thead>
              <tbody>
                {journal.data?.audit.map((a) => (
                  <tr key={a.id} className="border-t border-border/50">
                    <td className="px-3 py-2 whitespace-nowrap">{when(a.created_at)}</td>
                    <td className="px-3 py-2">{a.action}</td>
                    <td className="px-3 py-2">{a.target_table ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-xs">{a.target_id?.slice(0, 8) ?? "—"}</td>
                    <td className="px-3 py-2">{a.tool}</td>
                  </tr>
                ))}
                {!journal.data?.audit.length && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                      Изменений ещё не было.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="mt-4 space-y-4">
          {s && (
            <>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Разрешения</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Row
                    label="Интернет-поиск"
                    hint="Помощник может искать ответы в открытых источниках и указывать ссылки."
                    checked={s.allow_web_search}
                    onChange={(v) => save.mutate({ allow_web_search: v })}
                  />
                  <Row
                    label="Разрешить удаление"
                    hint="Опасно: помощник сможет предлагать удаление записей. По умолчанию выключено."
                    checked={s.allow_destructive}
                    onChange={(v) => save.mutate({ allow_destructive: v })}
                  />
                  <Row
                    label="Озвучивать ответы"
                    hint="Голосовой ответ в браузере после каждого сообщения."
                    checked={s.speak_replies}
                    onChange={(v) => save.mutate({ speak_replies: v })}
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="max-rows">Лимит записей на один план</Label>
                      <Input
                        id="max-rows"
                        type="number"
                        min={1}
                        max={500}
                        defaultValue={s.max_rows_per_run}
                        onBlur={(e) => {
                          const v = Number(e.target.value);
                          if (v && v !== s.max_rows_per_run) save.mutate({ max_rows_per_run: v });
                        }}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="max-emails">Лимит писем на один план</Label>
                      <Input
                        id="max-emails"
                        type="number"
                        min={1}
                        max={2000}
                        defaultValue={s.max_emails_per_run}
                        onBlur={(e) => {
                          const v = Number(e.target.value);
                          if (v && v !== s.max_emails_per_run) save.mutate({ max_emails_per_run: v });
                        }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Разделы, доступные помощнику</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {modules.map((m) => {
                    const on = s.enabled_modules.includes(m);
                    return (
                      <label key={m} className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2">
                        <Switch
                          checked={on}
                          onCheckedChange={(v) =>
                            save.mutate({
                              enabled_modules: v
                                ? [...s.enabled_modules, m]
                                : s.enabled_modules.filter((x) => x !== m),
                            })
                          }
                        />
                        <span className="text-sm">{MODULE_TITLES[m]}</span>
                      </label>
                    );
                  })}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Row({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-3">
      <Switch checked={checked} onCheckedChange={onChange} className="mt-1" />
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}
