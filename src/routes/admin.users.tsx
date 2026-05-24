import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listUsersWithRoles, assignRole, revokeRole, ALL_ROLES } from "@/lib/users.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Plus, X, Search, UserCog } from "lucide-react";

const ROLE_LABEL: Record<string, string> = {
  admin: "Администратор",
  manager: "Менеджер",
  content_editor: "Редактор",
  marketer: "Маркетолог",
};
const ROLE_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  admin: "default",
  manager: "secondary",
  content_editor: "outline",
  marketer: "outline",
};

export const Route = createFileRoute("/admin/users")({
  head: () => ({ meta: [{ title: "Пользователи и роли — Админ" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: UsersAdminPage,
});

function UsersAdminPage() {
  const queryClient = useQueryClient();
  const fetchUsers = useServerFn(listUsersWithRoles);
  const assignFn = useServerFn(assignRole);
  const revokeFn = useServerFn(revokeRole);

  const [search, setSearch] = useState("");
  const [selectedRole, setSelectedRole] = useState<Record<string, string>>({});

  const { data: users = [], isLoading, error } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => fetchUsers(),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin", "users"] });

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
      <div className="flex items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl btn-primary-gradient">
          <UserCog className="h-5 w-5 text-primary-foreground" />
        </span>
        <div>
          <h1 className="text-2xl font-display font-bold">Пользователи и роли</h1>
          <p className="text-sm text-muted-foreground">Назначение прав сотрудникам. Доступно только администраторам.</p>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по имени, email, телефону, компании"
          className="pl-9"
        />
      </div>

      {error && (
        <div className="glass rounded-xl p-4 text-sm text-destructive">{(error as Error).message}</div>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Загрузка…</div>
      ) : (
        <div className="glass rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Пользователь</th>
                  <th className="px-4 py-3">Контакты</th>
                  <th className="px-4 py-3">Роли</th>
                  <th className="px-4 py-3 w-72">Назначить</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">Никого не найдено</td></tr>
                )}
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
                        <div>{u.email}</div>
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
