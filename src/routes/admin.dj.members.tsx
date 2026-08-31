// Админка DJ: участники клуба и управление доступом.
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, UserPlus } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { djAdminMembers, djAdminSetMemberStatus, djAdminCreateMember } from "@/lib/dj/dj-admin.functions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MEMBER_STATUS_LABEL, type DjMemberStatus } from "@/lib/dj/types";
import { OpenInNewTabButton } from "@/components/admin/OpenInNewTabButton";
import { DJ_DEFAULT_RETURN } from "@/lib/dj/return-to";

export const Route = createFileRoute("/admin/dj/members")({
  component: Page,
});

const FILTERS: (DjMemberStatus | "all")[] = ["all", "pending", "approved", "trusted", "rejected", "blocked"];
const ACTIONS: DjMemberStatus[] = ["approved", "trusted", "rejected", "blocked"];

function Page() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<DjMemberStatus | "all">("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: "", nickname: "", city: "", contact: "", note: "", status: "approved" as DjMemberStatus });
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () =>
      djAdminCreateMember({
        data: {
          email: form.email.trim(),
          nickname: form.nickname.trim(),
          status: form.status,
          ...(form.city.trim() ? { city: form.city.trim() } : {}),
          ...(form.contact.trim() ? { contact: form.contact.trim() } : {}),
          ...(form.note.trim() ? { note: form.note.trim() } : {}),
        },
      }),
    onSuccess: (res) => {
      toast.success(res.created ? "Пользователь создан и добавлен в клуб" : "Участник обновлён");
      setTempPassword(res.tempPassword ?? null);
      if (!res.tempPassword) setOpen(false);
      setForm({ email: "", nickname: "", city: "", contact: "", note: "", status: "approved" });
      void qc.invalidateQueries({ queryKey: ["dj", "admin"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data = [], isLoading } = useQuery({
    queryKey: ["dj", "admin", "members", status],
    queryFn: () => djAdminMembers({ data: { status } }),
    placeholderData: (prev) => prev,
  });

  const setStatusMutation = useMutation({
    mutationFn: (v: { id: string; status: DjMemberStatus }) => djAdminSetMemberStatus({ data: v }),
    onSuccess: () => { toast.success("Статус обновлён"); void qc.invalidateQueries({ queryKey: ["dj", "admin"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Участники клуба"
        subtitle="Заявки, доступ к библиотеке и права на загрузку."
        action={
          <div className="flex flex-wrap items-center gap-2">
          <OpenInNewTabButton href={DJ_DEFAULT_RETURN} label="Раздел диджея" target="dj-pool" />
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setTempPassword(null); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-gradient-primary"><UserPlus className="mr-1.5 h-4 w-4" />Добавить участника</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Новый участник клуба</DialogTitle>
                <DialogDescription>
                  Если пользователя с такой почтой ещё нет — создадим кабинет и выдадим временный пароль.
                </DialogDescription>
              </DialogHeader>
              {tempPassword ? (
                <div className="space-y-3">
                  <p className="text-sm">Временный пароль (передайте участнику, при первом входе он его сменит):</p>
                  <code className="block rounded-lg border border-border bg-muted/40 px-3 py-2 font-mono text-sm">{tempPassword}</code>
                  <Button className="w-full" onClick={() => { void navigator.clipboard.writeText(tempPassword); toast.success("Скопировано"); }}>Скопировать</Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="m-email">Email</Label>
                    <Input id="m-email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="dj@mail.by" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="m-nick">Ник / имя</Label>
                    <Input id="m-nick" value={form.nickname} onChange={(e) => setForm((f) => ({ ...f, nickname: e.target.value }))} placeholder="DJ Smile" />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="m-city">Город</Label>
                      <Input id="m-city" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="m-contact">Контакт</Label>
                      <Input id="m-contact" value={form.contact} onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))} placeholder="@telegram" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Статус и права</Label>
                    <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as DjMemberStatus }))}>
                      <SelectTrigger aria-label="Статус нового участника"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ACTIONS.concat("pending").map((a) => (
                          <SelectItem key={a} value={a}>{MEMBER_STATUS_LABEL[a]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="m-note">Заметка для админов</Label>
                    <Input id="m-note" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
                  </div>
                </div>
              )}
              {!tempPassword && (
                <DialogFooter>
                  <Button
                    className="w-full bg-gradient-primary"
                    disabled={createMutation.isPending || !form.email.trim() || form.nickname.trim().length < 2}
                    onClick={() => createMutation.mutate()}
                  >
                    {createMutation.isPending ? "Сохраняем..." : "Создать"}
                  </Button>
                </DialogFooter>
              )}
            </DialogContent>
          </Dialog>
          </div>
        }

      />

      <div className="glass rounded-2xl p-4 sm:max-w-xs">
        <Select value={status} onValueChange={(v) => setStatus(v as DjMemberStatus | "all")}>
          <SelectTrigger aria-label="Статус участника"><SelectValue /></SelectTrigger>
          <SelectContent>
            {FILTERS.map((s) => (
              <SelectItem key={s} value={s}>{s === "all" ? "Все статусы" : MEMBER_STATUS_LABEL[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : data.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center text-muted-foreground">Участников с таким статусом нет.</div>
      ) : (
        <ul className="space-y-2">
          {data.map((m) => (
            <li key={m.id} className="glass flex flex-col gap-3 rounded-xl p-4 lg:flex-row lg:items-center">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{m.nickname}</p>
                <p className="text-xs text-muted-foreground">
                  {[m.city, m.contact, m.email].filter(Boolean).join(" · ") || "—"}
                </p>
                {m.bio && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{m.bio}</p>}
              </div>
              <Badge variant={m.status === "trusted" ? "default" : "secondary"} className="w-fit font-normal">
                {MEMBER_STATUS_LABEL[m.status]}
              </Badge>
              <div className="flex flex-wrap gap-2">
                {ACTIONS.filter((a) => a !== m.status).map((a) => (
                  <Button
                    key={a}
                    size="sm"
                    variant={a === "blocked" || a === "rejected" ? "outline" : "default"}
                    disabled={setStatusMutation.isPending}
                    onClick={() => setStatusMutation.mutate({ id: m.id, status: a })}
                  >
                    {MEMBER_STATUS_LABEL[a]}
                  </Button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
