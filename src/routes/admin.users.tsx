import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminKeys } from "@/lib/query-keys";
import { useState } from "react";
import { listUsersWithRoles, assignRole, revokeRole, deleteUser, ALL_ROLES } from "@/lib/users.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Loader2, Plus, X, Search, UserCog, Trash2 } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTable } from "@/components/admin/AdminTable";
import { ROLE_LABEL, ROLE_DESCRIPTION } from "@/lib/permissions";

const ROLE_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  admin: "default",
  manager: "secondary",
  accountant: "secondary",
  content_editor: "outline",
};

const COLS = [
  { key: "user", label: "Пользователь" },
  { key: "contacts", label: "Контакты" },
  { key: "roles", label: "Роли" },
  { key: "assign", label: "Назначить", className: "w-72" },
  { key: "actions", label: "", className: "w-12" },
];

export const Route = createFileRoute("/admin/users")({
  head: () => ({ meta: [{ title: "Пользователи и роли — Админ" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: UsersAdminPage,
});

function UsersAdminPage() {
  const queryClient = useQueryClient();
  const fetchUsers = useServerFn(listUsersWithRoles);
  const assignFn = useServerFn(assignRole);
  const revokeFn = useServerFn(revokeRole);
  const deleteFn = useServerFn(deleteUser);

  const [search, setSearch] = useState("");
  const [selectedRole, setSelectedRole] = useState<Record<string, string>>({});

  const { data: users = [], isLoading, error } = useQuery({
    queryKey: adminKeys.users,
    queryFn: () => fetchUsers(),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: adminKeys.users });

  const assign = useMutation({
    mutationFn: (input: { user_id: string; role: (typeof ALL_ROLES)[number] }) => assignFn({ data: input }),
    onSuccess: () => { toast.success("Роль назначена"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: (input: { user_id: string; role: (typeof ALL_ROLES)[number] }) => revokeFn({ data: input }),
    onSuccess: () => { toast.success("Роль снята"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeUser = useMutation({
    mutationFn: (user_id: string) => deleteFn({ data: { user_id } }),
    onSuccess: () => { toast.success("Пользователь удалён"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = users.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      u.full_name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.company?.toLowerCase().includes(q) ||
      u.phone?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Пользователи и роли"
        subtitle="Назначение прав сотрудникам. Доступно только администраторам."
        icon={
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl btn-primary-gradient">
            <UserCog className="h-5 w-5 text-primary-foreground" />
          </span>
        }
      />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по имени, email, телефону, компании"
          className="pl-9"
        />
      </div>

      <div className="glass rounded-xl p-4">
        <div className="text-sm font-medium mb-2">Что открывает каждая роль</div>
        <ul className="space-y-1.5 text-xs text-muted-foreground">
          {ALL_ROLES.map((r) => (
            <li key={r}>
              <Badge variant={ROLE_VARIANT[r] ?? "outline"} className="mr-2">{ROLE_LABEL[r] ?? r}</Badge>
              {ROLE_DESCRIPTION[r]}
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-muted-foreground mt-2">
          Изменение роли применяется сразу — пользователю не нужно перезаходить.
        </p>
      </div>


      {error && (
        <div className="glass rounded-xl p-4 text-sm text-destructive">{(error as Error).message}</div>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Загрузка…</div>
      ) : (
        <AdminTable
          columns={COLS}
          isEmpty={filtered.length === 0}
          emptyText="Никого не найдено"
        >
          {filtered.map((u) => {
            const pending = selectedRole[u.id];
            const available = ALL_ROLES.filter((r) => !u.roles.includes(r));
            return (
              <tr key={u.id} className="border-t border-border/40 align-top">
                <td className="px-4 py-3">
                  <div className="font-medium">{u.full_name || "—"}</div>
                  {u.company && <div className="text-xs text-muted-foreground mt-0.5">{u.company}</div>}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span>{u.email}</span>
                    {u.email_confirmed_at ? (
                      <Badge variant="outline" className="border-emerald-400/40 text-emerald-300 text-[10px]">Email подтверждён</Badge>
                    ) : (
                      <Badge variant="outline" className="border-amber-400/40 text-amber-300 text-[10px]">Email не подтверждён</Badge>
                    )}
                  </div>
                  {u.phone && <div className="text-xs mt-0.5">{u.phone}</div>}
                </td>
                <td className="px-4 py-3">
                  {u.roles.length === 0 ? (
                    <span className="text-xs text-muted-foreground">— клиент</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {u.roles.map((r) => (
                        <Badge key={r} variant={ROLE_VARIANT[r] ?? "outline"} className="gap-1">
                          {ROLE_LABEL[r] ?? r}
                          <button
                            type="button"
                            className="opacity-60 hover:opacity-100"
                            disabled={revoke.isPending}
                            onClick={() => revoke.mutate({ user_id: u.id, role: r as (typeof ALL_ROLES)[number] })}
                            aria-label={`Снять роль ${ROLE_LABEL[r] ?? r}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  {available.length === 0 ? (
                    <span className="text-xs text-muted-foreground">Все роли назначены</span>
                  ) : (
                    <div className="flex gap-2">
                      <Select
                        value={pending ?? ""}
                        onValueChange={(v) => setSelectedRole((s) => ({ ...s, [u.id]: v }))}
                      >
                        <SelectTrigger className="h-9 flex-1"><SelectValue placeholder="Выбрать роль" /></SelectTrigger>
                        <SelectContent>
                          {available.map((r) => (
                            <SelectItem key={r} value={r}>{ROLE_LABEL[r] ?? r}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        disabled={!pending || assign.isPending}
                        onClick={() => {
                          if (!pending) return;
                          assign.mutate(
                            { user_id: u.id, role: pending as (typeof ALL_ROLES)[number] },
                            { onSuccess: () => setSelectedRole((s) => ({ ...s, [u.id]: "" })) },
                          );
                        }}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" aria-label="Удалить пользователя">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Удалить пользователя?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Будут удалены аккаунт, профиль и роли пользователя <b>{u.full_name || u.email}</b>. Связанные заказы остаются, но теряют привязку. Действие необратимо.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Отмена</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => removeUser.mutate(u.id)}
                        >
                          Удалить
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </td>
              </tr>
            );
          })}
        </AdminTable>
      )}
    </div>
  );
}
