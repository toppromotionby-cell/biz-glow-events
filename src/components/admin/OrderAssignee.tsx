// Назначение ответственного менеджера на заказ.
// Хранится в orders.manager_id. Список собирается из user_roles (admin + manager).
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminKeys, invalidateOrder } from "@/lib/query-keys";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { listAssignableManagers } from "@/lib/orders-admin.functions";
import { UserCog, Check, ChevronDown } from "lucide-react";
import { toast } from "sonner";

interface Props {
  orderId: string;
  managerId: string | null;
}

export function OrderAssignee({ orderId, managerId }: Props) {
  const qc = useQueryClient();
  const fetchManagers = useServerFn(listAssignableManagers);

  const { data: managers = [] } = useQuery({
    queryKey: adminKeys.managers,
    queryFn: () => fetchManagers(),
    staleTime: 60_000,
  });

  const assign = useMutation({
    mutationFn: async (newId: string | null) => {
      const { error } = await supabase
        .from("orders")
        .update({ manager_id: newId })
        .eq("id", orderId);
      if (error) throw error;
      await supabase.from("order_timeline").insert({
        order_id: orderId,
        event: newId ? "assignee_changed" : "assignee_cleared",
        payload: { to: newId },
      });
    },
    onSuccess: () => {
      toast.success("Ответственный обновлён");
      invalidateOrder(qc, orderId);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const current = managers.find((m) => m.id === managerId) ?? null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent/10 transition"
          title="Ответственный менеджер"
        >
          <UserCog className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="truncate max-w-[180px]">
            {current?.name ?? <span className="text-muted-foreground">Не назначен</span>}
          </span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 max-h-80 overflow-auto">
        <DropdownMenuLabel>Ответственный менеджер</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => assign.mutate(null)}>
          <span className="text-muted-foreground">— Не назначен —</span>
          {!managerId && <Check className="h-3.5 w-3.5 ml-auto" />}
        </DropdownMenuItem>
        {managers.length === 0 && (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            Нет пользователей с ролью admin/manager
          </div>
        )}
        {managers.map((m) => (
          <DropdownMenuItem key={m.id} onClick={() => assign.mutate(m.id)}>
            <div className="flex flex-col">
              <span className="truncate">{m.name}</span>
              {m.email && m.email !== m.name && (
                <span className="text-[11px] text-muted-foreground truncate">{m.email}</span>
              )}
            </div>
            {managerId === m.id && <Check className="h-3.5 w-3.5 ml-auto" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
