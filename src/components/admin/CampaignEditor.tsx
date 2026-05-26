// Форма создания/редактирования email-кампании.
// Загружается на путях /admin/campaigns/new и /admin/campaigns/$id.
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState, useMemo } from "react";
import {
  createCampaign,
  updateCampaign,
  getCampaign,
  previewRecipients,
  sendTestEmail,
  sendCampaign,
} from "@/lib/campaigns.functions";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { wrapPreviewHtml } from "@/lib/email/preview-wrap";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { Loader2, Save, Send, Eye, Users } from "lucide-react";

const ROLE_OPTIONS = [
  { value: "admin", label: "Администраторы" },
  { value: "manager", label: "Менеджеры" },
  { value: "content_editor", label: "Редакторы" },
  { value: "marketer", label: "Маркетологи" },
] as const;

type RecipientsConfig = {
  all_confirmed: boolean;
  roles: string[];
  manual_emails: string[];
};

export type CampaignFormProps = { id?: string };

export function CampaignEditor({ id }: CampaignFormProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isNew = !id;

  const getFn = useServerFn(getCampaign);
  const createFn = useServerFn(createCampaign);
  const updateFn = useServerFn(updateCampaign);
  const previewFn = useServerFn(previewRecipients);
  const testFn = useServerFn(sendTestEmail);
  const sendFn = useServerFn(sendCampaign);

  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [senderEmail, setSenderEmail] = useState("noreply@event-hub.by");
  const [senderName, setSenderName] = useState("event-hub.by");
  const [bodyHtml, setBodyHtml] = useState("<p>Здравствуйте!</p>\n<p>...</p>");
  const [bodyText, setBodyText] = useState("");
  const [cfg, setCfg] = useState<RecipientsConfig>({
    all_confirmed: false,
    roles: [],
    manual_emails: [],
  });
  const [manualRaw, setManualRaw] = useState("");
  const [savedId, setSavedId] = useState<string | undefined>(id);
  const [preview, setPreview] = useState<{ total: number; suppressed: number; will_send: number; sample: string[] } | null>(null);
  const [testTo, setTestTo] = useState(user?.email ?? "");

  // Загрузка существующей кампании.
  const { data: existing } = useQuery({
    queryKey: ["admin", "campaign", id],
    queryFn: () => getFn({ data: { id: id! } }),
    enabled: !!id,
  });

  useEffect(() => {
    if (!existing) return;
    setName(existing.name);
    setSubject(existing.subject);
    setSenderEmail(existing.sender_email);
    setSenderName(existing.sender_name ?? "");
    setBodyHtml(existing.body_html);
    setBodyText(existing.body_text);
    const c = (existing.recipients_config ?? {}) as Partial<RecipientsConfig>;
    setCfg({
      all_confirmed: !!c.all_confirmed,
      roles: c.roles ?? [],
      manual_emails: c.manual_emails ?? [],
    });
    setManualRaw((c.manual_emails ?? []).join(", "));
  }, [existing]);

  useEffect(() => {
    if (user?.email && !testTo) setTestTo(user.email);
  }, [user?.email, testTo]);

  function parsedManual(): string[] {
    return manualRaw
      .split(/[\s,;\n]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
  }

  function buildPayload() {
    return {
      name: name.trim(),
      subject: subject.trim(),
      body_html: bodyHtml,
      body_text: bodyText,
      sender_email: senderEmail.trim(),
      sender_name: senderName.trim() || null,
      recipients_config: {
        all_confirmed: cfg.all_confirmed,
        roles: cfg.roles,
        manual_emails: parsedManual(),
      },
    };
  }

  const save = useMutation({
    mutationFn: async () => {
      const payload = buildPayload();
      if (!payload.name) throw new Error("Укажите название");
      if (!payload.subject) throw new Error("Укажите тему письма");
      if (savedId) {
        return updateFn({ data: { id: savedId, ...payload } });
      } else {
        return createFn({ data: payload });
      }
    },
    onSuccess: (row) => {
      toast.success("Сохранено");
      setSavedId(row.id);
      if (isNew) navigate({ to: "/admin/campaigns/$id", params: { id: row.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const previewMut = useMutation({
    mutationFn: () => previewFn({
      data: {
        all_confirmed: cfg.all_confirmed,
        roles: cfg.roles,
        manual_emails: parsedManual(),
      },
    }),
    onSuccess: (r) => setPreview(r),
    onError: (e: Error) => toast.error(e.message),
  });

  const test = useMutation({
    mutationFn: async () => {
      if (!savedId) {
        await save.mutateAsync();
      }
      const idForTest = savedId ?? (await getCurrentSavedId());
      if (!idForTest) throw new Error("Сначала сохраните кампанию");
      return testFn({ data: { id: idForTest, to: testTo } });
    },
    onSuccess: () => toast.success(`Тест отправлен на ${testTo}`),
    onError: (e: Error) => toast.error(e.message),
  });

  async function getCurrentSavedId(): Promise<string | undefined> {
    // savedId обновляется в onSuccess save — в моменте mutateAsync он может быть ещё пустым.
    return new Promise((resolve) => setTimeout(() => resolve(savedId), 50));
  }

  const send = useMutation({
    mutationFn: async () => {
      if (!savedId) throw new Error("Сначала сохраните кампанию");
      return sendFn({ data: { id: savedId } });
    },
    onSuccess: (r) => {
      toast.success(`Запущена отправка на ${r.total} адресов`);
      navigate({ to: "/admin/campaigns/$id/report", params: { id: savedId! } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const previewHtml = useMemo(
    () => wrapPreviewHtml({ subject, bodyHtml }),
    [subject, bodyHtml],
  );

  const isLocked = existing?.status === "sending" || existing?.status === "sent";

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="admin-h1">{isNew ? "Новая рассылка" : (existing?.name ?? "Кампания")}</h1>
          <p className="text-sm text-muted-foreground">
            {isLocked
              ? "Кампания отправлена — редактирование заблокировано."
              : "Заполните содержимое, выберите получателей и отправьте тест перед запуском."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate({ to: "/admin/campaigns" })}>К списку</Button>
          {!isLocked && (
            <Button onClick={() => save.mutate()} disabled={save.isPending} className="btn-primary-gradient">
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              Сохранить
            </Button>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* ── Левая колонка: контент ── */}
        <div className="space-y-4">
          <div className="glass rounded-xl p-5 space-y-3">
            <h3 className="font-semibold">Содержимое</h3>
            <div className="space-y-2">
              <Label htmlFor="c-name">Название (внутреннее)</Label>
              <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} disabled={isLocked} placeholder="Например, Сентябрь — анонс новых зон" />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="c-from">From email</Label>
                <Input id="c-from" type="email" value={senderEmail} onChange={(e) => setSenderEmail(e.target.value)} disabled={isLocked} placeholder="noreply@event-hub.by" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-fromname">From name</Label>
                <Input id="c-fromname" value={senderName} onChange={(e) => setSenderName(e.target.value)} disabled={isLocked} placeholder="event-hub.by" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-subject">Тема письма</Label>
              <Input id="c-subject" value={subject} onChange={(e) => setSubject(e.target.value)} disabled={isLocked} placeholder="Чем удивим этой осенью" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-html">Тело письма (HTML)</Label>
              <Textarea id="c-html" value={bodyHtml} onChange={(e) => setBodyHtml(e.target.value)} disabled={isLocked} rows={12} className="font-mono text-xs" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-text">Plain-text fallback <span className="text-xs text-muted-foreground">(если пусто — сгенерируется автоматически)</span></Label>
              <Textarea id="c-text" value={bodyText} onChange={(e) => setBodyText(e.target.value)} disabled={isLocked} rows={4} />
            </div>
          </div>

          <div className="glass rounded-xl p-5 space-y-3">
            <h3 className="font-semibold flex items-center gap-2"><Users className="h-4 w-4" />Получатели</h3>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={cfg.all_confirmed} onCheckedChange={(v) => setCfg((c) => ({ ...c, all_confirmed: !!v }))} disabled={isLocked} />
              <span className="text-sm">Все пользователи с подтверждённым email</span>
            </label>
            <div className="space-y-2">
              <Label className="text-sm">По ролям</Label>
              <div className="flex flex-wrap gap-3">
                {ROLE_OPTIONS.map((r) => {
                  const on = cfg.roles.includes(r.value);
                  return (
                    <label key={r.value} className="flex items-center gap-2 cursor-pointer text-sm">
                      <Checkbox
                        checked={on}
                        disabled={isLocked}
                        onCheckedChange={(v) => setCfg((c) => ({
                          ...c,
                          roles: v ? [...c.roles, r.value] : c.roles.filter((x) => x !== r.value),
                        }))}
                      />
                      {r.label}
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-manual">Дополнительные адреса <span className="text-xs text-muted-foreground">(через запятую или с новой строки)</span></Label>
              <Textarea id="c-manual" value={manualRaw} onChange={(e) => setManualRaw(e.target.value)} disabled={isLocked} rows={3} placeholder="anna@example.com, vip@example.com" />
              <div className="text-xs text-muted-foreground">Распознано адресов: {parsedManual().length}</div>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button size="sm" variant="outline" onClick={() => previewMut.mutate()} disabled={previewMut.isPending}>
                {previewMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
                Посчитать получателей
              </Button>
              {preview && (
                <div className="text-xs flex items-center gap-2 text-muted-foreground">
                  <span>Всего: <b className="text-foreground">{preview.total}</b></span>
                  <span>·</span>
                  <span>Будут отправлены: <b className="text-foreground">{preview.will_send}</b></span>
                  {preview.suppressed > 0 && <span>· пропущены (отписки): {preview.suppressed}</span>}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Правая колонка: превью + отправка ── */}
        <div className="space-y-4">
          <div className="glass rounded-xl p-5 space-y-3">
            <h3 className="font-semibold flex items-center gap-2"><Eye className="h-4 w-4" />Превью</h3>
            <div className="rounded-lg border border-border/50 bg-white overflow-hidden">
              <iframe title="Email preview" srcDoc={previewHtml} sandbox="" className="w-full h-[420px]" />
            </div>
          </div>

          {!isLocked && (
            <div className="glass rounded-xl p-5 space-y-3">
              <h3 className="font-semibold">Отправка</h3>
              <div className="space-y-2">
                <Label htmlFor="c-test">Тестовое письмо</Label>
                <div className="flex gap-2">
                  <Input id="c-test" type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="you@example.com" />
                  <Button variant="outline" onClick={() => test.mutate()} disabled={test.isPending || !testTo}>
                    {test.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Отправить тест"}
                  </Button>
                </div>
              </div>
              <div className="pt-2 border-t border-border/40">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button className="btn-primary-gradient w-full" disabled={!savedId || send.isPending}>
                      {send.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                      Запустить рассылку
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Запустить отправку?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Письма уйдут всем выбранным получателям{preview ? ` (~${preview.will_send} адресов)` : ""}. Отменить отправку после запуска нельзя.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Отмена</AlertDialogCancel>
                      <AlertDialogAction onClick={() => send.mutate()}>Запустить</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                {!savedId && <p className="text-xs text-muted-foreground mt-2">Сначала сохраните черновик кнопкой «Сохранить» вверху.</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
