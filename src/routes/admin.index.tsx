import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ShoppingCart, Users, CalendarDays, BadgeDollarSign, Newspaper, ArrowRight, FileText, Presentation, FileSignature, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";
import type { Database } from "@/integrations/supabase/types";
import { fmtCurrency, fmtDateTimeShort } from "@/lib/formatters";
import { displayOrderNumber } from "@/lib/order-number";
import { ProdHealthBanner } from "@/components/admin/ProdHealthBanner";
import { AttentionPanel } from "@/components/admin/AttentionPanel";

import { DEV_OVERLAYS_ENABLED } from "@/lib/debug-flags";
import { useRoles } from "@/hooks/use-roles";
import { adminKeys } from "@/lib/query-keys";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
type StatsOrder = Pick<OrderRow, "id" | "status" | "total" | "source" | "created_at">;
type RecentOrder = Pick<OrderRow, "id" | "order_number" | "client_name" | "total" | "status" | "created_at">;

const STATUS_LABEL: Record<string, string> = {
  new: "Новые", consultation: "Консультация", estimate: "Смета", contract: "Договор",
  in_progress: "В работе", quoted: "Смета выслана", confirmed: "Подтв.",
  paid: "Оплачено", completed: "Завершено", cancelled: "Отменено",
};
const PIE_COLORS = ["#7c3aed", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#3b82f6", "#84cc16"];

const QUICK_ACTIONS = [
  { to: "/admin/documents", label: "Создать КП", icon: FileText },
  { to: "/admin/documents/presentations", label: "Создать презентацию", icon: Presentation },
  { to: "/admin/paperwork", label: "Создать документ", icon: FileSignature },
  { to: "/admin/orders", label: "Новая заявка", icon: Plus },
] as const;

function AdminDashboard() {
  // Этап 6: дашборд показывает операционные метрики только тем ролям, которым
  // разрешены заказы. Контент-редактор видит витрину своих разделов вместо
  // выручки и списка заявок (и запрос к orders вообще не выполняется).
  const { can, loading: rolesLoading } = useRoles();
  const canOrders = can("orders.manage");

  const { data } = useQuery({
    queryKey: adminKeys.dashboardStats,
    enabled: canOrders,
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 86400 * 1000).toISOString();
      const [allOrders, recent, posts] = await Promise.all([
        supabase.from("orders").select("id, status, total, source, created_at"),
        supabase.from("orders").select("id, order_number, client_name, total, status, created_at").order("created_at", { ascending: false }).limit(8),
        supabase.from("blog_posts").select("id", { count: "exact", head: true }).eq("published", true),
      ]);

      const orders = (allOrders.data ?? []) as StatsOrder[];
      const last30 = orders.filter((o) => o.created_at >= since);
      const revenue = orders.reduce((s, o) => s + Number(o.total ?? 0), 0);
      const revenue30 = last30.reduce((s, o) => s + Number(o.total ?? 0), 0);

      // by status
      const byStatus: Record<string, number> = {};
      orders.forEach((o) => { byStatus[o.status] = (byStatus[o.status] ?? 0) + 1; });
      const statusData = Object.entries(byStatus).map(([k, v]) => ({ name: STATUS_LABEL[k] ?? k, value: v }));

      // by source
      const bySource: Record<string, number> = {};
      orders.forEach((o) => { const s = o.source || "direct"; bySource[s] = (bySource[s] ?? 0) + 1; });
      const sourceData = Object.entries(bySource).map(([k, v]) => ({ name: k, value: v })).sort((a, b) => b.value - a.value).slice(0, 6);

      // daily for last 30 days
      const days: Record<string, { orders: number; revenue: number }> = {};
      for (let i = 29; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400 * 1000).toISOString().slice(0, 10);
        days[d] = { orders: 0, revenue: 0 };
      }
      last30.forEach((o) => {
        const d = (o.created_at ?? "").slice(0, 10);
        if (days[d]) {
          days[d].orders += 1;
          days[d].revenue += Number(o.total ?? 0);
        }
      });
      const timeline = Object.entries(days).map(([date, v]) => ({
        date: date.slice(5),
        orders: v.orders,
        revenue: v.revenue,
      }));

      return {
        ordersTotal: orders.length,
        ordersNew: orders.filter((o) => o.status === "new").length,
        ordersActive: orders.filter((o) => !["paid", "cancelled", "completed"].includes(o.status)).length,
        revenue,
        revenue30,
        last30Count: last30.length,
        posts: posts.count ?? 0,
        statusData,
        sourceData,
        timeline,
        recent: (recent.data ?? []) as RecentOrder[],
      };
    },
  });

  const cards = [
    { label: "Всего заявок", value: data?.ordersTotal ?? "—", icon: ShoppingCart, sub: `${data?.last30Count ?? 0} за 30 дн` },
    { label: "Активных", value: data?.ordersActive ?? "—", icon: Users, sub: `${data?.ordersNew ?? 0} новых` },
    { label: "Сумма (всё)", value: data ? fmtCurrency(data.revenue) : "—", icon: BadgeDollarSign, sub: data ? `${fmtCurrency(data.revenue30)} / 30 дн` : "" },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="admin-h1">Дашборд</h1>
        <p className="text-sm text-muted-foreground">Обзор операционных метрик в реальном времени.</p>
      </header>

      {DEV_OVERLAYS_ENABLED && <ProdHealthBanner />}

      <div className="flex flex-wrap gap-2">
        {QUICK_ACTIONS.map((a) => (
          <Button key={a.label} asChild variant="outline" className="h-10">
            <Link to={a.to}>
              <a.icon className="mr-2 h-4 w-4" />
              {a.label}
            </Link>
          </Button>
        ))}
      </div>

      {!canOrders && !rolesLoading && (
        <div className="glass rounded-2xl p-5 text-sm text-muted-foreground">
          Операционные метрики доступны ролям с доступом к заказам. Ниже — ваши разделы.
        </div>
      )}

      {canOrders && <>
      <AttentionPanel />


      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs uppercase tracking-wider">{c.label}</span>
              <c.icon className="h-4 w-4" />
            </div>
            <div className="text-3xl font-display font-bold mt-3">{c.value}</div>
            {c.sub && <div className="text-xs text-muted-foreground mt-1">{c.sub}</div>}
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="glass rounded-2xl p-5 lg:col-span-2">
          <h3 className="font-semibold mb-4">Заявки за 30 дней</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={data?.timeline ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Line type="monotone" dataKey="orders" name="Заявки" stroke="#7c3aed" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass rounded-2xl p-5">
          <h3 className="font-semibold mb-4">По статусам</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={data?.statusData ?? []} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
                  {(data?.statusData ?? []).map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="glass rounded-2xl p-5">
          <h3 className="font-semibold mb-4">Источники трафика</h3>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={data?.sourceData ?? []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} width={80} />
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Bar dataKey="value" fill="#06b6d4" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass rounded-2xl p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Последние заявки</h3>
            <Link to="/admin/orders" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
              Все <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {(!data?.recent || data.recent.length === 0) ? (
            <p className="text-sm text-muted-foreground">Заявок пока нет</p>
          ) : (
            <div className="divide-y divide-border/40">
              {data.recent.map((o) => (
                <Link
                  key={o.id}
                  to="/admin/orders/$id"
                  params={{ id: o.id }}
                  className="flex items-center justify-between gap-3 py-2.5 hover:text-primary transition"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{o.client_name} <span className="text-xs text-muted-foreground">{displayOrderNumber(o)}</span></div>
                    <div className="text-xs text-muted-foreground">{fmtDateTimeShort(o.created_at)}</div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs px-2 py-0.5 rounded-full border border-border/50">{STATUS_LABEL[o.status] ?? o.status}</span>
                    <span className="text-sm tabular-nums w-24 text-right">{fmtCurrency(o.total)}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      </>}

      <div className="grid sm:grid-cols-3 gap-3">
        {canOrders && <><Link to="/admin/orders" className="glass rounded-xl p-4 hover:border-primary/40 transition flex items-center gap-3">
          <ShoppingCart className="h-5 w-5 text-primary" />
          <div>
            <div className="font-medium">CRM</div>
            <div className="text-xs text-muted-foreground">Все заявки</div>
          </div>
        </Link>
        <Link to="/admin/calendar" className="glass rounded-xl p-4 hover:border-primary/40 transition flex items-center gap-3">
          <CalendarDays className="h-5 w-5 text-primary" />
          <div>
            <div className="font-medium">Календарь</div>
            <div className="text-xs text-muted-foreground">Даты мероприятий</div>
          </div>
        </Link></>}
        {can("content.manage") && (
          <Link to="/admin/blog" className="glass rounded-xl p-4 hover:border-primary/40 transition flex items-center gap-3">
            <Newspaper className="h-5 w-5 text-primary" />
            <div>
              <div className="font-medium">Блог</div>
              <div className="text-xs text-muted-foreground">Публикации</div>
            </div>
          </Link>
        )}
        {can("content.manage") && (
          <Link to="/admin/catalog-structure" className="glass rounded-xl p-4 hover:border-primary/40 transition flex items-center gap-3">
            <Newspaper className="h-5 w-5 text-primary" />
            <div>
              <div className="font-medium">Каталог</div>
              <div className="text-xs text-muted-foreground">Разделы и позиции</div>
            </div>
          </Link>
        )}
      </div>
    </div>
  );
}
