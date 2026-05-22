import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { downloadCsv, toCsv } from "@/lib/csv";
import { Download, Search } from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  new: "Новый", consultation: "Консультация", estimate: "Смета", contract: "Договор",
  in_progress: "В работе", paid: "Оплачен", completed: "Завершён", cancelled: "Отменён",
};

export const Route = createFileRoute("/admin/orders")({
  component: AdminOrders,
});

function AdminOrders() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("");

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["admin-orders", q, status],
    queryFn: async () => {
      let query = supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(500);
      if (status) query = query.eq("status", status as any);
      if (q) query = query.or(`client_name.ilike.%${q}%,client_phone.ilike.%${q}%,client_email.ilike.%${q}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const exportCsv = () => {
    const rows = orders.map((o: any) => ({
      id: o.id, created: o.created_at, status: STATUS_LABEL[o.status] ?? o.status,
      client: o.client_name, phone: o.client_phone, email: o.client_email,
      company: o.client_company ?? "", event_date: o.event_date ?? "",
      total: o.total, paid: o.paid, source: o.source ?? "",
      utm_source: o.utm_source ?? "", utm_campaign: o.utm_campaign ?? "",
    }));
    downloadCsv(`orders-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows));
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-display font-bold gradient-text">Заказы (CRM)</h1>
          <p className="text-sm text-muted-foreground">{orders.length} записей</p>
        </div>
        <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-2" />Экспорт CSV</Button>
      </header>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Имя, телефон, email..." className="pl-9" />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-md border border-border bg-input px-3 text-sm">
          <option value="">Все статусы</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <div className="glass rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-muted-foreground text-xs uppercase">
              <tr>
                <th className="text-left p-3">Дата</th>
                <th className="text-left p-3">Клиент</th>
                <th className="text-left p-3">Контакты</th>
                <th className="text-left p-3">Мероприятие</th>
                <th className="text-left p-3">Статус</th>
                <th className="text-right p-3">Сумма</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Загрузка...</td></tr>}
              {!isLoading && orders.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Нет заказов</td></tr>}
              {orders.map((o: any) => (
                <tr key={o.id} className="border-t border-border/40 hover:bg-muted/20">
                  <td className="p-3 whitespace-nowrap text-muted-foreground">{new Date(o.created_at).toLocaleDateString("ru-BY")}</td>
                  <td className="p-3">
                    <Link to="/admin/orders/$id" params={{ id: o.id }} className="font-medium hover:text-primary">{o.client_name}</Link>
                    {o.client_company && <div className="text-xs text-muted-foreground">{o.client_company}</div>}
                  </td>
                  <td className="p-3 text-xs">{o.client_phone}<br/><span className="text-muted-foreground">{o.client_email}</span></td>
                  <td className="p-3 whitespace-nowrap text-muted-foreground">{o.event_date ? new Date(o.event_date).toLocaleDateString("ru-BY") : "—"}</td>
                  <td className="p-3"><span className="px-2 py-1 rounded-full glass text-xs border border-primary/30">{STATUS_LABEL[o.status] ?? o.status}</span></td>
                  <td className="p-3 text-right whitespace-nowrap font-medium">{Number(o.total ?? 0).toLocaleString("ru-BY")} BYN</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
