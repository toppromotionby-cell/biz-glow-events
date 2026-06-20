import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useEffect, useRef } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { downloadCsv, toCsv } from "@/lib/csv";
import { Download, Search, ExternalLink, Clock, Plus, Trash2, CheckCircle2, Mail } from "lucide-react";
import { toast } from "sonner";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ORDER_STATUS_LABEL as STATUS_LABEL, ORDER_STATUS_COLOR as STATUS_COLOR } from "@/lib/order-status";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import { fmtMoney, fmtDate, fmtDateTime } from "@/lib/formatters";
import { useOrderMutations } from "@/hooks/use-order-mutations";
import { ageInfo } from "@/components/admin/orders/order-age";
import { PaidCell } from "@/components/admin/orders/PaidCell";
import { OrderDialog } from "@/components/admin/orders/OrderDialog";
import type { OrderListRow, OrderStatus } from "@/components/admin/orders/types";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type SortBy = "created_at" | "total" | "event_date";

export const Route = createFileRoute("/admin/orders")({
  component: AdminOrders,
});

function AdminOrders() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const dq = useDebouncedValue(q, 300);
  const [status, setStatus] = useState<string>("");
  const [sortBy, setSortBy] = useState<SortBy>("created_at");
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["admin-orders", dq, status],
    queryFn: async (): Promise<OrderListRow[]> => {
      // Узкий select — для списка не нужны notes/utm_*, чтобы не тянуть лишний JSON.
      let query = supabase
        .from("orders")
        .select("id,created_at,updated_at,status,client_name,client_company,client_phone,client_email,event_date,source,utm_source,utm_campaign,total,paid")
        .order("created_at", { ascending: false })
        .limit(500);
      if (status) query = query.eq("status", status as OrderStatus);
      if (dq) query = query.or(`client_name.ilike.%${dq}%,client_phone.ilike.%${dq}%,client_email.ilike.%${dq}%,client_company.ilike.%${dq}%`);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as OrderListRow[];
    },
  });

  // Realtime: обновляем список при любых изменениях в orders.
  // Debounce — массовое обновление статусов/оплаты не должно вызывать рефетч на каждое событие.
  const invalidateOrders = useDebouncedCallback(() => {
    qc.invalidateQueries({ queryKey: ["admin-orders"] });
  }, 500);
  useEffect(() => {
    const ch = supabase
      .channel("admin-orders-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        invalidateOrders();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [invalidateOrders]);

  const { updateStatus, updatePaid, deleteOrder, resendEmail, confirmOrder } = useOrderMutations();

  const sorted = useMemo(() => {
    const arr = [...orders];
    arr.sort((a, b) => {
      if (sortBy === "total") return Number(b.total ?? 0) - Number(a.total ?? 0);
      if (sortBy === "event_date") return (b.event_date ?? "").localeCompare(a.event_date ?? "");
      return (b.created_at ?? "").localeCompare(a.created_at ?? "");
    });
    return arr;
  }, [orders, sortBy]);

  const totals = useMemo(() => {
    const total = orders.reduce((s, o) => s + Number(o.total ?? 0), 0);
    const paid = orders.reduce((s, o) => s + Number(o.paid ?? 0), 0);
    return { total, paid, debt: total - paid };
  }, [orders]);

  const exportCsv = () => {
    const rows = orders.map((o) => ({
      id: o.id, created: o.created_at, status: STATUS_LABEL[o.status] ?? o.status,
      client: o.client_name, phone: o.client_phone, email: o.client_email,
      company: o.client_company ?? "", event_date: o.event_date ?? "",
      total: o.total, paid: o.paid, debt: Number(o.total ?? 0) - Number(o.paid ?? 0),
      source: o.source ?? "", utm_source: o.utm_source ?? "",
      utm_campaign: o.utm_campaign ?? "",
    }));
    downloadCsv(`orders-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows));
  };

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Заказы (CRM)"
        subtitle={`${orders.length} записей · клик по строке — подробности`}
        action={<Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-2" />Экспорт CSV</Button>}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Всего заказов" value={String(orders.length)} />
        <Stat label="Сумма" value={fmtMoney(totals.total)} />
        <Stat label="Оплачено" value={fmtMoney(totals.paid)} accent="text-emerald-300" />
        <Stat label="Долг" value={fmtMoney(totals.debt)} accent={totals.debt > 0 ? "text-amber-300" : ""} />
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Имя, телефон, email, компания..." className="pl-9" />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-md border border-border bg-input px-3 text-sm">
          <option value="">Все статусы</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)} className="rounded-md border border-border bg-input px-3 text-sm">
          <option value="created_at">Сначала новые</option>
          <option value="event_date">По дате мероприятия</option>
          <option value="total">По сумме</option>
        </select>
      </div>

      {/* Мобильный карточный вид (< md) */}
      <div className="md:hidden space-y-2">
        {isLoading && Array.from({ length: 4 }).map((_, i) => (
          <div key={`mc-sk-${i}`} className="glass rounded-xl p-4 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        ))}
        {!isLoading && sorted.length === 0 && (
          <div className="glass rounded-xl p-8 text-center text-muted-foreground text-sm">
            {q || status ? "Ничего не найдено" : "Заказов пока нет"}
          </div>
        )}
        {!isLoading && sorted.map((o) => {
          const debt = Number(o.total ?? 0) - Number(o.paid ?? 0);
          const age = ageInfo(o.updated_at ?? o.created_at, o.status);
          const canConfirm = (o.status as string) === "new" || (o.status as string) === "pending";

          return (
            <div
              key={`mc-${o.id}`}
              role="button"
              tabIndex={0}
              onClick={() => setOpenId(o.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpenId(o.id); }
              }}
              className="w-full text-left glass rounded-xl p-3 space-y-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium truncate">{o.client_name}</div>
                  {o.client_company && <div className="text-xs text-muted-foreground truncate">{o.client_company}</div>}
                </div>
                <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] border ${STATUS_COLOR[o.status] ?? "border-primary/30"}`}>
                  {STATUS_LABEL[o.status] ?? o.status}
                </span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{fmtDate(o.created_at)}</span>
                <span className={`inline-flex items-center gap-1 ${age.cls}`}><Clock className="h-3 w-3" />{age.label}</span>
              </div>
              <div className="text-xs truncate">{o.client_phone} · {o.client_email}</div>
              <div className="flex justify-between text-sm pt-1 border-t border-border/40">
                <span className="text-muted-foreground">Сумма: <span className="text-foreground font-medium">{fmtMoney(o.total)}</span></span>
                <span className={debt > 0 ? "text-amber-300" : "text-emerald-300"}>
                  {debt > 0 ? `Долг ${fmtMoney(debt)}` : "Оплачен"}
                </span>
              </div>
              <div className="flex gap-2 pt-1">
                {canConfirm ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="flex-1 h-8 text-xs border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
                    disabled={confirmOrder.isPending}
                    onClick={(e) => { e.stopPropagation(); confirmOrder.mutate(o.id); }}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Подтвердить
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="flex-1 h-8 text-xs border-primary/40 text-primary hover:bg-primary/10"
                    disabled={resendEmail.isPending || !o.client_email}
                    title={o.client_email ? "Отправить письмо клиенту повторно" : "У клиента не указан email"}
                    onClick={(e) => { e.stopPropagation(); resendEmail.mutate(o.id); }}
                  >
                    <Mail className="h-3.5 w-3.5 mr-1" />
                    {resendEmail.isPending && resendEmail.variables === o.id ? "Отправка…" : "Письмо ещё раз"}
                  </Button>
                )}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs border-rose-500/40 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Удалить заказ?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Заказ <b>{o.client_name}</b> от {fmtDate(o.created_at)} будет удалён вместе с позициями,
                        таймлайном и вложениями. Он также исчезнет из кабинета клиента. Действие необратимо.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Отмена</AlertDialogCancel>
                      <AlertDialogAction
                        disabled={deleteOrder.isPending}
                        onClick={() => deleteOrder.mutate(o.id)}
                        className="bg-rose-600 hover:bg-rose-700 text-white"
                      >
                        Удалить
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          );
        })}
        {!isLoading && sorted.length > 0 && (
          <div className="glass rounded-xl p-3 text-xs flex justify-between sticky bottom-2">
            <span className="text-muted-foreground">Итого ({sorted.length})</span>
            <span>{fmtMoney(totals.total)} · <span className="text-emerald-300">{fmtMoney(totals.paid)}</span> · <span className={totals.debt > 0 ? "text-amber-300" : ""}>{fmtMoney(totals.debt)}</span></span>
          </div>
        )}
      </div>

      <DesktopOrdersTable
        sorted={sorted}
        isLoading={isLoading}
        sortBy={sortBy}
        q={q}
        status={status}
        totals={totals}
        setQ={setQ}
        setStatus={setStatus}
        setOpenId={setOpenId}
        updateStatus={updateStatus}
        updatePaid={updatePaid}
        deleteOrder={deleteOrder}
        resendEmail={resendEmail}
        confirmOrder={confirmOrder}
      />


      <OrderDialog id={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}

function Stat({ label, value, accent = "" }: { label: string; value: string; accent?: string }) {
  return (
    <div className="glass rounded-xl p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-xl font-semibold mt-1 ${accent}`}>{value}</div>
    </div>
  );
}
