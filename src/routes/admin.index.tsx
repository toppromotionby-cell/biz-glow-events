import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ShoppingCart, Users, CalendarDays, BadgeDollarSign } from "lucide-react";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const { data } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [orders, ordersNew, items, totals] = await Promise.all([
        supabase.from("orders").select("id", { count: "exact", head: true }),
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "new"),
        supabase.from("availability").select("id", { count: "exact", head: true }),
        supabase.from("orders").select("total"),
      ]);
      const sum = (totals.data ?? []).reduce((s, r: any) => s + Number(r.total ?? 0), 0);
      return {
        ordersTotal: orders.count ?? 0,
        ordersNew: ordersNew.count ?? 0,
        bookings: items.count ?? 0,
        revenue: sum,
      };
    },
  });

  const cards = [
    { label: "Всего заказов", value: data?.ordersTotal ?? "—", icon: ShoppingCart },
    { label: "Новых", value: data?.ordersNew ?? "—", icon: Users },
    { label: "Бронирований", value: data?.bookings ?? "—", icon: CalendarDays },
    { label: "Сумма заказов", value: data ? `${data.revenue.toLocaleString("ru-BY")} BYN` : "—", icon: BadgeDollarSign },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-display font-bold gradient-text">Дашборд</h1>
        <p className="text-sm text-muted-foreground">Обзор операционных метрик в реальном времени.</p>
      </header>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(c => (
          <div key={c.label} className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs uppercase tracking-wider">{c.label}</span>
              <c.icon className="h-4 w-4" />
            </div>
            <div className="text-3xl font-display font-bold mt-3">{c.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
