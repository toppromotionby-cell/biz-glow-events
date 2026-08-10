// Проверка конфликтов на дату мероприятия:
// другие подтверждённые/оплаченные заказы с тем же event_date.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { displayOrderNumber } from "@/lib/order-number";

interface Props {
  orderId: string;
  eventDate: string | null;
}

const ACTIVE_STATUSES = ["confirmed", "paid", "in_progress", "completed"] as const;

export function OrderConflicts({ orderId, eventDate }: Props) {
  const { data } = useQuery({
    queryKey: ["order-conflicts", orderId, eventDate],
    enabled: !!eventDate,
    queryFn: async () => {
      const { data: otherOrders } = await supabase
        .from("orders")
        .select("id, order_number, client_name, status")
        .eq("event_date", eventDate!)
        .neq("id", orderId)
        .in("status", ACTIVE_STATUSES);
      return otherOrders ?? [];
    },
  });

  if (!eventDate || !data || data.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm space-y-2">
      <div className="flex items-center gap-2 font-medium text-amber-200">
        <AlertTriangle className="h-4 w-4" />
        Возможные конфликты на дату мероприятия
      </div>
      <div>
        <div className="text-xs text-amber-200/80 mb-1">Другие активные заказы на этот день:</div>
        <ul className="space-y-1">
          {data.map((o) => (
            <li key={o.id}>
              <Link
                to="/admin/orders/$id"
                params={{ id: o.id }}
                className="text-amber-100 hover:underline"
              >
                {displayOrderNumber(o)} — {o.client_name} ({o.status})
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
