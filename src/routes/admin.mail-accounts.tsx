// Админ-страница «Почтовые ящики»: CRUD для mail_accounts + проверка соединения.
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Mail, Plus, Pencil, Trash2, PlugZap, Loader2, History, CheckCircle2, XCircle } from "lucide-react";

import {
  listMailAccounts,
  createMailAccount,
  updateMailAccount,
  deleteMailAccount,
} from "@/lib/mail-accounts.functions";
import { accountCreateSchema, accountUpdateSchema } from "@/lib/mail-accounts.schema";
import { testMailAccount, listMailAccountChecks } from "@/lib/mail.functions";
import { MAIL_PRESETS, type MailTestResult } from "@/lib/mail-diagnostics";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin/mail-accounts")({
  head: () => ({ meta: [{ title: "Почтовые ящики — Админ" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: MailAccountsPage,
});

type Account = {
  id: string;
  email: string;
  display_name: string | null;
  username: string | null;
  provider: string;
  imap_host: string | null;
  imap_port: number;
  imap_secure: boolean;
  smtp_host: string | null;
  smtp_port: number;
  smtp_secure: boolean;
  status: string;
  sync_error: string | null;
  last_sync_at: string | null;
};

type FormState = {
  id?: string;
  email: string;
  display_name: string;
  username: string;
  password: string;
  imap_host: string;
  imap_port: number;
  imap_secure: boolean;
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
};

const EMPTY: FormState = {
  email: "",
  display_name: "",
  username: "",
  password: "",
  imap_host: "",
  imap_port: 993,
  imap_secure: true,
  smtp_host: "",
  smtp_port: 465,
  smtp_secure: true,
};

function MailAccountsPage() {
  const qc = useQueryClient();
  const list = useServerFn(listMailAccounts);
  const create = useServerFn(createMailAccount);
  const update = useServerFn(updateMailAccount);
  const remove = useServerFn(deleteMailAccount);
  const test = useServerFn(testMailAccount);

  const accountsQ = useQuery({
    queryKey: ["admin", "mail-accounts"],
    queryFn: () => list(),
  });

  const [editing, setEditing] = useState<FormState | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<(MailTestResult & { email?: string }) | null>(null);

  const saveM = useMutation({
    mutationFn: async (f: FormState) => {
      if (f.id) {
        await update({
          data: {
            id: f.id,
            patch: {
              email: f.email,
              display_name: f.display_name || null,
              username: f.username || null,
              password: f.password || undefined, // не перетираем пустым
              imap_host: f.imap_host,
              imap_port: f.imap_port,
              imap_secure: f.imap_secure,
              smtp_host: f.smtp_host,
              smtp_port: f.smtp_port,
              smtp_secure: f.smtp_secure,
            },
          },
        });
      } else {
        await create({
          data: {
            email: f.email,
            display_name: f.display_name || null,
            username: f.username || null,
            password: f.password,
            provider: "imap",
            imap_host: f.imap_host,
            imap_port: f.imap_port,
            imap_secure: f.imap_secure,
            smtp_host: f.smtp_host,
            smtp_port: f.smtp_port,
            smtp_secure: f.smtp_secure,
          },
        });
      }
    },
    onSuccess: () => {
      toast.success("Ящик сохранён");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["admin", "mail-accounts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteM = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Ящик удалён");
      setDeletingId(null);
      qc.invalidateQueries({ queryKey: ["admin", "mail-accounts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleTest(id: string) {
    setTestingId(id);
    try {
      const raw = (await test({ data: { accountId: id } })) as MailTestResult | undefined;
      if (!raw) {
        toast.error("Не удалось получить ответ от сервера");
      } else {
        const email = accounts.find((a) => a.id === id)?.email;
        setTestResult({ ...raw, email });
        if (raw.ok) {
          toast.success(
            raw.applied
              ? "Соединение OK — настройки подобраны и сохранены"
              : "Соединение OK",
          );
        } else if (raw.status_code === 504) {
          toast.error("Воркер просыпается — попробуйте ещё раз через 10–20 секунд");
        } else {
          toast.error(raw.hint ?? raw.message ?? "Ошибка подключения");
        }
      }
    } catch (e) {
      toast.error("Ошибка: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setTestingId(null);
      qc.invalidateQueries({ queryKey: ["admin", "mail-accounts"] });
      qc.invalidateQueries({ queryKey: ["admin", "mail-account-checks", id] });
    }
  }

  const accounts = (accountsQ.data?.accounts ?? []) as Account[];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        icon={<Mail className="h-5 w-5 text-primary" />}
        title="Почтовые ящики"
        subtitle="IMAP/SMTP-аккаунты для работы внутри админки. Соединение идёт через внешний mail-worker."
        action={
          <Button onClick={() => setEditing({ ...EMPTY })}>
            <Plus className="h-4 w-4 mr-2" /> Добавить ящик
          </Button>
        }
      />

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>IMAP</TableHead>
              <TableHead>SMTP</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead className="text-right w-[260px]">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accountsQ.isLoading && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Загрузка…</TableCell></TableRow>
            )}
            {!accountsQ.isLoading && accounts.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Пока нет ящиков</TableCell></TableRow>
            )}
            {accounts.map((a) => (
              <TableRow key={a.id}>
                <TableCell>
                  <div className="font-medium">{a.email}</div>
                  {a.display_name && <div className="text-xs text-muted-foreground">{a.display_name}</div>}
                </TableCell>
                <TableCell className="text-xs">
                  {a.imap_host}:{a.imap_port}{a.imap_secure ? " · SSL" : ""}
                </TableCell>
                <TableCell className="text-xs">
                  {a.smtp_host}:{a.smtp_port}{a.smtp_secure ? " · SSL" : ""}
                </TableCell>
                <TableCell>
                  <Badge variant={a.status === "active" ? "default" : a.status === "error" ? "destructive" : "secondary"}>
                    {a.status}
                  </Badge>
                  {a.sync_error && (
                    <div className="text-xs text-destructive mt-1 max-w-[240px] truncate" title={a.sync_error}>
                      {a.sync_error}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="inline-flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={testingId === a.id}
                      onClick={() => handleTest(a.id)}
                    >
                      {testingId === a.id
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <PlugZap className="h-4 w-4" />}
                      <span className="ml-1">Проверить</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditing({
                        id: a.id,
                        email: a.email,
                        display_name: a.display_name ?? "",
                        username: a.username ?? "",
                        password: "",
                        imap_host: a.imap_host ?? "",
                        imap_port: a.imap_port,
                        imap_secure: a.imap_secure,
                        smtp_host: a.smtp_host ?? "",
                        smtp_port: a.smtp_port,
                        smtp_secure: a.smtp_secure,
                      })}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" title="Журнал проверок" onClick={() => setHistoryId(a.id)}>
                      <History className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeletingId(a.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <TestResultDialog value={testResult} onClose={() => setTestResult(null)} />

      <AccountDialog
        value={editing}
        onClose={() => setEditing(null)}
        onSave={(v) => saveM.mutate(v)}
        saving={saveM.isPending}
      />

      <AlertDialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить ящик?</AlertDialogTitle>
            <AlertDialogDescription>
              Связанные письма и папки тоже будут удалены (каскадно). Действие необратимо.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingId && deleteM.mutate(deletingId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ChecksHistoryDialog accountId={historyId} onClose={() => setHistoryId(null)} />
    </div>
  );
}

function ChecksHistoryDialog({ accountId, onClose }: { accountId: string | null; onClose: () => void }) {
  const fetchChecks = useServerFn(listMailAccountChecks);
  const q = useQuery({
    queryKey: ["admin", "mail-account-checks", accountId],
    queryFn: () => fetchChecks({ data: { accountId: accountId!, limit: 50 } }),
    enabled: !!accountId,
  });
  const checks = (q.data?.checks ?? []) as Array<{
    id: string;
    ok: boolean;
    status_code: number | null;
    message: string | null;
    duration_ms: number | null;
    created_at: string;
  }>;
  return (
    <Dialog open={!!accountId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Журнал проверок</DialogTitle>
          <DialogDescription>Последние 50 запусков «Проверить» для этого ящика.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto rounded-md border">
          {q.isLoading && <div className="p-6 text-center text-muted-foreground text-sm">Загрузка…</div>}
          {!q.isLoading && checks.length === 0 && (
            <div className="p-6 text-center text-muted-foreground text-sm">Проверок ещё не было</div>
          )}
          {checks.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[170px]">Когда</TableHead>
                  <TableHead className="w-[90px]">Статус</TableHead>
                  <TableHead className="w-[70px]">Код</TableHead>
                  <TableHead>Сообщение</TableHead>
                  <TableHead className="w-[70px] text-right">мс</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {checks.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-xs whitespace-nowrap">
                      {new Date(c.created_at).toLocaleString("ru-RU")}
                    </TableCell>
                    <TableCell>
                      {c.ok ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 text-xs">
                          <CheckCircle2 className="h-3.5 w-3.5" /> OK
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-destructive text-xs">
                          <XCircle className="h-3.5 w-3.5" /> Ошибка
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">{c.status_code ?? "—"}</TableCell>
                    <TableCell className="text-xs break-words max-w-[320px]">
                      {c.message ?? ""}
                    </TableCell>
                    <TableCell className="text-xs tabular-nums text-right">
                      {c.duration_ms ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Закрыть</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AccountDialog({
  value, onClose, onSave, saving,
}: {
  value: FormState | null;
  onClose: () => void;
  onSave: (v: FormState) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<FormState>(value ?? EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [preset, setPreset] = useState<string | null>(null);
  const presetNote = MAIL_PRESETS.find((p) => p.id === preset)?.note ?? null;

  function applyPreset(id: string) {
    const p = MAIL_PRESETS.find((x) => x.id === id);
    if (!p) return;
    setPreset(id);
    setErrors({});
    setForm((f) => ({
      ...f,
      imap_host: p.imap_host,
      imap_port: p.imap_port,
      imap_secure: p.imap_secure,
      smtp_host: p.smtp_host,
      smtp_port: p.smtp_port,
      smtp_secure: p.smtp_secure,
      username: p.loginIsEmail ? f.email || f.username : f.username,
    }));
  }
  useEffect(() => {
    if (value) {
      setForm(value);
      setErrors({});
      setPreset(MAIL_PRESETS.find((p) => p.imap_host === value.imap_host)?.id ?? null);
    }
  }, [value]);

  function update<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => {
      const next = { ...f, [k]: v } as FormState;
      // Для провайдеров, где логин = адрес ящика, держим поле логина синхронным.
      const p = MAIL_PRESETS.find((x) => x.id === preset);
      if (k === "email" && p?.loginIsEmail && (!f.username || f.username === f.email)) {
        next.username = String(v);
      }
      return next;
    });
    if (errors[k as string]) {
      setErrors((e) => {
        const n = { ...e };
        delete n[k as string];
        return n;
      });
    }
  }

  function handleSave() {
    // Для edit пароль может быть пустой — не валидируем его при патче.
    const isEdit = !!value?.id;
    const payload = {
      email: form.email,
      display_name: form.display_name || null,
      username: form.username || null,
      ...(isEdit && !form.password ? {} : { password: form.password }),
      provider: "imap",
      imap_host: form.imap_host,
      imap_port: form.imap_port,
      imap_secure: form.imap_secure,
      smtp_host: form.smtp_host,
      smtp_port: form.smtp_port,
      smtp_secure: form.smtp_secure,
    };
    const schema = isEdit ? accountUpdateSchema : accountCreateSchema;
    const r = schema.safeParse(payload);
    if (!r.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of r.error.issues) {
        const key = String(issue.path[0] ?? "_");
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      toast.error("Проверьте поля формы");
      return;
    }
    setErrors({});
    onSave(form);
  }

  return (
    <Dialog open={!!value} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{value?.id ? "Редактировать ящик" : "Новый ящик"}</DialogTitle>
          <DialogDescription>
            Выберите провайдера — хосты и порты подставятся автоматически. Для hoster.by это
            imap.hoster.by (993, SSL) и smtp.hoster.by (465, SSL); логин — полный адрес ящика, пароль
            — от самого ящика (не от личного кабинета).
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Пресет:</span>
          {MAIL_PRESETS.map((p) => (
            <Button
              key={p.id}
              type="button"
              size="sm"
              variant={preset === p.id ? "default" : "outline"}
              onClick={() => applyPreset(p.id)}
            >
              {p.label}
            </Button>
          ))}
          <Button type="button" size="sm" variant={preset === null ? "default" : "outline"} onClick={() => setPreset(null)}>
            Вручную
          </Button>
        </div>
        {presetNote && (
          <p className="text-xs text-muted-foreground rounded-md border bg-muted/40 p-3">{presetNote}</p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Email" error={errors.email}>
            <Input value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="info@event-hub.by" />
          </Field>
          <Field label="Имя отправителя" error={errors.display_name}>
            <Input value={form.display_name} onChange={(e) => update("display_name", e.target.value)} placeholder="Event Hub" />
          </Field>

          <Field label="Логин (если отличается)" error={errors.username}>
            <Input value={form.username} onChange={(e) => update("username", e.target.value)} placeholder="по умолчанию = email" />
          </Field>
          <Field label={value?.id ? "Новый пароль (если меняется)" : "Пароль"} error={errors.password}>
            <Input
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
              placeholder={value?.id ? "оставьте пустым, чтобы не менять" : ""}
            />
          </Field>

          <div className="sm:col-span-2 mt-2 text-xs uppercase tracking-wider text-muted-foreground">IMAP (входящие)</div>
          <Field label="Хост" error={errors.imap_host}>
            <Input value={form.imap_host} onChange={(e) => update("imap_host", e.target.value.trim())} placeholder="imap.example.com" />
          </Field>
          <div className="grid-fields">
            <Field label="Порт" error={errors.imap_port}>
              <Input
                type="number"
                min={1}
                max={65535}
                value={form.imap_port}
                onChange={(e) => update("imap_port", Number(e.target.value) || 0)}
              />
            </Field>
            <Field label="SSL" error={errors.imap_secure}>
              <div className="h-10 flex items-center">
                <Switch checked={form.imap_secure} onCheckedChange={(v) => update("imap_secure", v)} />
              </div>
            </Field>
          </div>

          <div className="sm:col-span-2 mt-2 text-xs uppercase tracking-wider text-muted-foreground">SMTP (исходящие)</div>
          <Field label="Хост" error={errors.smtp_host}>
            <Input value={form.smtp_host} onChange={(e) => update("smtp_host", e.target.value.trim())} placeholder="smtp.example.com" />
          </Field>
          <div className="grid-fields">
            <Field label="Порт" error={errors.smtp_port}>
              <Input
                type="number"
                min={1}
                max={65535}
                value={form.smtp_port}
                onChange={(e) => update("smtp_port", Number(e.target.value) || 0)}
              />
            </Field>
            <Field label="SSL" error={errors.smtp_secure}>
              <div className="h-10 flex items-center">
                <Switch checked={form.smtp_secure} onCheckedChange={(v) => update("smtp_secure", v)} />
              </div>
            </Field>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Отмена</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}



function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function TestResultDialog({
  value,
  onClose,
}: {
  value: (MailTestResult & { email?: string }) | null;
  onClose: () => void;
}) {
  const steps = value?.steps ?? [];
  return (
    <Dialog open={!!value} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {value?.ok ? "Подключение работает" : "Подключение не удалось"}
          </DialogTitle>
          <DialogDescription>
            {value?.email ? `${value.email} · ` : ""}
            {value?.duration_ms != null ? `${Math.round(value.duration_ms / 100) / 10} c` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {steps.map((s) => (
            <div key={s.step} className="flex gap-2 text-sm">
              {s.ok ? (
                <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
              ) : (
                <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              )}
              <div className="min-w-0">
                <div className="font-medium uppercase text-xs tracking-wider">
                  {s.step === "imap" ? "IMAP · входящие" : "SMTP · отправка"}
                </div>
                <div className="text-muted-foreground break-words">
                  {s.ok ? s.detail : (s.message ?? "ошибка")}
                </div>
                {!s.ok && s.response && (
                  <div className="text-xs text-muted-foreground/80 break-words">{s.response}</div>
                )}
                {!!s.attempts?.length && (
                  <div className="mt-2 space-y-1">
                    {s.attempts.map((attempt, index) => {
                      const port = s.step === "imap"
                        ? attempt.tried?.imap_port
                        : attempt.tried?.smtp_port;
                      const secure = s.step === "imap"
                        ? attempt.tried?.imap_secure
                        : attempt.tried?.smtp_secure;
                      return (
                        <div key={`${s.step}-${index}`} className="text-xs text-muted-foreground">
                          {attempt.ok ? "✓" : "×"} порт {String(port ?? "—")} · {secure ? "SSL" : "STARTTLS"}
                          {attempt.phase ? ` · ${attempt.phase.toUpperCase()}` : ""}
                          {attempt.duration_ms != null ? ` · ${Math.round(attempt.duration_ms / 100) / 10} c` : ""}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ))}

          {!value?.ok && value?.hint && (
            <p className="text-sm rounded-md border border-destructive/40 bg-destructive/10 p-3">
              {value.hint}
            </p>
          )}
          {value?.ok && value.applied && (
            <p className="text-sm rounded-md border bg-muted/40 p-3">
              Рабочие параметры подобраны автоматически и сохранены в ящике.
            </p>
          )}
          {steps.length === 0 && (
            <p className="text-sm text-muted-foreground break-words">{value?.message}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Закрыть</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
