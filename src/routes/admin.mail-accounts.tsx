// Админ-страница «Почтовые ящики»: CRUD для mail_accounts + проверка соединения.
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Mail, Plus, Pencil, Trash2, PlugZap, Loader2 } from "lucide-react";

import {
  listMailAccounts,
  createMailAccount,
  updateMailAccount,
  deleteMailAccount,
} from "@/lib/mail-accounts.functions";
import { testMailAccount } from "@/lib/mail.functions";

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
      const r = (await test({ data: { accountId: id } })) as { ok: boolean; error?: string };
      if (r.ok) toast.success("Соединение OK: IMAP + SMTP отвечают");
      else toast.error("Ошибка: " + (r.error ?? "unknown"));
    } catch (e) {
      toast.error("Ошибка: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setTestingId(null);
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
    </div>
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
  // sync при открытии
  if (value && value !== valueRef.current) {
    valueRef.current = value;
    queueMicrotask(() => setForm(value));
  }

  return (
    <Dialog open={!!value} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{value?.id ? "Редактировать ящик" : "Новый ящик"}</DialogTitle>
          <DialogDescription>
            Для Gmail/Yandex/Mail.ru используйте пароль приложения, а не основной пароль аккаунта.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Email">
            <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="info@event-hub.by" />
          </Field>
          <Field label="Имя отправителя">
            <Input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} placeholder="Event Hub" />
          </Field>

          <Field label="Логин (если отличается)">
            <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="по умолчанию = email" />
          </Field>
          <Field label={value?.id ? "Новый пароль (если меняется)" : "Пароль"}>
            <Input
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder={value?.id ? "оставьте пустым, чтобы не менять" : ""}
            />
          </Field>

          <div className="sm:col-span-2 mt-2 text-xs uppercase tracking-wider text-muted-foreground">IMAP (входящие)</div>
          <Field label="Хост">
            <Input value={form.imap_host} onChange={(e) => setForm({ ...form, imap_host: e.target.value })} placeholder="imap.example.com" />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Порт">
              <Input type="number" value={form.imap_port} onChange={(e) => setForm({ ...form, imap_port: Number(e.target.value) || 0 })} />
            </Field>
            <Field label="SSL">
              <div className="h-10 flex items-center">
                <Switch checked={form.imap_secure} onCheckedChange={(v) => setForm({ ...form, imap_secure: v })} />
              </div>
            </Field>
          </div>

          <div className="sm:col-span-2 mt-2 text-xs uppercase tracking-wider text-muted-foreground">SMTP (исходящие)</div>
          <Field label="Хост">
            <Input value={form.smtp_host} onChange={(e) => setForm({ ...form, smtp_host: e.target.value })} placeholder="smtp.example.com" />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Порт">
              <Input type="number" value={form.smtp_port} onChange={(e) => setForm({ ...form, smtp_port: Number(e.target.value) || 0 })} />
            </Field>
            <Field label="SSL">
              <div className="h-10 flex items-center">
                <Switch checked={form.smtp_secure} onCheckedChange={(v) => setForm({ ...form, smtp_secure: v })} />
              </div>
            </Field>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Отмена</Button>
          <Button onClick={() => onSave(form)} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// чтобы синхронизировать форму при смене редактируемой записи
const valueRef: { current: FormState | null } = { current: null };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
