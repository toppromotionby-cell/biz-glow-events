import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminKeys, invalidateOrder } from "@/lib/query-keys";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuRadioGroup, DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { SendToTelegramButton } from "@/components/admin/SendToTelegramButton";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  ArrowLeft, Clock, Trash2, Mail, FileText, MoreHorizontal, Phone, Copy,
  Send, Download, ChevronDown, CheckCircle2, Circle, MessageSquare, Paperclip,
  CalendarDays, Building2, User as UserIcon, Link2, Plus,
  History as HistoryIcon,
} from "lucide-react";
import { OrderAttachments } from "@/components/admin/OrderAttachments";
import { RecordHistory } from "@/components/admin/RecordHistory";

import { OrderAssignee } from "@/components/admin/OrderAssignee";
import { OrderPaymentDialog } from "@/components/admin/OrderPaymentDialog";
import { OrderItemsEditor } from "@/components/admin/OrderItemsEditor";
import { OrderConflicts } from "@/components/admin/OrderConflicts";
import { base64ToBytes } from "@/lib/authed-fetch";
import { useDocumentViewer } from "@/hooks/use-document-viewer";
import { previewOrderConfirmationEmail } from "@/lib/orders.functions";
import { notifyOrderStatus } from "@/lib/order-notifications.functions";
import { ORDER_STATUS_LABEL, ORDER_STATUS_COLOR, orderStatusOptions } from "@/lib/order-status";
import { fmtMoney, fmtDate, fmtDateTime } from "@/lib/formatters";
import { displayOrderNumber } from "@/lib/order-number";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type EmailPreviewAttachment = { kind: string; label: string; filename: string; base64: string; size: number };
type EmailPreview = { subject: string; html: string; to: string | null; attachments: EmailPreviewAttachment[] };

type OrderStatus = Database["public"]["Enums"]["order_status"];
type OrderItemRow = Database["public"]["Tables"]["order_items"]["Row"];
type OrderTimelineRow = Database["public"]["Tables"]["order_timeline"]["Row"];

const DOC_KINDS: { kind: "quote" | "contract" | "invoice" | "act"; label: string }[] = [
  { kind: "quote", label: "КП" },
  { kind: "contract", label: "Договор" },
  { kind: "invoice", label: "Счёт" },
  { kind: "act", label: "Акт" },
];

function timelineEventLabel(ev: string): string {
  if (ev.startsWith("status_changed:")) {
    const next = ev.slice("status_changed:".length);
    return `Статус → ${ORDER_STATUS_LABEL[next] ?? next}`;
  }
  if (ev === "attachment_added") return "Загружен файл";
  if (ev === "attachment_removed") return "Удалён файл";
  if (ev === "email_sent") return "Письмо отправлено клиенту";
  if (ev === "payment_added") return "Платёж зафиксирован";
  if (ev === "paid_changed") return "Изменена сумма оплаты";
  if (ev === "assignee_changed") return "Назначен ответственный";
  if (ev === "assignee_cleared") return "Снят ответственный";
  if (ev === "created") return "Заказ создан";
  return ev;
}

function copyToClipboard(text: string, label = "Скопировано") {
  if (!text) return;
  navigator.clipboard?.writeText(text).then(
    () => toast.success(label),
    () => toast.error("Не удалось скопировать"),
  );
}

export const Route = createFileRoute("/admin/orders/$id")({
  component: OrderDetail,
});

