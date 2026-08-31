// Админка диджей-бота: привязка чатов, уведомления, вебхук, журнал доставки.
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Copy, Loader2, Send, RefreshCw, Link2Off } from "lucide-react";
import { toast } from "sonner";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  djTgIssueCode,
  djTgRegisterWebhook,
  djTgSaveSettings,
  djTgStatus,
  djTgTest,
  djTgUnlink,
} from "@/lib/dj/telegram/dj-telegram.functions";

export const Route = createFileRoute("/admin/dj/telegram")({
  component: Page,
});

const TOGGLES: { key: string; label: string; hint: string }[] = [
  { key: "notify_applications", label: "Заявки в диджей-пул", hint: "Карточка с кнопками «Одобрить / Отклонить»" },
  { key: "notify_tracks", label: "Треки на модерации", hint: "Новая загрузка приходит с обложкой и кнопками" },
  { key: "notify_rejects", label: "Сводка отклонённых загрузок", hint: "Раз в час, только если что-то отсеялось" },
  { key: "notify_digest", label: "Дайджесты", hint: "Ежедневный админам и недельный в чат диджеев" },
  { key: "announce_publications", label: "Анонсы публикаций", hint: "Новые треки уходят в чат диджеев" },
];

function Page() {
  const qc = useQueryClient();
  const status = useQuery({ queryKey: ["dj", "tg", "status"], queryFn: () => djTgStatus() });
  const invalidate = () => void qc.invalidateQueries({ queryKey: ["dj", "tg"] });

  const code = useMutation({
    mutationFn: () => djTgIssueCode(),
    onSuccess: (r) => {
      void navigator.clipboard?.writeText(r.code).catch(() => {});
      toast.success(`Код ${r.code} скопирован — отправьте его боту в личку`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const save = useMutation({
    mutationFn: (patch: Record<string, unknown>) => djTgSaveSettings({ data: patch }),
    onSuccess: () => {
      toast.success("Сохранено");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const hook = useMutation({
    mutationFn: () => djTgRegisterWebhook(),
    onSuccess: (r) => {
      if (r.ok) toast.success("Вебхук зарегистрирован");
      else toast.error(r.error ?? "Не удалось зарегистрировать");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const test = useMutation({
    mutationFn: () => djTgTest(),
    onSuccess: (r) => (r.ok ? toast.success("Отправлено") : toast.error(r.error ?? "Ошибка")),
    onError: (e: Error) => toast.error(e.message),
  });

  const unlink = useMutation({
    mutationFn: (chatId: number) => djTgUnlink({ data: { chatId } }),
    onSuccess: () => {
      toast.success("Отвязано");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const d = status.data;
  const s = d?.settings;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Диджей-бот"
        subtitle="Модерация, заявки и статистика раздела прямо в Telegram — с кнопками, голосом и дайджестами."
      />

      {status.isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <section className="glass rounded-2xl p-5">
            <div className="flex flex-wrap items-center gap-3">
              <Bot className="h-5 w-5 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {d?.configured ? d?.bot?.username ? `@${d.bot.username}` : "Бот подключён" : "Бот не подключён"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {d?.configured
                    ? d?.webhook?.url === d?.expectedWebhook
                      ? "Вебхук активен"
                      : "Вебхук не зарегистрирован — нажмите «Обновить вебхук»"
                    : "Добавьте подключение Telegram для диджей-бота в разделе коннекторов"}
                </p>
              </div>
              <Badge variant={d?.configured ? "default" : "secondary"}>{d?.configured ? "online" : "offline"}</Badge>
              <Button size="sm" variant="outline" onClick={() => hook.mutate()} disabled={!d?.configured || hook.isPending}>
                <RefreshCw className="mr-2 h-4 w-4" /> Обновить вебхук
              </Button>
              <Button size="sm" variant="outline" onClick={() => test.mutate()} disabled={!d?.configured || test.isPending}>
                <Send className="mr-2 h-4 w-4" /> Тест
              </Button>
            </div>
            {d?.webhook?.last_error_message ? (
              <p className="mt-3 rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
                Последняя ошибка Telegram: {d.webhook.last_error_message}
              </p>
            ) : null}
          </section>

          <section className="glass rounded-2xl p-5">
            <h2 className="mb-1 font-medium">Привязка аккаунта</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Получите одноразовый код и отправьте его боту в личные сообщения — бот узнает вашу роль.
            </p>
            <Button size="sm" onClick={() => code.mutate()} disabled={code.isPending}>
              <Copy className="mr-2 h-4 w-4" /> Получить код
            </Button>
            <ul className="mt-4 space-y-2">
              {(d?.links ?? []).map((l) => (
                <li key={l.chat_id} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm">
                      {l.username ? `@${l.username}` : l.first_name || `chat ${l.chat_id}`}
                    </p>
                    <p className="text-xs text-muted-foreground">ID: {l.chat_id}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => unlink.mutate(l.chat_id)}>
                    <Link2Off className="h-4 w-4" />
                  </Button>
                </li>
              ))}
              {(d?.links ?? []).length === 0 ? (
                <li className="py-4 text-center text-sm text-muted-foreground">Пока никто не привязан.</li>
              ) : null}
            </ul>
          </section>

          <section className="glass rounded-2xl p-5">
            <h2 className="mb-4 font-medium">Уведомления</h2>
            <div className="space-y-4">
              {TOGGLES.map((t) => (
                <div key={t.key} className="flex items-start justify-between gap-4">
                  <div>
                    <Label htmlFor={t.key} className="text-sm">{t.label}</Label>
                    <p className="text-xs text-muted-foreground">{t.hint}</p>
                  </div>
                  <Switch
                    id={t.key}
                    checked={Boolean((s as Record<string, unknown> | undefined)?.[t.key])}
                    onCheckedChange={(v) => save.mutate({ [t.key]: v })}
                  />
                </div>
              ))}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="hour" className="text-sm">Час дайджеста (Минск)</Label>
                  <Input
                    id="hour"
                    type="number"
                    min={0}
                    max={23}
                    defaultValue={s?.daily_digest_hour ?? 9}
                    onBlur={(e) => save.mutate({ daily_digest_hour: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label htmlFor="group" className="text-sm">Чат диджеев</Label>
                  <Input
                    id="group"
                    value={s?.group_chat_id ?? ""}
                    readOnly
                    placeholder="отправьте /setgroup в групповом чате"
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="glass rounded-2xl p-5">
            <h2 className="mb-4 font-medium">Журнал доставки</h2>
            <ul className="space-y-2 text-sm">
              {(d?.outbox ?? []).map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-2">
                  <span className="truncate">{o.kind}</span>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    {o.error ? <span className="text-destructive">{o.error.slice(0, 60)}</span> : null}
                    <Badge variant={o.status === "sent" ? "secondary" : o.status === "failed" ? "destructive" : "outline"}>
                      {o.status}
                    </Badge>
                  </span>
                </li>
              ))}
              {(d?.outbox ?? []).length === 0 ? (
                <li className="py-4 text-center text-muted-foreground">Событий пока нет.</li>
              ) : null}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
