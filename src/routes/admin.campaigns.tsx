// Страница «Email-рассылки» → приглашения новым клиентам.
// Простая форма: 1–10 email, опциональное имя и личное сообщение,
// фирменное письмо-шаблон, превью, тест, лог последних отправок.
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import {
  sendClientInvitations,
  previewInvite,
  listRecentInvites,
} from "@/lib/campaigns.functions";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, Mail, Send, Eye, Upload, Trash2, CheckSquare, XSquare, Filter, Search } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { fmtDateTime } from "@/lib/formatters";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX = 10;

export const Route = createFileRoute("/admin/campaigns")({
  head: () => ({
    meta: [
      { title: "Email-рассылки — Админ" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: InvitationsPage,
});

function parseEmails(raw: string): string[] {
  const set = new Set<string>();
  for (const piece of raw.split(/[\s,;\n]+/)) {
    const v = piece.trim().toLowerCase();
    if (EMAIL_RE.test(v)) set.add(v);
  }
  return Array.from(set);
}

interface PreviewItem { email: string; selected: boolean; }

function buildPreviewItems(raw: string): PreviewItem[] {
  const emails = parseEmails(raw);
  return emails.map((email) => ({ email, selected: true }));
}

const STATUS_LABEL: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  pending: { label: "В очереди", variant: "secondary" },
  sent: { label: "Отправлено", variant: "default" },
  failed: { label: "Ошибка", variant: "destructive" },
  dlq: { label: "Не доставлено", variant: "destructive" },
  suppressed: { label: "Отписан", variant: "outline" },
  bounced: { label: "Bounce", variant: "destructive" },
  complained: { label: "Жалоба", variant: "destructive" },
};

function InvitationsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const sendFn = useServerFn(sendClientInvitations);
  const previewFn = useServerFn(previewInvite);
  const logFn = useServerFn(listRecentInvites);

  const [emailsRaw, setEmailsRaw] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [personalMessage, setPersonalMessage] = useState("");
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewItems, setPreviewItems] = useState<PreviewItem[] | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewSource, setPreviewSource] = useState<{ type: "manual" | "csv"; fileName?: string } | null>(null);

  const emails = useMemo(() => parseEmails(emailsRaw), [emailsRaw]);
  const canSend = emails.length >= 1 && emails.length <= MAX;
  const tooMany = emails.length > MAX;

  const openPreview = (type: "manual" | "csv", fileName?: string, raw?: string) => {
    const sourceRaw = raw ?? emailsRaw;
    const items = buildPreviewItems(sourceRaw);
    setPreviewItems(items);
    setPreviewSource({ type, fileName });
    setPreviewOpen(true);
  };

  const applyPreview = () => {
    if (!previewItems) return;
    const selected = previewItems.filter((i) => i.selected).map((i) => i.email).slice(0, MAX);
    setEmailsRaw(selected.join(", "));
    setPreviewOpen(false);
  };

  const toggleAll = (selected: boolean) => {
    setPreviewItems((prev) => prev?.map((i) => ({ ...i, selected })) ?? null);
  };

  const removeUnselected = () => {
    setPreviewItems((prev) => prev?.filter((i) => i.selected) ?? null);
  };

  const { data: log = [], isLoading: logLoading } = useQuery({
    queryKey: ["admin", "invites", "log"],
    queryFn: () => logFn(),
  });

  const preview = useMutation({
    mutationFn: () => previewFn({
      data: {
        recipient_name: recipientName.trim() || undefined,
        personal_message: personalMessage.trim() || undefined,
      },
    }),
    onSuccess: (r) => setPreviewHtml(r.html),
    onError: (e: Error) => toast.error(e.message),
  });

  const send = useMutation({
    mutationFn: () => sendFn({
      data: {
        emails,
        recipient_name: emails.length === 1 ? recipientName.trim() || undefined : undefined,
        personal_message: personalMessage.trim() || undefined,
      },
    }),
    onSuccess: (r) => {
      toast.success(`Поставлено в очередь: ${r.queued} из ${r.total}` + (r.suppressed ? ` · отписаны: ${r.suppressed}` : "") + (r.failed ? ` · ошибки: ${r.failed}` : ""));
      setEmailsRaw("");
      setRecipientName("");
      setPersonalMessage("");
      qc.invalidateQueries({ queryKey: ["admin", "invites", "log"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendTest = useMutation({
    mutationFn: () => {
      const me = user?.email;
      if (!me) throw new Error("У вас не указан email");
      return sendFn({
        data: {
          emails: [me],
          recipient_name: recipientName.trim() || undefined,
          personal_message: personalMessage.trim() || undefined,
        },
      });
    },
    onSuccess: () => {
      toast.success(`Тестовое письмо отправлено на ${user?.email}`);
      qc.invalidateQueries({ queryKey: ["admin", "invites", "log"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Приглашения клиентам"
        subtitle="Отправьте фирменное письмо-приглашение на сайт сразу на несколько адресов (до 10 за раз)."
        icon={
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl btn-primary-gradient">
            <Mail className="h-5 w-5 text-primary-foreground" />
          </span>
        }
      />

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Форма */}
        <div className="glass rounded-xl p-5 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Label htmlFor="emails">Email-адреса <span className="text-xs text-muted-foreground">(через запятую, пробел или с новой строки, до {MAX})</span></Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openPreview("manual")}
                  disabled={emailsRaw.trim().length === 0}
                  title="Проверить и отредактировать распознанные адреса"
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Проверить адреса
                </Button>
                <CsvUploadButton
                  onEmails={(found, fileName) => {
                    if (found.length === 0) {
                      toast.error("В файле не найдено email-адресов");
                      return;
                    }
                    const existing = parseEmails(emailsRaw);
                    const mergedRaw = Array.from(new Set([...existing, ...found])).join(", ");
                    setEmailsRaw(mergedRaw);
                    openPreview("csv", fileName, mergedRaw);
                  }}
                />
              </div>
            </div>
            <Textarea
              id="emails"
              value={emailsRaw}
              onChange={(e) => setEmailsRaw(e.target.value)}
              rows={4}
              placeholder="anna@example.com, ivan@example.com"
              className={tooMany ? "border-destructive" : ""}
            />
            <div className={`text-xs ${tooMany ? "text-destructive" : "text-muted-foreground"}`}>
              Распознано адресов: <b>{emails.length}</b> · максимум {MAX}
              {tooMany && " — лишние не будут отправлены, уменьшите список"}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">
              Имя получателя <span className="text-xs text-muted-foreground">(необязательно — используется, если адрес один)</span>
            </Label>
            <Input
              id="name"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="Анна"
              maxLength={120}
              disabled={emails.length > 1}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="msg">
              Личное сообщение <span className="text-xs text-muted-foreground">(необязательно, до 500 символов)</span>
            </Label>
            <Textarea
              id="msg"
              value={personalMessage}
              onChange={(e) => setPersonalMessage(e.target.value.slice(0, 500))}
              rows={4}
              placeholder="Подобрали для вас несколько вариантов площадок к лету — будем рады обсудить детали."
            />
            <div className="text-xs text-muted-foreground text-right">{personalMessage.length}/500</div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button variant="outline" onClick={() => preview.mutate()} disabled={preview.isPending}>
              {preview.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
              Превью письма
            </Button>
            <Button
              variant="outline"
              onClick={() => sendTest.mutate()}
              disabled={sendTest.isPending || !user?.email}
              title={user?.email ? `Отправить тест на ${user.email}` : "Сначала войдите"}
            >
              {sendTest.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Отправить тест себе
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button className="btn-primary-gradient" disabled={!canSend || send.isPending}>
                  {send.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                  Отправить приглашения
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Отправить приглашения?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Письмо уйдёт на {emails.length} адрес(ов). Отменить после запуска нельзя.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Отмена</AlertDialogCancel>
                  <AlertDialogAction onClick={() => send.mutate()}>Отправить</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Превью */}
        <div className="glass rounded-xl p-5 space-y-3">
          <h3 className="font-semibold flex items-center gap-2"><Eye className="h-4 w-4" />Превью письма</h3>
          <div className="rounded-lg border border-border/50 bg-white overflow-hidden">
            {previewHtml ? (
              <iframe title="Email preview" srcDoc={previewHtml} sandbox="" className="w-full h-[560px]" />
            ) : (
              <div className="p-10 text-center text-sm text-muted-foreground">
                Нажмите «Превью письма», чтобы увидеть, как письмо будет выглядеть у получателя.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Диалог предпросмотра и редактирования распарсенных адресов */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Проверка адресов</DialogTitle>
            <DialogDescription>
              {previewSource?.type === "csv"
                ? `Адреса из файла «${previewSource.fileName}». Снимите галочки с лишних строк и нажмите «Применить».`
                : "Снимите галочки с лишних строк и нажмите «Применить»."}
            </DialogDescription>
          </DialogHeader>

          {previewItems && previewItems.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <div className="text-muted-foreground">
                  Всего: <b>{previewItems.length}</b> · выбрано: <b>{previewItems.filter((i) => i.selected).length}</b>
                  {previewItems.length > MAX && (
                    <span className="text-destructive ml-2">(лишние не будут отправлены)</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button type="button" variant="ghost" size="sm" onClick={() => toggleAll(true)}>
                    <CheckSquare className="h-4 w-4 mr-1" /> Все
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => toggleAll(false)}>
                    <XSquare className="h-4 w-4 mr-1" /> Ни одного
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={removeUnselected}>
                    <Trash2 className="h-4 w-4 mr-1" /> Убрать снятые
                  </Button>
                </div>
              </div>

              <div className="rounded-lg border border-border/50 divide-y divide-border/30 max-h-[360px] overflow-y-auto">
                {previewItems.map((item, idx) => (
                  <label
                    key={`${item.email}-${idx}`}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer"
                  >
                    <Checkbox
                      checked={item.selected}
                      onCheckedChange={(checked) => {
                        setPreviewItems((prev) => {
                          if (!prev) return null;
                          const next = [...prev];
                          next[idx] = { ...next[idx], selected: checked === true };
                          return next;
                        });
                      }}
                    />
                    <span className={`text-sm ${item.selected ? "" : "text-muted-foreground line-through"}`}>
                      {item.email}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPreviewOpen(false)}>Отмена</Button>
            <Button type="button" className="btn-primary-gradient" onClick={applyPreview}>
              Применить ({previewItems?.filter((i) => i.selected).length ?? 0})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Лог последних отправок */}
      <div className="glass rounded-xl p-5 space-y-3">
        <h3 className="font-semibold">Последние отправленные приглашения</h3>
        {logLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Загрузка…
          </div>
        ) : log.length === 0 ? (
          <div className="text-sm text-muted-foreground">Пока нет ни одной отправки.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border/40">
                  <th className="px-3 py-2 font-medium">Адрес</th>
                  <th className="px-3 py-2 font-medium">Статус</th>
                  <th className="px-3 py-2 font-medium">Когда</th>
                  <th className="px-3 py-2 font-medium">Примечание</th>
                </tr>
              </thead>
              <tbody>
                {log.map((row) => {
                  const s = STATUS_LABEL[row.status] ?? { label: row.status, variant: "outline" as const };
                  return (
                    <tr key={row.id} className="border-b border-border/30 align-top">
                      <td className="px-3 py-2">{row.recipient_email}</td>
                      <td className="px-3 py-2"><Badge variant={s.variant}>{s.label}</Badge></td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{fmtDateTime(row.created_at)}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{row.error_message ?? ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function extractEmailsFromText(text: string): string[] {
  // Глобальный regex по всему содержимому файла — работает и для CSV
  // с заголовками/несколькими колонками, и для простого списка построчно.
  const re = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
  const matches = text.match(re) ?? [];
  const set = new Set<string>();
  for (const m of matches) {
    const v = m.trim().toLowerCase();
    if (EMAIL_RE.test(v)) set.add(v);
  }
  return Array.from(set);
}

function CsvUploadButton({ onEmails }: { onEmails: (emails: string[], fileName: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept=".csv,.txt,text/csv,text/plain"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          // Сбрасываем сразу, чтобы можно было повторно выбрать тот же файл.
          if (ref.current) ref.current.value = "";
          if (!file) return;
          if (file.size > 1_000_000) {
            toast.error("Файл слишком большой (максимум 1 МБ)");
            return;
          }
          try {
            const text = await file.text();
            onEmails(extractEmailsFromText(text), file.name);
          } catch {
            toast.error("Не удалось прочитать файл");
          }
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => ref.current?.click()}
        title="Загрузить адреса из CSV или текстового файла"
      >
        <Upload className="h-4 w-4 mr-1" />
        Загрузить CSV
      </Button>
    </>
  );
}
