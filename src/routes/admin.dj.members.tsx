// Админка DJ: участники клуба и управление доступом.
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { djAdminMembers, djAdminSetMemberStatus } from "@/lib/dj/dj-admin.functions";
import { MEMBER_STATUS_LABEL, type DjMemberStatus } from "@/lib/dj/types";

export const Route = createFileRoute("/admin/dj/members")({
  component: Page,
});

const FILTERS: (DjMemberStatus | "all")[] = ["all", "pending", "approved", "trusted", "rejected", "blocked"];
const ACTIONS: DjMemberStatus[] = ["approved", "trusted", "rejected", "blocked"];

function Page() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<DjMemberStatus | "all">("all");

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
      <AdminPageHeader title="Участники клуба" subtitle="Заявки, доступ к библиотеке и права на загрузку." />

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
