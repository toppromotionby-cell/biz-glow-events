import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, Clock, Trash2, Mail } from "lucide-react";
import { OrderAttachments } from "@/components/admin/OrderAttachments";
import { openAuthedDocument } from "@/lib/authed-fetch";
import { previewOrderConfirmationEmail } from "@/lib/orders.functions";
import { ORDER_STATUS_LABEL } from "@/lib/order-status";
import { fmtMoney, fmtDate, fmtDateTime } from "@/lib/formatters";



// Единый список статусов и их подписи берём из ORDER_STATUS_LABEL,
// чтобы локализация в админке и письмах не расходилась.


const ENTITY_LABEL: Record<string, string> = {
  zone: "Зона", service: "Услуга", equipment: "Оборудование",
  tech_equipment: "Оборудование", production: "Продакшн",
  production_item: "Продакшн", extras: "Доп. услуга",
};


export const Route = createFileRoute("/admin/orders/$id")({
  component: OrderDetail,
});

function OrderDetail() {
  const { id } = useParams({ from: "/admin/orders/$id" });
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [internalNotes, setInternalNotes] = useState("");
  const [emailPreview, setEmailPreview] = useState<{ subject: string; html: string; to: string | null } | null>(null);
  const previewFn = useServerFn(previewOrderConfirmationEmail);
  const loadPreview = useMutation({
    mutationFn: async () => previewFn({ data: { id } }),
    onSuccess: (res) => setEmailPreview(res),
    onError: (e: Error) => toast.error(e.message),
  });


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

  useEffect(() => {
    if (order && typeof (order as any).internal_notes === "string") {
      setInternalNotes((order as any).internal_notes ?? "");
    } else if (order) {
      setInternalNotes("");
    }
  }, [(order as any)?.internal_notes]);

  const updateStatus = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase.from("orders").update({ status: status as any }).eq("id", id);
      if (error) throw error;
      await supabase.from("order_timeline").insert({ order_id: id, event: "status_changed", payload: { to: status } });
    },
    onSuccess: () => { toast.success("Статус обновлён"); qc.invalidateQueries({ queryKey: ["order", id] }); qc.invalidateQueries({ queryKey: ["order-timeline", id] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveInternalNotes = async () => {
    const { error } = await supabase.from("orders").update({ internal_notes: internalNotes } as any).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Сохранено");
    qc.invalidateQueries({ queryKey: ["order", id] });
  };


  const removeOrder = useMutation({
    mutationFn: async () => {
      await supabase.from("order_items").delete().eq("order_id", id);
      await supabase.from("order_timeline").delete().eq("order_id", id);
      await supabase.from("order_attachments").delete().eq("order_id", id);
      const { error } = await supabase.from("orders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Заказ удалён");
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      navigate({ to: "/admin/orders" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!order) return <div>Загрузка...</div>;

  return (
    <div className="space-y-5 max-w-5xl">
      <Link to="/admin/orders" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><ArrowLeft className="h-4 w-4" />К списку</Link>
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="admin-h1">Заказ #{order.id.slice(0, 8)}</h1>
          <p className="text-sm text-muted-foreground">Создан {fmtDateTime(order.created_at)}</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => openAuthedDocument(`/admin/orders/${order.id}/quote`).catch((e) => toast.error((e as Error).message))} className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accent/10">Скачать КП</button>
          <Button variant="outline" size="sm" onClick={() => loadPreview.mutate()} disabled={loadPreview.isPending}>
            <Mail className="h-4 w-4 mr-1" />{loadPreview.isPending ? "Загрузка…" : "Предпросмотр письма"}
          </Button>
          <select value={order.status} onChange={(e) => updateStatus.mutate(e.target.value)} className="rounded-md border border-border bg-input px-3 py-2 text-sm">
            {Object.entries(ORDER_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive">
                <Trash2 className="h-4 w-4 mr-1" />Удалить заказ
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Удалить заказ #{order.id.slice(0, 8)}?</AlertDialogTitle>
                <AlertDialogDescription>
                  Будут безвозвратно удалены сам заказ, его позиции, таймлайн и вложения. Действие необратимо.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Отмена</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => removeOrder.mutate()}
                  disabled={removeOrder.isPending}
                >
                  Удалить
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
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
            <dt className="text-muted-foreground">Дата мероприятия</dt><dd>{fmtDate(order.event_date)}</dd>
            <dt className="text-muted-foreground">UTM</dt><dd className="text-xs">{[order.utm_source, order.utm_campaign].filter(Boolean).join(" / ") || "—"}</dd>
          </dl>
        </div>
        <div className="glass rounded-xl p-5 space-y-3">
          <h3 className="font-semibold">Финансы</h3>
          <dl className="text-sm space-y-1.5">
            <div className="flex justify-between"><dt className="text-muted-foreground">Сумма</dt><dd className="font-medium">{fmtMoney(order.total)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Оплачено</dt><dd>{fmtMoney(order.paid)}</dd></div>

          </dl>
        </div>
      </div>

      <div className="glass rounded-xl p-5">
        <h3 className="font-semibold mb-3">Позиции ({items.length})</h3>
        {items.length === 0 ? <p className="text-sm text-muted-foreground">Позиций нет</p> : (
          <div className="space-y-2">
            {items.map((it: any) => (
              <div key={it.id} className="flex items-center justify-between text-sm border-b border-border/30 pb-2">
                <div><div className="font-medium">{it.title}</div><div className="text-xs text-muted-foreground">{ENTITY_LABEL[it.entity_type] ?? it.entity_type} · {it.qty} шт.</div></div>
                <div className="font-medium">{Number(it.price ?? 0).toLocaleString("ru-BY")} BYN</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <OrderAttachments orderId={order.id} />

      {order.notes && (
        <div className="glass rounded-xl p-5">
          <h3 className="font-semibold mb-3">Комментарий клиента</h3>
          <p className="text-sm whitespace-pre-wrap text-muted-foreground">{order.notes}</p>
        </div>
      )}

      <div className="glass rounded-xl p-5">
        <h3 className="font-semibold mb-3">Внутренние заметки</h3>
        <p className="text-xs text-muted-foreground mb-2">Видны только команде — клиенту не отправляются.</p>
        <textarea value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} rows={4} className="w-full bg-input border border-border rounded-md p-3 text-sm" />
        <Button size="sm" onClick={saveInternalNotes} className="mt-3">Сохранить</Button>
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

      <Dialog open={!!emailPreview} onOpenChange={(o) => !o && setEmailPreview(null)}>
        <DialogContent className="max-w-3xl p-0 gap-0 max-h-[90vh] flex flex-col">
          <DialogHeader className="p-5 pb-3 border-b border-border">
            <DialogTitle>Предпросмотр письма клиенту</DialogTitle>
            <DialogDescription className="space-y-0.5">
              <div><span className="text-muted-foreground">Кому:</span> {emailPreview?.to ?? "— email клиента не указан"}</div>
              <div><span className="text-muted-foreground">Тема:</span> {emailPreview?.subject}</div>
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-hidden bg-[#0a0a0f]">
            {emailPreview && (
              <iframe
                title="email-preview"
                srcDoc={emailPreview.html}
                sandbox=""
                className="w-full h-[70vh] border-0 bg-white"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
