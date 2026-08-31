// Подробный диалог по заказу: единый стиль с админкой, все действия — внутри модалки.
// Sticky-хедер со статусом/действиями, finance с прогрессом и быстрой оплатой,
// позиции/UTM/заметки/вложения/таймлайн. Realtime подписка на изменения order_*.
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminKeys, invalidateOrder } from "@/lib/query-keys";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Clock, FileText, FileSignature, MailCheck, Copy, Phone, Mail,
  ChevronDown, Calendar,
} from "lucide-react";
import { fmtDate, fmtDateTime } from "@/lib/formatters";
import { displayOrderNumber } from "@/lib/order-number";
import { useDocumentViewer } from "@/hooks/use-document-viewer";
import { useOrderMutations } from "@/hooks/use-order-mutations";
import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import { OrderHeader } from "./OrderHeader";
import { OrderFinanceCard } from "./OrderFinanceCard";
import { OrderItemsTable } from "./OrderItemsTable";
import { OrderTimelineList } from "./OrderTimelineList";
import { InternalNotesEditor } from "./InternalNotesEditor";
import type { OrderRow, OrderItemRow, OrderTimelineRow, OrderStatus } from "./types";

const OrderAttachments = lazy(() =>
  import("@/components/admin/OrderAttachments").then((m) => ({ default: m.OrderAttachments }))
);

interface OrderDialogProps {
  id: string | null;
  onClose: () => void;
}

