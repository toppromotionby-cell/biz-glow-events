// Проверка конфликтов на дату мероприятия:
// - другие подтверждённые/оплаченные заказы с тем же event_date;
// - пересечения по availability (тот же entity_type + entity_id попадает в [event_date, event_date]).
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle } from "lucide-react";
import { Link } from "@tanstack/react-router";

interface Props {
  orderId: string;
  eventDate: string | null;
  items: Array<{ entity_type: string; entity_id: string | null; title: string }>;
}

const ACTIVE_STATUSES = ["confirmed", "paid", "in_progress", "completed"] as const;

export function OrderConflicts({ orderId, eventDate, items }: Props) {
  const { data } = useQuery({
    queryKey: ["order-conflicts", orderId, eventDate],
    enabled: !!eventDate,
    queryFn: async () => {
      const day = eventDate!;

      // Другие активные заказы в тот же день.
      const { data: otherOrders } = await supabase
        .from("orders")
        .select("id, order_number, client_name, status")
        .eq("event_date", day)
        .neq("id", orderId)
        .in("status", ACTIVE_STATUSES);

      // Пересечения по availability — только для позиций с entity_id.
      const tracked = items.filter((i) => i.entity_id) as Array<{
        entity_type: string; entity_id: string; title: string;
      }>;

      let availConflicts: Array<{ item_id: string; title: string; order_id: string | null }> = [];
      if (tracked.length > 0) {
        const ids = tracked.map((t) => t.entity_id);
        const { data: rows } = await supabase
          .from("availability")
          .select("item_id, entity_type, order_id, start_date, end_date, status")
          .in("item_id", ids)
          .lte("start_date", day)
          .gte("end_date", day);

        availConflicts = (rows ?? [])
          .filter((r) => r.order_id !== orderId && r.status !== "available")
          .map((r) => {
            const it = tracked.find((t) => t.entity_id === r.item_id && t.entity_type === r.entity_type);
            return { item_id: r.item_id, title: it?.title ?? r.item_id, order_id: r.order_id };
          });
      }

      return { otherOrders: otherOrders ?? [], availConflicts };
    },
  });

  if (!eventDate || !data) return null;
  if (data.otherOrders.length === 0 && data.availConflicts.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm space-y-2">
      <div className="flex items-center gap-2 font-medium text-amber-200">
        <AlertTriangle className="h-4 w-4" />
        Возможные конфликты на дату мероприятия
      </div>
      {data.otherOrders.length > 0 && (
        <div>
          <div className="text-xs text-amber-200/80 mb-1">Другие активные заказы на этот день:</div>
          <ul className="space-y-1">
            {data.otherOrders.map((o) => (
              <li key={o.id}>
                <Link
                  to="/admin/orders/$id"
                  params={{ id: o.id }}
                  className="text-amber-100 hover:underline"
                >
                  #{o.id.slice(0, 8)} — {o.client_name} ({o.status})
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {data.availConflicts.length > 0 && (
        <div>
          <div className="text-xs text-amber-200/80 mb-1">Позиции уже заняты:</div>
          <ul className="space-y-1">
            {data.availConflicts.map((c, i) => (
              <li key={`${c.item_id}-${i}`} className="text-amber-100">
                {c.title}
                {c.order_id && c.order_id !== orderId && (
                  <> — занято заказом{" "}
                    <Link to="/admin/orders/$id" params={{ id: c.order_id }} className="underline">
                      #{c.order_id.slice(0, 8)}
                    </Link>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