function OrderDetail() {
  const viewer = useDocumentViewer();
  const { id } = useParams({ from: "/admin/orders/$id" });
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [internalNotes, setInternalNotes] = useState("");
  const [emailPreview, setEmailPreview] = useState<EmailPreview | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const previewFn = useServerFn(previewOrderConfirmationEmail);
  const loadPreview = useMutation({
    mutationFn: async () => previewFn({ data: { id } }),
    onSuccess: (res) => setEmailPreview(res as EmailPreview),
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: order } = useQuery({
    queryKey: adminKeys.order(id),
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: items = [] } = useQuery({
    queryKey: adminKeys.orderItems(id),
    queryFn: async () => (await supabase.from("order_items").select("*").eq("order_id", id)).data ?? [],
  });

  const { data: timeline = [] } = useQuery({
    queryKey: adminKeys.orderTimeline(id),
    queryFn: async () => (await supabase.from("order_timeline").select("*").eq("order_id", id).order("created_at", { ascending: false })).data ?? [],
  });

  const { data: attachments = [] } = useQuery({
    queryKey: adminKeys.orderAttachments(id),
    queryFn: async () => (await supabase.from("order_attachments").select("kind").eq("order_id", id)).data ?? [],
  });

  useEffect(() => {
    if (order && typeof order.internal_notes === "string") {
      setInternalNotes(order.internal_notes ?? "");
    } else if (order) {
      setInternalNotes("");
    }
  }, [order?.internal_notes]);

  const notifyStatusFn = useServerFn(notifyOrderStatus);
  const updateStatus = useMutation({
    mutationFn: async (status: OrderStatus) => {
      // Этап 3: заказ без ответственного автоматически закрепляется за тем,
      // кто первым сдвинул его из «Новый».
      const patch: { status: OrderStatus; manager_id?: string } = { status };
      if (!order?.manager_id && status !== "new") {
        const { data: auth } = await supabase.auth.getUser();
        if (auth?.user?.id) patch.manager_id = auth.user.id;
      }
      const { error } = await supabase.from("orders").update(patch).eq("id", id);
      if (error) throw error;
      try {
        const res = await notifyStatusFn({ data: { orderId: id, status: String(status) } });
        if (res?.ok) toast.message("Клиенту отправлено уведомление");
      } catch (e) {
        console.warn("notifyOrderStatus failed", e);
      }
      return patch.manager_id ?? null;
    },
    onSuccess: (assigned) => {
      toast.success(assigned ? "Статус обновлён, заказ закреплён за вами" : "Статус обновлён");
      invalidateOrder(qc, id);
    },

    onError: (e: Error) => toast.error(e.message),
  });

  const saveInternalNotes = async () => {
    const { error } = await supabase.from("orders").update({ internal_notes: internalNotes }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Сохранено");
    invalidateOrder(qc, id);
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
      qc.invalidateQueries({ queryKey: adminKeys.ordersAll });
      navigate({ to: "/admin/orders" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const generatedDocKinds = useMemo(
    () => new Set((attachments as { kind: string }[]).map((a) => a.kind)),
    [attachments],
  );

  const daysToEvent = useMemo(() => {
    if (!order?.event_date) return null;
    const d = new Date(order.event_date as string);
    const ms = d.getTime() - Date.now();
    return Math.ceil(ms / 86_400_000);
  }, [order?.event_date]);

  if (!order) return <div>Загрузка...</div>;

  const total = Number(order.total ?? 0);
  const paid = Number(order.paid ?? 0);
  const remaining = Math.max(0, total - paid);
  const paidPct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
  const phoneDigits = (order.client_phone ?? "").replace(/[^\d+]/g, "");

  return (
    <div className="space-y-5 max-w-7xl">
      <Link to="/admin/orders" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        <ArrowLeft className="h-4 w-4" />К списку
      </Link>

      {/* Шапка: заголовок + статус-меню + действия */}
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <h1 className="admin-h1">Заказ {displayOrderNumber(order)}</h1>
          <p className="text-sm text-muted-foreground">
            Создан {fmtDateTime(order.created_at)}
            <span className="ml-2 font-mono text-[10px] opacity-60">#{order.id.slice(0, 8)}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <OrderAssignee orderId={order.id} managerId={order.manager_id ?? null} />
          {/* Кликабельный badge статуса */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition hover:brightness-110",
                  ORDER_STATUS_COLOR[order.status] ?? "bg-muted text-foreground border-border",
                )}
              >
                {ORDER_STATUS_LABEL[order.status] ?? order.status}
                <ChevronDown className="h-3.5 w-3.5 opacity-70" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Сменить статус</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup
                value={order.status}
                onValueChange={(v) => updateStatus.mutate(v as OrderStatus)}
              >
                {orderStatusOptions(order.status).map((o) => (
                  <DropdownMenuRadioItem key={o.value} value={o.value}>{o.label}</DropdownMenuRadioItem>
                ))}

              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Меню действий */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1">
                <MoreHorizontal className="h-4 w-4" />Действия
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => loadPreview.mutate()} disabled={loadPreview.isPending}>
                <Mail className="h-4 w-4 mr-2" />
                {loadPreview.isPending ? "Загрузка…" : "Предпросмотр письма"}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => viewer.openDocument(`/admin/orders/${order.id}/quote?format=pdf`, { name: "КП.pdf" })}
              >
                <Download className="h-4 w-4 mr-2" />Скачать КП
              </DropdownMenuItem>
              <SendToTelegramButton kind="order" id={order.id} asMenuItem label="Отправить КП в Telegram" />
              <DropdownMenuSeparator />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem
                    onSelect={(e) => e.preventDefault()}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />Удалить заказ
                  </DropdownMenuItem>
                </AlertDialogTrigger>
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
                      onClick={() => removeOrder.mutate()}
                      disabled={removeOrder.isPending}
                    >
                      Удалить
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Summary-плашка */}
      <div className="glass rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
        <SummaryStat label="Сумма" value={fmtMoney(total)} />
        <SummaryStat label="Оплачено" value={fmtMoney(paid)} hint={`${paidPct}%`} />
        <SummaryStat
          label="Остаток"
          value={fmtMoney(remaining)}
          tone={remaining > 0 ? "warn" : "ok"}
        />
        <SummaryStat
          label="До мероприятия"
          value={
            daysToEvent === null
              ? "—"
              : daysToEvent < 0
                ? `${Math.abs(daysToEvent)} дн. назад`
                : daysToEvent === 0
                  ? "сегодня"
                  : `${daysToEvent} дн.`
          }
          hint={order.event_date ? fmtDate(order.event_date as string) : undefined}
          tone={daysToEvent !== null && daysToEvent >= 0 && daysToEvent <= 7 ? "warn" : undefined}
        />
      </div>

      {/* Предупреждения о конфликтах на дату */}
      <OrderConflicts
        orderId={order.id}
        eventDate={order.event_date as string | null}
      />



      {/* Двухколоночная компоновка */}
      <div className="grid lg:grid-cols-3 gap-4 items-start">
        {/* ОСНОВНАЯ КОЛОНКА */}
        <div className="lg:col-span-2 space-y-4">
          {/* Клиент */}
          <section className="glass rounded-xl p-5 space-y-4">
            <h3 className="font-semibold flex items-center gap-2"><UserIcon className="h-4 w-4" />Клиент</h3>
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <ContactRow label="Имя" value={order.client_name} />
              <ContactRow
                label="Телефон"
                value={order.client_phone}
                actions={order.client_phone ? (
                  <>
                    <QuickAction href={`tel:${phoneDigits}`} icon={<Phone className="h-3.5 w-3.5" />} title="Позвонить" />
                    <QuickAction
                      href={`https://wa.me/${phoneDigits.replace(/^\+/, "")}`}
                      external icon={<Send className="h-3.5 w-3.5" />} title="WhatsApp"
                    />
                    <QuickAction onClick={() => copyToClipboard(order.client_phone!, "Телефон скопирован")} icon={<Copy className="h-3.5 w-3.5" />} title="Скопировать" />
                  </>
                ) : null}
              />
              <ContactRow
                label="Email"
                value={order.client_email}
                actions={order.client_email ? (
                  <>
                    <QuickAction href={`mailto:${order.client_email}`} icon={<Mail className="h-3.5 w-3.5" />} title="Написать" />
                    <QuickAction onClick={() => copyToClipboard(order.client_email!, "Email скопирован")} icon={<Copy className="h-3.5 w-3.5" />} title="Скопировать" />
                  </>
                ) : null}
              />
              <ContactRow
                label="Компания"
                value={order.client_company ?? "—"}
                icon={<Building2 className="h-3.5 w-3.5" />}
              />
              <ContactRow
                label="Дата мероприятия"
                value={fmtDate(order.event_date)}
                icon={<CalendarDays className="h-3.5 w-3.5" />}
              />
              <ContactRow
                label="Источник"
                value={[order.utm_source, order.utm_campaign].filter(Boolean).join(" / ") || "—"}
                icon={<Link2 className="h-3.5 w-3.5" />}
              />
            </div>
          </section>

          {/* Позиции — редактируемые */}
          <OrderItemsEditor orderId={order.id} items={items as OrderItemRow[]} />

          {order.notes && (
            <section className="glass rounded-xl p-5">
              <h3 className="font-semibold mb-3 flex items-center gap-2"><MessageSquare className="h-4 w-4" />Комментарий клиента</h3>
              <p className="text-sm whitespace-pre-wrap text-muted-foreground">{order.notes}</p>
            </section>
          )}

          {/* Табы: Заметки / Таймлайн / Вложения */}
          <section className="glass rounded-xl p-5">
            <Tabs defaultValue="notes">
              <TabsList>
                <TabsTrigger value="notes" className="gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5" />Заметки
                </TabsTrigger>
                <TabsTrigger value="timeline" className="gap-1.5">
                  <Clock className="h-3.5 w-3.5" />Таймлайн
                  {timeline.length > 0 && (
                    <span className="ml-1 text-[10px] text-muted-foreground">{timeline.length}</span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="attachments" className="gap-1.5">
                  <Paperclip className="h-3.5 w-3.5" />Вложения
                </TabsTrigger>
                <TabsTrigger value="history" className="gap-1.5">
                  <HistoryIcon className="h-3.5 w-3.5" />История
                </TabsTrigger>

              </TabsList>

              <TabsContent value="notes" className="mt-4 space-y-3">
                <p className="text-xs text-muted-foreground">
                  Видны только команде — клиенту не отправляются.
                </p>
                <textarea
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  rows={5}
                  className="w-full bg-input border border-border rounded-md p-3 text-sm"
                  placeholder="Договорённости, нюансы, контактные лица…"
                />
                <Button size="sm" onClick={saveInternalNotes}>Сохранить</Button>
              </TabsContent>

              <TabsContent value="timeline" className="mt-4">
                {timeline.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Событий пока нет</p>
                ) : (
                  <ol className="space-y-3">
                    {(timeline as OrderTimelineRow[]).map((t) => (
                      <li key={t.id} className="text-sm flex gap-3">
                        <span className="text-xs text-muted-foreground whitespace-nowrap w-32 pt-0.5">
                          {fmtDateTime(t.created_at)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{timelineEventLabel(t.event)}</div>
                          {t.payload != null && Object.keys(t.payload as object).length > 0 && (
                            <details className="mt-0.5">
                              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                                Подробнее
                              </summary>
                              <pre className="text-[11px] text-muted-foreground mt-1 whitespace-pre-wrap break-all">
                                {JSON.stringify(t.payload, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </TabsContent>

              <TabsContent value="attachments" className="mt-4">
                <OrderAttachments orderId={order.id} />
              </TabsContent>

              <TabsContent value="history" className="mt-4">
                <RecordHistory recordId={order.id} />
              </TabsContent>
            </Tabs>

          </section>
        </div>

        {/* СТАЙДБАР */}
        <aside className="space-y-4 lg:sticky lg:top-4">
          {/* Финансы */}
          <section className="glass rounded-xl p-5 space-y-3">
            <h3 className="font-semibold">Финансы</h3>
            <dl className="text-sm space-y-2">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Сумма</dt>
                <dd className="font-medium">{fmtMoney(total)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Оплачено</dt>
                <dd>{fmtMoney(paid)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Остаток</dt>
                <dd className={cn("font-medium", remaining > 0 ? "text-amber-300" : "text-emerald-300")}>
                  {fmtMoney(remaining)}
                </dd>
              </div>
            </dl>
            <div>
              <Progress value={paidPct} className="h-1.5" />
              <p className="text-[11px] text-muted-foreground mt-1">{paidPct}% оплачено</p>
            </div>
            <Button size="sm" className="w-full gap-1" onClick={() => setPaymentOpen(true)}>
              <Plus className="h-3.5 w-3.5" />Внести оплату
            </Button>
          </section>

          {/* Документы — чек-лист */}
          <section className="glass rounded-xl p-5 space-y-3">
            <h3 className="font-semibold flex items-center gap-2"><FileText className="h-4 w-4" />Документы</h3>
            <ul className="space-y-1.5">
              {DOC_KINDS.map(({ kind, label }) => {
                const done = generatedDocKinds.has(kind);
                return (
                  <li key={kind}>
                    <button
                      type="button"
                      onClick={() => viewer.openDocument(`/admin/orders/${order.id}/${kind}?format=pdf`)}
                      className="w-full flex items-center justify-between text-sm rounded-md px-2 py-1.5 hover:bg-accent/10 transition"
                    >
                      <span className="flex items-center gap-2">
                        {done ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <Circle className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span>{label}</span>
                      </span>
                      <Download className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="text-[11px] text-muted-foreground">
              Галочка — документ уже загружен в вложения. Клик — открыть/скачать.
            </p>
          </section>
        </aside>
      </div>

      {/* Диалог внесения оплаты */}
      <OrderPaymentDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        orderId={order.id}
        currentPaid={paid}
        total={total}
      />

      {/* Модалка предпросмотра письма */}
      <Dialog open={!!emailPreview} onOpenChange={(o) => !o && setEmailPreview(null)}>
        <DialogContent className="max-w-4xl p-0 gap-0 max-h-[92vh] flex flex-col">
          <DialogHeader className="p-5 pb-3 border-b border-border">
            <DialogTitle>Предпросмотр письма клиенту</DialogTitle>
            <DialogDescription className="space-y-0.5">
              <span className="block"><span className="text-muted-foreground">Кому:</span> {emailPreview?.to ?? "— email клиента не указан"}</span>
              <span className="block"><span className="text-muted-foreground">Тема:</span> {emailPreview?.subject}</span>
              <span className="block text-xs text-muted-foreground">
                Это превью соответствует тому, что получит клиент: тело письма очищено от активных ссылок, PDF будут вложены.
              </span>
            </DialogDescription>
          </DialogHeader>
          {emailPreview && (
            <Tabs defaultValue="email" className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="mx-5 mt-3 self-start">
                <TabsTrigger value="email" className="gap-1.5"><Mail className="h-3.5 w-3.5" />Письмо</TabsTrigger>
                {emailPreview.attachments.map((a) => (
                  <TabsTrigger key={a.kind} value={a.kind} className="gap-1.5">
                    <FileText className="h-3.5 w-3.5" />{a.label}
                    <span className="ml-1 text-[10px] text-muted-foreground">{Math.round(a.size / 1024)} КБ</span>
                  </TabsTrigger>
                ))}
              </TabsList>
              <TabsContent value="email" className="flex-1 overflow-hidden bg-background mt-3">
                <div className="flex items-center justify-end px-5 pb-2 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      viewer.openBlob(emailPreview.html, "text/html;charset=utf-8", "Письмо.html");
                    }}
                    className="text-primary hover:underline"
                  >Открыть на полной странице ↗</button>
                </div>
                <iframe
                  title="email-preview"
                  srcDoc={emailPreview.html}
                  sandbox=""
                  className="w-full h-[66vh] border-0 bg-white"
                />
              </TabsContent>
              {emailPreview.attachments.map((a) => (
                <TabsContent key={a.kind} value={a.kind} className="flex-1 overflow-hidden bg-background mt-3">
                  <div className="flex items-center justify-between px-5 pb-2 text-xs text-muted-foreground">
                    <span>Имя вложения: <span className="text-foreground font-mono">{a.filename}</span></span>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          viewer.openBlob(base64ToBytes(a.base64), "application/pdf", a.filename);
                        }}
                        className="text-primary hover:underline"
                      >Открыть на полной странице ↗</button>
                      <a
                        href={`data:application/pdf;base64,${a.base64}`}
                        download={a.filename}
                        className="text-primary hover:underline"
                      >Скачать</a>
                    </div>
                  </div>
                  <iframe
                    title={`pdf-${a.kind}`}
                    src={`data:application/pdf;base64,${a.base64}`}
                    className="w-full h-[64vh] border-0 bg-white"
                  />
                </TabsContent>
              ))}
            </Tabs>
          )}
          {emailPreview && emailPreview.attachments.length === 0 && (
            <div className="p-5 text-sm text-muted-foreground">
              Для статуса «{ORDER_STATUS_LABEL[order.status] ?? order.status}» PDF-документы не формируются.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ───────── helpers ───────── */

function SummaryStat({
  label, value, hint, tone,
}: { label: string; value: string; hint?: string; tone?: "ok" | "warn" }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div
        className={cn(
          "text-lg font-semibold mt-0.5",
          tone === "warn" && "text-amber-300",
          tone === "ok" && "text-emerald-300",
        )}
      >
        {value}
      </div>
      {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}

function ContactRow({
  label, value, actions, icon,
}: { label: string; value: string | null | undefined; actions?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
          {icon}{label}
        </div>
        <div className="truncate">{value || "—"}</div>
      </div>
      {actions && <div className="flex items-center gap-1 shrink-0">{actions}</div>}
    </div>
  );
}

function QuickAction({
  href, onClick, icon, title, external,
}: {
  href?: string;
  onClick?: () => void;
  icon: React.ReactNode;
  title: string;
  external?: boolean;
}) {
  const cls = "inline-flex items-center justify-center h-7 w-7 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-accent/10 transition";
  if (href) {
    return (
      <a
        href={href}
        title={title}
        aria-label={title}
        className={cls}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {icon}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} title={title} aria-label={title} className={cls}>
      {icon}
    </button>
  );
}
