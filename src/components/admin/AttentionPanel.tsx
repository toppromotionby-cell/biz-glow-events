// Блок «Требует внимания» на дашборде: очередь задач вместо графиков.
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Clock, Inbox, MessageSquareQuote, CircleCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type AttentionItem = {
  key: string;
  label: string;
  count: number;
  to: string;
  icon: typeof Inbox;
  tone: "danger" | "warning" | "info";
};

const TONE: Record<AttentionItem["tone"], string> = {
  danger: "text-destructive border-destructive/40 bg-destructive/10",
  warning: "text-amber-400 border-amber-400/40 bg-amber-400/10",
  info: "text-primary border-primary/40 bg-primary/10",
};

export function AttentionPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-attention"],
    refetchInterval: 60_000,
    staleTime: 30_000,
    queryFn: async () => {
      const dayAgo = new Date(Date.now() - 86400_000).toISOString();
      const [newOrders, inquiries, stale, unpaid, testimonials] = await Promise.all([
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "new"),
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "consultation"),
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "new").lt("created_at", dayAgo),
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "confirmed"),
        supabase.from("testimonials").select("id", { count: "exact", head: true }).eq("published", false),
      ]);
      return {
        newOrders: newOrders.count ?? 0,
        inquiries: inquiries.count ?? 0,
        stale: stale.count ?? 0,
        unpaid: unpaid.count ?? 0,
        testimonials: testimonials.count ?? 0,
      };
    },
  });

  const items: AttentionItem[] = ([
    { key: "stale", label: "Без ответа больше суток", count: data?.stale ?? 0, to: "/admin/orders", icon: Clock, tone: "danger" },
    { key: "new", label: "Новые заказы", count: data?.newOrders ?? 0, to: "/admin/orders", icon: Inbox, tone: "warning" },
    { key: "inq", label: "Запросы на консультацию", count: data?.inquiries ?? 0, to: "/admin/orders", icon: AlertTriangle, tone: "warning" },
    { key: "unpaid", label: "Подтверждены, ждут оплату", count: data?.unpaid ?? 0, to: "/admin/orders", icon: AlertTriangle, tone: "info" },
    { key: "rev", label: "Отзывы на модерации", count: data?.testimonials ?? 0, to: "/admin/testimonials", icon: MessageSquareQuote, tone: "info" },
  ] as AttentionItem[]).filter((i) => i.count > 0);


  return (
    <section className="glass rounded-2xl p-5">
      <h2 className="font-semibold mb-3">Требует внимания</h2>
      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-muted/30 animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <CircleCheck className="h-4 w-4 text-emerald-400" />
          Всё разобрано — открытых задач нет.
        </p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((i) => (
            <Link
              key={i.key}
              to={i.to}
              className={`flex items-center gap-3 rounded-xl border p-3 transition hover:brightness-125 ${TONE[i.tone]}`}
            >
              <i.icon className="h-5 w-5 shrink-0" />
              <span className="text-2xl font-semibold tabular-nums">{i.count}</span>
              <span className="text-xs text-foreground/80 leading-tight">{i.label}</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
