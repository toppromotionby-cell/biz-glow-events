// Админка бота-помощника: подключение, роль, привязки, база знаний, гигиена данных.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Brain, Check, Link2Off, Loader2, RefreshCw, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  assistantDecideFinding,
  assistantFactStatus,
  assistantHygieneState,
  assistantIssueCode,
  assistantKnowledge,
  assistantRegisterWebhook,
  assistantRunHygiene,
  assistantSaveFact,
  assistantSaveSettings,
  assistantStatus,
  assistantUnlink,
} from "@/lib/assistant.functions";

export const Route = createFileRoute("/admin/assistant")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Помощник · Админка Event-Hub" },
      { name: "description", content: "Telegram-помощник: подключение, база знаний и гигиена данных портала." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function Page() {
  const qc = useQueryClient();
  const invalidate = () => void qc.invalidateQueries({ queryKey: ["assistant"] });

  const status = useQuery({ queryKey: ["assistant", "status"], queryFn: () => assistantStatus() });
  const knowledge = useQuery({ queryKey: ["assistant", "kb"], queryFn: () => assistantKnowledge() });
  const hygiene = useQuery({ queryKey: ["assistant", "hygiene"], queryFn: () => assistantHygieneState() });

  const code = useMutation({
    mutationFn: () => assistantIssueCode(),
    onSuccess: (r) => {
      void navigator.clipboard?.writeText(r.code).catch(() => {});
      toast.success(`Код ${r.code} скопирован — отправьте его боту в личку`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const hook = useMutation({
    mutationFn: () => assistantRegisterWebhook({ data: { baseUrl: window.location.origin } }),
    onSuccess: () => {
      toast.success("Вебхук зарегистрирован");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const save = useMutation({
    mutationFn: (patch: Record<string, unknown>) => assistantSaveSettings({ data: patch }),
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });

  const unlink = useMutation({
    mutationFn: (chatId: number) => assistantUnlink({ data: { chatId } }),
    onSuccess: () => {
      toast.success("Чат отвязан");
      invalidate();
    },
  });

  const run = useMutation({
    mutationFn: () => assistantRunHygiene(),
    onSuccess: (r) => {
      toast.success(`Исправлено ${r.autoFixed}, на решение — ${r.needsReview}`);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const decide = useMutation({
    mutationFn: (v: { id: string; status: "fixed" | "dismissed" }) => assistantDecideFinding({ data: v }),
    onSuccess: invalidate,
  });

  const factStatus = useMutation({
    mutationFn: (v: { id: string; status: "active" | "stale" | "rejected" }) => assistantFactStatus({ data: v }),
    onSuccess: invalidate,
  });

  const [subject, setSubject] = useState("");
  const [fact, setFact] = useState("");
  const addFact = useMutation({
    mutationFn: () => assistantSaveFact({ data: { subject, fact } }),
    onSuccess: () => {
      setSubject("");
      setFact("");
      toast.success("Факт записан");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const s = status.data;
  const settings = s?.settings;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Помощник"
        description="Telegram-бот админ-панели: документы, база знаний, интернет-поиск и гигиена данных."
      />

      <Tabs defaultValue="bot" className="space-y-4">
        <TabsList>
          <TabsTrigger value="bot">Бот</TabsTrigger>
          <TabsTrigger value="kb">База знаний</TabsTrigger>
          <TabsTrigger value="hygiene">Гигиена данных</TabsTrigger>
        </TabsList>

        {/* ------------------------------- Бот ------------------------------- */}
        <TabsContent value="bot" className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" />
              <span className="font-medium">Подключение</span>
              {status.isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : s?.configured ? (
                <Badge variant="secondary">
                  {s.bot?.username ? `@${s.bot.username}` : "подключён"}
                </Badge>
              ) : (
                <Badge variant="destructive">не подключён</Badge>
              )}
            </div>

            {!s?.configured && (
              <p className="text-sm text-muted-foreground">
                Ключ подключения Telegram для помощника не найден. Подключите отдельного бота — понадобится токен от
                BotFather, он сохраняется как секрет <code>ASSISTANT_TELEGRAM_API_KEY</code>.
              </p>
            )}

            {s?.webhook?.url ? (
              <p className="text-sm text-muted-foreground break-all">
                Вебхук: {s.webhook.url}
                {s.webhook.last_error_message ? ` · ошибка: ${s.webhook.last_error_message}` : ""}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Вебхук ещё не зарегистрирован.</p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => hook.mutate()} disabled={!s?.configured || hook.isPending}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Зарегистрировать вебхук
              </Button>
              <Button size="sm" variant="outline" onClick={() => code.mutate()} disabled={code.isPending}>
                <Sparkles className="mr-2 h-4 w-4" />
                Код привязки Telegram
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4 space-y-4">
            <span className="font-medium">Поведение</span>
            <Toggle
              label="Интернет-поиск"
              hint="Помощник ищет ответы в открытых источниках и всегда даёт ссылки"
              checked={settings?.allow_web_search ?? true}
              onChange={(v) => save.mutate({ allow_web_search: v })}
            />
            <Toggle
              label="Строгий режим (только через план)"
              hint="Любое изменение данных требует утверждения плана в чате"
              checked={settings?.plan_only ?? false}
              onChange={(v) => save.mutate({ plan_only: v })}
            />
            <Toggle
              label="Автопроверка данных"
              hint="Ежедневный прогон правил гигиены"
              checked={settings?.hygiene_enabled ?? true}
              onChange={(v) => save.mutate({ hygiene_enabled: v })}
            />
            <Toggle
              label="Уведомления о гигиене в Telegram"
              hint="Отчёт и карточки на ручную модерацию"
              checked={settings?.hygiene_notify ?? true}
              onChange={(v) => save.mutate({ hygiene_notify: v })}
            />
            <div className="flex items-center gap-3">
              <Label className="w-56 text-sm">Суточный лимит запросов</Label>
              <Input
                type="number"
                className="w-28"
                defaultValue={settings?.daily_limit ?? 200}
                onBlur={(e) => save.mutate({ daily_limit: Number(e.target.value) || 200 })}
              />
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4 space-y-2">
            <span className="font-medium">Привязанные чаты</span>
            {!s?.links?.length && <p className="text-sm text-muted-foreground">Пока никто не привязан.</p>}
            {s?.links?.map((l) => (
              <div key={l.chat_id} className="flex items-center justify-between rounded border border-border/60 px-3 py-2">
                <span className="text-sm">
                  {l.tg_first_name ?? "—"} {l.tg_username ? `@${l.tg_username}` : ""} · chat {l.chat_id}
                </span>
                <Button size="sm" variant="ghost" onClick={() => unlink.mutate(l.chat_id)}>
                  <Link2Off className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* --------------------------- База знаний --------------------------- */}
        <TabsContent value="kb" className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-primary" />
              <span className="font-medium">Добавить факт</span>
            </div>
            <Input placeholder="Тема, например «Реквизиты BeLight»" value={subject} onChange={(e) => setSubject(e.target.value)} />
            <Textarea placeholder="Сам факт: правило, формула, договорённость" value={fact} onChange={(e) => setFact(e.target.value)} />
            <Button size="sm" onClick={() => addFact.mutate()} disabled={addFact.isPending || !subject || !fact}>
              Записать
            </Button>
          </div>

          <div className="rounded-lg border border-border bg-card divide-y divide-border">
            {knowledge.data?.facts?.length ? (
              knowledge.data.facts.map((f) => (
                <div key={f.id} className="flex items-start justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{f.subject}</span>
                      <Badge variant={f.status === "active" ? "secondary" : "outline"}>{f.status}</Badge>
                      <span className="text-xs text-muted-foreground">{f.source_kind}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{f.fact}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {f.status !== "active" && (
                      <Button size="icon" variant="ghost" onClick={() => factStatus.mutate({ id: f.id, status: "active" })}>
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" onClick={() => factStatus.mutate({ id: f.id, status: "rejected" })}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p className="p-4 text-sm text-muted-foreground">База знаний пока пуста.</p>
            )}
          </div>
        </TabsContent>

        {/* ---------------------------- Гигиена ---------------------------- */}
        <TabsContent value="hygiene" className="space-y-4">
          <div className="flex items-center gap-3">
            <Button size="sm" onClick={() => run.mutate()} disabled={run.isPending}>
              {run.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Проверить данные сейчас
            </Button>
            {settings?.last_hygiene_at && (
              <span className="text-sm text-muted-foreground">
                Последняя проверка: {new Date(settings.last_hygiene_at).toLocaleString("ru-RU")}
              </span>
            )}
          </div>

          <div className="rounded-lg border border-border bg-card divide-y divide-border">
            {hygiene.data?.findings?.length ? (
              hygiene.data.findings.map((f) => (
                <div key={f.id} className="flex items-start justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant={f.severity === "critical" ? "destructive" : "outline"}>{f.area}</Badge>
                      <span className="font-medium text-sm">{f.title}</span>
                    </div>
                    {f.details && <p className="text-sm text-muted-foreground whitespace-pre-line">{f.details}</p>}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button size="icon" variant="ghost" onClick={() => decide.mutate({ id: f.id, status: "fixed" })}>
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => decide.mutate({ id: f.id, status: "dismissed" })}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p className="p-4 text-sm text-muted-foreground">Замечаний нет — данные в порядке.</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Toggle(props: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <Label className="text-sm">{props.label}</Label>
        <p className="text-xs text-muted-foreground">{props.hint}</p>
      </div>
      <Switch checked={props.checked} onCheckedChange={props.onChange} />
    </div>
  );
}
