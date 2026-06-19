// Подробный диалог по заказу: клиент, мероприятие, финансы, позиции, UTM, заметки,
// вложения (lazy) и таймлайн событий.
import { lazy, Suspense } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, ExternalLink, Paperclip } from "lucide-react";
import { ORDER_STATUS_LABEL as STATUS_LABEL, ORDER_STATUS_COLOR as STATUS_COLOR } from "@/lib/order-status";
import { fmtMoney, fmtDate, fmtDateTime } from "@/lib/formatters";
import type { OrderRow, OrderItemRow, OrderTimelineRow } from "./types";

// OrderAttachments — тяжёлый компонент c upload-логикой, нужен только когда диалог открыт.
const OrderAttachments = lazy(() =>
  import("@/components/admin/OrderAttachments").then((m) => ({ default: m.OrderAttachments }))
);

interface OrderDialogProps {
  id: string | null;
  onClose: () => void;
}

export function OrderDialog({ id, onClose }: OrderDialogProps) {
  const enabled = !!id;

  const { data: order } = useQuery({
    queryKey: ["order-modal", id],
    enabled,
    queryFn: async () =>
      (await supabase.from("orders").select("*").eq("id", id!).single()).data as OrderRow | null,
  });
  const { data: items = [] } = useQuery({
    queryKey: ["order-modal-items", id],
    enabled,
    queryFn: async () =>
      ((await supabase.from("order_items").select("*").eq("order_id", id!)).data ?? []) as OrderItemRow[],
  });
  const { data: timeline = [] } = useQuery({
    queryKey: ["order-modal-timeline", id],
    enabled,
    queryFn: async () =>
      ((await supabase.from("order_timeline").select("*").eq("order_id", id!).order("created_at", { ascending: false })).data ?? []) as OrderTimelineRow[],
  });
  const { data: attachCount = 0 } = useQuery({
    queryKey: ["order-modal-attachments-count", id],
    enabled,
    queryFn: async () => {
      const { count } = await supabase.from("order_attachments").select("id", { count: "exact", head: true }).eq("order_id", id!);
      return count ?? 0;
    },
  });

  return (
    <Dialog open={enabled} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 flex-wrap">
            <span>Заказ #{id?.slice(0, 8)}</span>
            {order && (
              <span className={`px-2 py-1 rounded-full text-xs border ${STATUS_COLOR[order.status] ?? "border-primary/30"}`}>
                {STATUS_LABEL[order.status] ?? order.status}
              </span>
            )}
            {id && (
              <Link to="/admin/orders/$id" params={{ id }} className="ml-auto text-xs inline-flex items-center gap-1 text-muted-foreground hover:text-primary">
                <ExternalLink className="h-3 w-3" />Открыть полную страницу
              </Link>
            )}
          </DialogTitle>
          <DialogDescription className="sr-only">Детали и управление заказом</DialogDescription>
        </DialogHeader>

        {!order ? <div className="text-sm text-muted-foreground p-6">Загрузка...</div> : (
          <div className="space-y-4">
            <div className="grid md:grid-cols-3 gap-3 text-sm">
              <InfoCard title="Клиент">
                <Row k="Имя" v={order.client_name} />
                <Row k="Телефон" v={<span className="hover:text-primary">{order.client_phone}</span>} />
                <Row k="Email" v={<a href={`mailto:${order.client_email}`} className="hover:text-primary">{order.client_email}</a>} />
                <Row k="Компания" v={order.client_company || "—"} />
              </InfoCard>
              <InfoCard title="Мероприятие">
                <Row k="Дата" v={fmtDate(order.event_date)} />
                <Row k="Создан" v={fmtDateTime(order.created_at)} />
                <Row k="Обновлён" v={fmtDateTime(order.updated_at)} />
              </InfoCard>
              <InfoCard title="Финансы">
                <Row k="Сумма" v={<span className="font-semibold">{fmtMoney(order.total)}</span>} />
                <Row k="Оплачено" v={<span className="text-emerald-300">{fmtMoney(order.paid)}</span>} />
                <Row k="Долг" v={<span className="text-amber-300">{fmtMoney(Number(order.total ?? 0) - Number(order.paid ?? 0))}</span>} />
              </InfoCard>
            </div>

            <InfoCard title={`Позиции (${items.length})`}>
              {items.length === 0 ? <p className="text-sm text-muted-foreground">Позиций нет</p> : (
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr><th className="text-left py-1">Название</th><th className="text-left py-1">Тип</th><th className="text-right py-1">Кол-во</th><th className="text-right py-1">Цена</th><th className="text-right py-1">Итого</th></tr>
                  </thead>
                  <tbody>
                    {items.map((it) => (
                      <tr key={it.id} className="border-t border-border/30">
                        <td className="py-1.5">{it.title}</td>
                        <td className="py-1.5 text-muted-foreground text-xs">{it.entity_type}</td>
                        <td className="py-1.5 text-right">{it.qty}</td>
                        <td className="py-1.5 text-right">{fmtMoney(it.price)}</td>
                        <td className="py-1.5 text-right font-medium">{fmtMoney(Number(it.price ?? 0) * Number(it.qty ?? 1))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </InfoCard>

            {(order.utm_source || order.utm_campaign || order.utm_medium || order.source) && (
              <InfoCard title="Источник и UTM">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-y-1.5 text-sm">
                  <Row k="Источник" v={order.source || "—"} />
                  <Row k="utm_source" v={order.utm_source || "—"} />
                  <Row k="utm_medium" v={order.utm_medium || "—"} />
                  <Row k="utm_campaign" v={order.utm_campaign || "—"} />
                  <Row k="utm_term" v={order.utm_term || "—"} />
                  <Row k="utm_content" v={order.utm_content || "—"} />
                </div>
              </InfoCard>
            )}

            {order.notes && (
              <InfoCard title="Заметки / Реквизиты">
                <pre className="text-sm whitespace-pre-wrap font-sans text-foreground/90">{order.notes}</pre>
              </InfoCard>
            )}

            <InfoCard title={<span className="flex items-center gap-2"><Paperclip className="h-4 w-4" />Вложения ({attachCount})</span>}>
              <Suspense fallback={<div className="space-y-2"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-3/4" /></div>}>
                <OrderAttachments orderId={order.id} />
              </Suspense>
            </InfoCard>

            <InfoCard title={<span className="flex items-center gap-2"><Clock className="h-4 w-4" />Таймлайн ({timeline.length})</span>}>
              {timeline.length === 0 ? <p className="text-sm text-muted-foreground">Событий пока нет</p> : (
                <ol className="space-y-2">
                  {timeline.map((t) => (
                    <li key={t.id} className="text-sm flex gap-3">
                      <span className="text-xs text-muted-foreground whitespace-nowrap w-36">{fmtDateTime(t.created_at)}</span>
                      <span className="font-medium">{t.event}</span>
                      {t.payload && typeof t.payload === "object" && Object.keys(t.payload as object).length > 0 && (
                        <span className="text-xs text-muted-foreground">{JSON.stringify(t.payload)}</span>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </InfoCard>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function InfoCard({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/50 bg-muted/10 p-4">
      <h3 className="font-semibold mb-3 text-sm">{title}</h3>
      {children}
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 py-0.5">
      <span className="text-muted-foreground text-xs">{k}</span>
      <span className="text-right">{v}</span>
    </div>
  );
}
