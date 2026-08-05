// Настройка отправителя писем по типам: имя, адрес «От» и адрес для ответа.
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  listEmailSenders,
  updateEmailSender,
  sendSenderTest,
  type EmailSender,
} from "@/lib/email-senders.functions";

const KIND_LABEL: Record<string, string> = {
  default: "По умолчанию",
  orders: "Заказы",
  quotes: "Коммерческие предложения",
  leads: "Заявки и лиды",
  auth: "Авторизация",
  campaigns: "Рассылки",
  admin: "Служебные (админам)",
};

const KIND_HINT: Record<string, string> = {
  default: "Базовые значения — используются везде, где не задано своё.",
  orders: "Подтверждение, оплата, смена статуса, отмена заказа.",
  quotes: "Отправка КП и КП Промо клиенту.",
  leads: "Письма по заявкам и уточнениям.",
  auth: "Регистрация, восстановление пароля, вход по ссылке.",
  campaigns: "Приглашения и кампании.",
  admin: "Внутренние уведомления команде.",
};

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
const external = (v: string) => {
  const d = v.trim().toLowerCase().split("@")[1] ?? "";
  return !!d && d !== "event-hub.by" && !d.endsWith(".event-hub.by");
};

function SenderCard({ row }: { row: EmailSender }) {
  const qc = useQueryClient();
  const save = useServerFn(updateEmailSender);
  const test = useServerFn(sendSenderTest);

  const [name, setName] = useState(row.from_name);
  const [email, setEmail] = useState(row.from_email);
  const [reply, setReply] = useState(row.reply_to);
  const [inherit, setInherit] = useState(row.inherit_default);
  const [testTo, setTestTo] = useState("");

  useEffect(() => {
    setName(row.from_name);
    setEmail(row.from_email);
    setReply(row.reply_to);
    setInherit(row.inherit_default);
  }, [row]);

  const isDefault = row.kind === "default";
  const dirty =
    name !== row.from_name ||
    email !== row.from_email ||
    reply !== row.reply_to ||
    inherit !== row.inherit_default;

  const saveMutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          kind: row.kind as never,
          from_name: name,
          from_email: email,
          reply_to: reply,
          inherit_default: inherit,
        },
      }),
    onSuccess: () => {
      toast.success("Отправитель сохранён");
      qc.invalidateQueries({ queryKey: ["email-senders"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Не удалось сохранить"),
  });

  const testMutation = useMutation({
    mutationFn: () => test({ data: { kind: row.kind as never, recipient: testTo.trim() } }),
    onSuccess: () => toast.success("Тестовое письмо отправлено — проверьте ящик"),
    onError: (e: any) => toast.error(e?.message ?? "Не удалось отправить тест"),
  });

  const preview = (() => {
    const n = name.trim() || "event-hub.by";
    const e = isEmail(email) ? email.trim() : "noreply@event-hub.by";
    const shown = external(e) ? "noreply@event-hub.by" : e;
    return `${n} <${shown}>`;
  })();

  const replyPreview = (() => {
    if (isEmail(reply)) return reply.trim();
    if (isEmail(email) && external(email)) return email.trim();
    return isEmail(email) ? email.trim() : "noreply@event-hub.by";
  })();

  const locked = !isDefault && inherit;

  return (
    <section className="rounded-lg border border-border/60 bg-card/40 p-4 space-y-3">
      <header className="flex items-center gap-2 flex-wrap">
        <h3 className="font-semibold">{KIND_LABEL[row.kind] ?? row.kind}</h3>
        {locked && <Badge variant="outline">Как по умолчанию</Badge>}
        {!isDefault && (
          <label className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
            Общие настройки
            <Switch checked={inherit} onCheckedChange={setInherit} />
          </label>
        )}
      </header>
      <p className="text-xs text-muted-foreground">{KIND_HINT[row.kind]}</p>

      {!locked && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor={`n-${row.kind}`}>Имя отправителя</Label>
              <Input
                id={`n-${row.kind}`}
                value={name}
                maxLength={120}
                onChange={(e) => setName(e.target.value)}
                placeholder="Event Hub | Отдел продаж"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`e-${row.kind}`}>E-mail отправителя</Label>
              <Input
                id={`e-${row.kind}`}
                value={email}
                maxLength={255}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="sales@event-hub.by"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`r-${row.kind}`}>Адрес для ответа</Label>
              <Input
                id={`r-${row.kind}`}
                value={reply}
                maxLength={255}
                onChange={(e) => setReply(e.target.value)}
                placeholder="необязательно"
              />
            </div>
          </div>

          {email.trim() !== "" && !isEmail(email) && (
            <p className="text-xs text-destructive">Некорректный e-mail отправителя.</p>
          )}
          {isEmail(email) && external(email) && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Адрес вне домена event-hub.by: письмо уйдёт с технического адреса нашего домена
              (иначе оно попадёт в спам), а ответы клиента придут на {email.trim()}.
            </p>
          )}

          <div className="rounded-md border border-border/60 bg-muted/40 p-3 text-sm">
            <div>
              Клиент увидит: <b>{preview}</b>
            </div>
            <div className="text-muted-foreground">Ответы придут на: {replyPreview}</div>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <Button
              size="sm"
              onClick={() => saveMutation.mutate()}
              disabled={!dirty || saveMutation.isPending || (email.trim() !== "" && !isEmail(email))}
            >
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Сохранить
            </Button>
            <div className="flex items-end gap-2 ml-auto">
              <Input
                className="w-56"
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
                placeholder="Тест на e-mail"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => testMutation.mutate()}
                disabled={!isEmail(testTo) || testMutation.isPending}
              >
                <Send className="h-4 w-4 mr-1.5" />
                Тест
              </Button>
            </div>
          </div>
        </>
      )}

      {locked && !isDefault && (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setInherit(false)}>
            Задать свой адрес
          </Button>
          {dirty && (
            <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              Сохранить
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

export function EmailSendersPanel() {
  const load = useServerFn(listEmailSenders);
  const query = useQuery({ queryKey: ["email-senders"], queryFn: () => load({}) });

  if (query.isLoading) return <div className="p-4 text-sm text-muted-foreground">Загрузка…</div>;
  if (query.error)
    return <div className="p-4 text-sm text-destructive">{(query.error as Error).message}</div>;

  return (
    <div className="space-y-3">
      {(query.data ?? []).map((row) => (
        <SenderCard key={row.kind} row={row} />
      ))}
    </div>
  );
}
