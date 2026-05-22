import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft, Clock } from "lucide-react";
import { OrderAttachments } from "@/components/admin/OrderAttachments";
import { openAuthedDocument } from "@/lib/authed-fetch";

const STATUSES = ["new", "consultation", "estimate", "contract", "in_progress", "paid", "completed", "cancelled"];

export const Route = createFileRoute("/admin/orders/$id")({
  component: OrderDetail,
});

function OrderDetail() {
  const { id } = useParams({ from: "/admin/orders/$id" });
  const qc = useQueryClient();
  const [notes, setNotes] = useState("");

  const { data: order } = useQuery({
    queryKey: ["order", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: items = [] } = useQuery({
    queryKey: ["order-items", id],
    queryFn: async () => (await supabase.from("order_items").select("*").eq("order_id", id)).data ?? [],
  });

  const { data: timeline = [] } = useQuery({
    queryKey: ["order-timeline", id],
    queryFn: async () => (await supabase.from("order_timeline").select("*").eq("order_id", id).order("created_at", { ascending: false })).data ?? [],
  });

  useEffect(() => { if (order?.notes) setNotes(order.notes); }, [order?.notes]);

  const updateStatus = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase.from("orders").update({ status: status as any }).eq("id", id);
      if (error) throw error;
      await supabase.from("order_timeline").insert({ order_id: id, event: "status_changed", payload: { to: status } });
    },
    onSuccess: () => { toast.success("Статус обновлён"); qc.invalidateQueries({ queryKey: ["order", id] }); qc.invalidateQueries({ queryKey: ["order-timeline", id] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const saveNotes = async () => {
    const { error } = await supabase.from("orders").update({ notes }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Сохранено");
  };

  if (!order) return <div>Загрузка...</div>;

  return (
    <div className="space-y-5 max-w-5xl">
      <Link to="/admin/orders" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><ArrowLeft className="h-4 w-4" />К списку</Link>
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-display font-bold gradient-text">Заказ #{order.id.slice(0, 8)}</h1>
          <p className="text-sm text-muted-foreground">Создан {new Date(order.created_at).toLocaleString("ru-BY")}</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => openAuthedDocument(`/admin/orders/${order.id}/quote`).catch((e) => toast.error((e as Error).message))} className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accent/10">Скачать КП</button>
          <select value={order.status} onChange={(e) => updateStatus.mutate(e.target.value)} className="rounded-md border border-border bg-input px-3 py-2 text-sm">
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </header>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="glass rounded-xl p-5 lg:col-span-2 space-y-3">
          <h3 className="font-semibold">Клиент</h3>
          <dl className="text-sm grid grid-cols-2 gap-y-2">
            <dt className="text-muted-foreground">Имя</dt><dd>{order.client_name}</dd>
            <dt className="text-muted-foreground">Телефон</dt><dd>{order.client_phone}</dd>
            <dt className="text-muted-foreground">Email</dt><dd>{order.client_email}</dd>
            <dt className="text-muted-foreground">Компания</dt><dd>{order.client_company ?? "—"}</dd>
            <dt className="text-muted-foreground">Дата мероприятия</dt><dd>{order.event_date ? new Date(order.event_date).toLocaleDateString("ru-BY") : "—"}</dd>
            <dt className="text-muted-foreground">UTM</dt><dd className="text-xs">{[order.utm_source, order.utm_campaign].filter(Boolean).join(" / ") || "—"}</dd>
          </dl>
        </div>
        <div className="glass rounded-xl p-5 space-y-3">
          <h3 className="font-semibold">Финансы</h3>
          <dl className="text-sm space-y-1.5">
            <div className="flex justify-between"><dt className="text-muted-foreground">Сумма</dt><dd className="font-medium">{Number(order.total ?? 0).toLocaleString("ru-BY")} BYN</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Оплачено</dt><dd>{Number(order.paid ?? 0).toLocaleString("ru-BY")} BYN</dd></div>
          </dl>
        </div>
      </div>

      <div className="glass rounded-xl p-5">
        <h3 className="font-semibold mb-3">Позиции ({items.length})</h3>
        {items.length === 0 ? <p className="text-sm text-muted-foreground">Позиций нет</p> : (
          <div className="space-y-2">
            {items.map((it: any) => (
              <div key={it.id} className="flex items-center justify-between text-sm border-b border-border/30 pb-2">
                <div><div className="font-medium">{it.title}</div><div className="text-xs text-muted-foreground">{it.entity_type} · {it.qty} шт.</div></div>
                <div className="font-medium">{Number(it.price ?? 0).toLocaleString("ru-BY")} BYN</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <OrderAttachments orderId={order.id} />

      <div className="glass rounded-xl p-5">
        <h3 className="font-semibold mb-3">Внутренние заметки</h3>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} className="w-full bg-input border border-border rounded-md p-3 text-sm" />
        <Button size="sm" onClick={saveNotes} className="mt-3">Сохранить</Button>
      </div>

      <div className="glass rounded-xl p-5">
        <h3 className="font-semibold mb-3 flex items-center gap-2"><Clock className="h-4 w-4" />Таймлайн</h3>
        {timeline.length === 0 ? <p className="text-sm text-muted-foreground">Событий пока нет</p> : (
          <ol className="space-y-2">
            {timeline.map((t: any) => (
              <li key={t.id} className="text-sm flex gap-3">
                <span className="text-xs text-muted-foreground whitespace-nowrap w-32">{new Date(t.created_at).toLocaleString("ru-BY")}</span>
                <span className="font-medium">{t.event}</span>
                {t.payload && <span className="text-xs text-muted-foreground">{JSON.stringify(t.payload)}</span>}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