export function OrderDialog({ id, onClose }: OrderDialogProps) {
  const viewer = useDocumentViewer();
  const enabled = !!id;
  const qc = useQueryClient();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data: order, isLoading } = useQuery({
    queryKey: adminKeys.order(id!),
    enabled,
    queryFn: async () =>
      ((await supabase.from("orders").select("*").eq("id", id!).maybeSingle()).data) as OrderRow | null,
  });
  const { data: items = [] } = useQuery({
    queryKey: adminKeys.orderItems(id!),
    enabled,
    queryFn: async () =>
      ((await supabase.from("order_items").select("*").eq("order_id", id!)).data ?? []) as OrderItemRow[],
  });
  const { data: timeline = [] } = useQuery({
    queryKey: adminKeys.orderTimeline(id!),
    enabled,
    queryFn: async () =>
      ((await supabase.from("order_timeline").select("*").eq("order_id", id!)
        .order("created_at", { ascending: false })).data ?? []) as OrderTimelineRow[],
  });



  // Realtime: дёргаем перечитывание модальных запросов при изменениях по этому заказу.
  const refresh = useDebouncedCallback(() => {
    if (!id) return;
    invalidateOrder(qc, id);
  }, 350);

  useEffect(() => {
    if (!enabled || !id) return;
    const channel = supabase
      .channel(`order-modal-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `id=eq.${id}` }, () => refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "order_timeline", filter: `order_id=eq.${id}` }, () => refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items", filter: `order_id=eq.${id}` }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [enabled, id, refresh]);

  const { updateStatus, updatePaid, confirmOrder, resendEmail, deleteOrder } = useOrderMutations();
  const busy = updateStatus.isPending || updatePaid.isPending || confirmOrder.isPending
    || resendEmail.isPending || deleteOrder.isPending;

  const hasUtm = useMemo(() =>
    !!order && !!(order.source || order.utm_source || order.utm_medium
      || order.utm_campaign || order.utm_term || order.utm_content), [order]);

  const copy = async (text: string | null, kind: string) => {
    if (!text) return;
    try { await navigator.clipboard.writeText(text); toast.success(`${kind} скопирован`); }
    catch { toast.error("Не удалось скопировать"); }
  };

  const openDoc = (kind: "quote" | "invoice" | "contract" | "act") => {
    if (!id) return;
    viewer.openDocument(`/admin/orders/${id}/${kind}?format=pdf`);
  };

  return (
    <Dialog open={enabled} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto p-6 gap-0 bg-card">
        <DialogHeader className="sr-only">
          <DialogTitle>Заказ {order ? displayOrderNumber(order) : ""}</DialogTitle>
          <DialogDescription>Детали и управление заказом</DialogDescription>
        </DialogHeader>

        {isLoading || !order ? <DialogSkeleton /> : (
          <>
            <OrderHeader
              order={order}
              busy={busy}
              onStatusChange={(s: OrderStatus) => updateStatus.mutate({ id: order.id, newStatus: s })}
              onConfirm={() => confirmOrder.mutate(order.id)}
              onResendEmail={() => resendEmail.mutate(order.id)}
              onDelete={() => setDeleteOpen(true)}
            />

            {/* Quick actions */}
            <div className="flex flex-wrap items-center gap-2 mt-4">
              {order.status === "consultation" ? (
                <div className="w-full flex items-center justify-between gap-3 rounded-md border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-amber-200 text-sm">
                  <span>🟡 <b>Запрос на консультацию.</b> Свяжитесь с клиентом и уточните детали — документы будут доступны после превращения в заказ.</span>
                  <Button size="sm" variant="outline"
                    onClick={async () => {
                      try {
                        const { promoteInquiryToOrder } = await import("@/lib/leads.functions");
                        await promoteInquiryToOrder({ data: { id: order.id } });
                        toast.success("Запрос превращён в заказ");
                        invalidateOrder(qc, order.id);
                      } catch (e) {
                        toast.error((e as Error).message);
                      }
                    }}
                  >Превратить в заказ</Button>
                </div>
              ) : (
                <>
                  <Button variant="outline" size="sm" onClick={() => openDoc("quote")}>
                    <FileText className="h-4 w-4 mr-1.5" />КП
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => openDoc("invoice")}>
                    <FileText className="h-4 w-4 mr-1.5" />Счёт
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => openDoc("contract")}>
                    <FileSignature className="h-4 w-4 mr-1.5" />Договор
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => openDoc("act")}>
                    <FileSignature className="h-4 w-4 mr-1.5" />Акт
                  </Button>
                </>
              )}
              <Button variant="outline" size="sm"
                onClick={() => resendEmail.mutate(order.id)}
                disabled={busy || !order.client_email}
              >
                <MailCheck className="h-4 w-4 mr-1.5" />Письмо клиенту
              </Button>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <Card title="Клиент">
                <KV k="Имя" v={order.client_name} />
                <KV k="Телефон" v={
                  <span className="inline-flex items-center gap-1.5">
                    <a href={`tel:${order.client_phone}`} className="hover:text-primary">{order.client_phone || "—"}</a>
                    {order.client_phone && (
                      <button onClick={() => copy(order.client_phone, "Телефон")} className="text-muted-foreground hover:text-foreground" aria-label="Копировать">
                        <Copy className="h-3 w-3" />
                      </button>
                    )}
                  </span>
                } />
                <KV k="Email" v={
                  <span className="inline-flex items-center gap-1.5 max-w-full">
                    <a href={`mailto:${order.client_email}`} className="hover:text-primary truncate">{order.client_email || "—"}</a>
                    {order.client_email && (
                      <button onClick={() => copy(order.client_email, "Email")} className="text-muted-foreground hover:text-foreground shrink-0" aria-label="Копировать">
                        <Copy className="h-3 w-3" />
                      </button>
                    )}
                  </span>
                } />
                <KV k="Компания" v={order.client_company || "—"} />
                <div className="flex gap-1.5 mt-2 pt-2 border-t border-border/30">
                  {order.client_phone && (
                    <a href={`tel:${order.client_phone}`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary px-2 py-1 rounded-md border border-border/40">
                      <Phone className="h-3 w-3" />Позвонить
                    </a>
                  )}
                  {order.client_email && (
                    <a href={`mailto:${order.client_email}`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary px-2 py-1 rounded-md border border-border/40">
                      <Mail className="h-3 w-3" />Написать
                    </a>
                  )}
                </div>
              </Card>

              <Card title="Мероприятие">
                <KV k="Дата" v={
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-3 w-3 text-muted-foreground" />{fmtDate(order.event_date)}
                  </span>
                } />
                <KV k="Создан" v={fmtDateTime(order.created_at)} />
                <KV k="Обновлён" v={fmtDateTime(order.updated_at)} />
              </Card>

              <Card title="Финансы">
                <OrderFinanceCard
                  total={Number(order.total ?? 0)}
                  paid={Number(order.paid ?? 0)}
                  busy={busy}
                  onAddPayment={(amount) =>
                    updatePaid.mutate({ id: order.id, newPaid: Number(order.paid ?? 0) + amount, prevPaid: Number(order.paid ?? 0) })
                  }
                  onSetPaid={(p) =>
                    updatePaid.mutate({ id: order.id, newPaid: p, prevPaid: Number(order.paid ?? 0) })
                  }
                />
              </Card>
            </div>

            <Card title={`Позиции (${items.length})`} className="mt-3">
              <OrderItemsTable items={items} />
            </Card>

            {hasUtm && (
              <Collapsible className="mt-3">
                <Card>
                  <CollapsibleTrigger className="flex w-full items-center justify-between text-sm font-medium group">
                    <span className="text-xs uppercase tracking-wider text-muted-foreground">Источник и UTM</span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-3 grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1.5 text-sm">
                    <UtmRow k="Источник" v={order.source} />
                    <UtmRow k="utm_source" v={order.utm_source} />
                    <UtmRow k="utm_medium" v={order.utm_medium} />
                    <UtmRow k="utm_campaign" v={order.utm_campaign} />
                    <UtmRow k="utm_term" v={order.utm_term} />
                    <UtmRow k="utm_content" v={order.utm_content} />
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            )}

            <div className="grid md:grid-cols-2 gap-3 mt-3">
              {order.notes && (
                <Card title="Комментарий клиента">
                  <pre className="text-sm whitespace-pre-wrap font-sans text-foreground/90 m-0">{order.notes}</pre>
                </Card>
              )}
              <Card title="Внутренние заметки" className={order.notes ? "" : "md:col-span-2"}>
                <InternalNotesEditor orderId={order.id} />
              </Card>
            </div>

            <section className="glass rounded-xl border border-border/50 p-4 sm:p-5 mt-3">
              <Suspense fallback={<div className="space-y-2"><Skeleton className="h-9 w-full" /><Skeleton className="h-9 w-3/4" /></div>}>
                <OrderAttachments orderId={order.id} />
              </Suspense>
            </section>


            <Card
              title={<span className="flex items-center gap-2"><Clock className="h-4 w-4" />Таймлайн ({timeline.length})</span>}
              className="mt-3"
            >
              <OrderTimelineList timeline={timeline} />
            </Card>

            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Удалить заказ {displayOrderNumber(order)}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Будут безвозвратно удалены сам заказ, его позиции, таймлайн и вложения. Действие необратимо.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Отмена</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => {
                      deleteOrder.mutate(order.id, { onSuccess: () => { setDeleteOpen(false); onClose(); } });
                    }}
                    disabled={deleteOrder.isPending}
                  >
                    Удалить
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Card({ title, children, className = "" }: {
  title?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <section className={`glass rounded-xl border border-border/50 p-4 sm:p-5 ${className}`}>
      {title && (
        <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">
          {title}
        </h3>
      )}
      {children}
    </section>
  );
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 py-1 text-sm min-w-0">
      <span className="text-muted-foreground text-xs shrink-0">{k}</span>
      <span className="text-right min-w-0 truncate">{v}</span>
    </div>
  );
}

function UtmRow({ k, v }: { k: string; v: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-2 min-w-0">
      <span className="text-muted-foreground text-xs shrink-0">{k}</span>
      <span className="text-right truncate min-w-0 text-xs">{v || "—"}</span>
    </div>
  );
}

function DialogSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-full" />
      <div className="grid md:grid-cols-3 gap-3">
        <Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" />
      </div>
      <Skeleton className="h-48 w-full" />
    </div>
  );
}
