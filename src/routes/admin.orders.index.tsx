import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminKeys, invalidateOrder } from "@/lib/query-keys";
import { useState, useMemo, useEffect, useRef } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { downloadCsv, toCsv } from "@/lib/csv";
import { Download, Search, Clock, Plus, Trash2, CheckCircle2, Mail } from "lucide-react";
import { toast } from "sonner";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ORDER_STATUS_LABEL as STATUS_LABEL, ORDER_STATUS_COLOR as STATUS_COLOR, orderStatusOptions } from "@/lib/order-status";
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

type OrdersKind = "all" | "orders" | "inquiries";

interface OrdersSearch {
  kind?: OrdersKind | undefined;
  q?: string | undefined;
  status?: string | undefined;
  sort?: SortBy | undefined;
}

// Фильтры списка заказов живут в URL: состояние переживает перезагрузку и «назад».
export const Route = createFileRoute("/admin/orders/")({
  validateSearch: (search: Record<string, unknown>): OrdersSearch => {
    const k = search["kind"];
    const kind: OrdersKind | undefined =
      k === "inquiry" || k === "inquiries" ? "inquiries" : k === "orders" ? "orders" : undefined;
    const sort = search["sort"];
    return {
      kind,
      q: typeof search["q"] === "string" && search["q"] ? (search["q"] as string) : undefined,
      status: typeof search["status"] === "string" && search["status"] ? (search["status"] as string) : undefined,
      sort: sort === "created_at" || sort === "event_date" || sort === "total" ? (sort as SortBy) : undefined,
    };
  },
  component: AdminOrders,
});

function AdminOrders() {
  const qc = useQueryClient();
  const sp = Route.useSearch();
  const routeNavigate = Route.useNavigate();
  const patchSearch = (patch: OrdersSearch) =>
    void routeNavigate({ to: ".", search: (prev) => ({ ...prev, ...patch }), replace: true });

  const kind: OrdersKind = sp.kind ?? "all";
  const status = sp.status ?? "";
  const sortBy: SortBy = sp.sort ?? "created_at";
  const setKind = (v: OrdersKind) => patchSearch({ kind: v === "all" ? undefined : v });
  const setStatus = (v: string) => patchSearch({ status: v || undefined });
  const setSortBy = (v: SortBy) => patchSearch({ sort: v === "created_at" ? undefined : v });

  const [q, setQ] = useState(sp.q ?? "");
  const dq = useDebouncedValue(q, 300);
  useEffect(() => {
    if ((sp.q ?? "") === dq) return;
    patchSearch({ q: dq || undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dq]);
  const [openId, setOpenId] = useState<string | null>(null);


  const { data: orders = [], isLoading } = useQuery({
    queryKey: adminKeys.orders({ q: dq, status, kind }),
    queryFn: async (): Promise<OrderListRow[]> => {
      // Узкий select — для списка не нужны notes/utm_*, чтобы не тянуть лишний JSON.
      let query = supabase
        .from("orders")
        .select("id,order_number,created_at,updated_at,status,client_name,client_company,client_phone,client_email,event_date,source,utm_source,utm_campaign,total,paid")
        .order("created_at", { ascending: false })
        .limit(500);
      if (kind === "inquiries") query = query.eq("status", "consultation" as OrderStatus);
      else if (kind === "orders") query = query.neq("status", "consultation" as OrderStatus);
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
    qc.invalidateQueries({ queryKey: adminKeys.ordersAll });
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
        help="orders-list"
        subtitle={`${orders.length} записей · клик по строке — подробности`}
        action={<Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-2" />Экспорт CSV</Button>}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Всего заказов" value={String(orders.length)} />
        <Stat label="Сумма" value={fmtMoney(totals.total)} />
        <Stat label="Оплачено" value={fmtMoney(totals.paid)} accent="text-emerald-300" />
        <Stat label="Долг" value={fmtMoney(totals.debt)} accent={totals.debt > 0 ? "text-amber-300" : ""} />
      </div>

      <div className="flex flex-wrap items-center gap-2 -mb-1" role="tablist" aria-label="Тип записей">
        {([
          { k: "all", label: "Все" },
          { k: "orders", label: "Заказы" },
          { k: "inquiries", label: "🟡 Запросы" },
        ] as const).map((t) => (
          <button
            key={t.k}
            role="tab"
            aria-selected={kind === t.k}
            onClick={() => setKind(t.k)}
            className={`px-3 py-1.5 rounded-md text-sm border transition ${kind === t.k ? "bg-primary/15 border-primary/40 text-primary" : "border-border hover:bg-muted"}`}
          >
            {t.label}
          </button>
        ))}
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
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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

type DesktopProps = {
  sorted: OrderListRow[];
  isLoading: boolean;
  sortBy: SortBy;
  q: string;
  status: string;
  totals: { total: number; paid: number; debt: number };
  setQ: (s: string) => void;
  setStatus: (s: string) => void;
  setOpenId: (id: string | null) => void;
  updateStatus: ReturnType<typeof useOrderMutations>["updateStatus"];
  updatePaid: ReturnType<typeof useOrderMutations>["updatePaid"];
  deleteOrder: ReturnType<typeof useOrderMutations>["deleteOrder"];
  resendEmail: ReturnType<typeof useOrderMutations>["resendEmail"];
  confirmOrder: ReturnType<typeof useOrderMutations>["confirmOrder"];
};

function DesktopOrdersTable({
  sorted, isLoading, sortBy, q, status, totals,
  setQ, setStatus, setOpenId,
  updateStatus, updatePaid, deleteOrder, resendEmail, confirmOrder,
}: DesktopProps) {
  // Виртуализация строк — рендерим только видимые в окне просмотра,
  // чтобы 500+ заказов не топили DOM. Скроллится сама страница, поэтому
  // используем useWindowVirtualizer + scrollMargin от позиции контейнера.
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useWindowVirtualizer({
    count: sorted.length,
    estimateSize: () => 76,
    overscan: 8,
    scrollMargin: parentRef.current?.offsetTop ?? 0,
    getItemKey: (i) => sorted[i]?.id ?? i,
  });
  const items = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();
  const scrollMargin = virtualizer.options.scrollMargin;
  const paddingTop = items.length > 0 ? Math.max(0, items[0].start - scrollMargin) : 0;
  const paddingBottom = items.length > 0 ? Math.max(0, totalSize - (items[items.length - 1].end - scrollMargin)) : 0;
  const showVirtual = !isLoading && sorted.length > 0;

  return (
    <div ref={parentRef} className="glass rounded-xl overflow-hidden hidden md:block">
      <div className="overflow-x-auto">
        <table className="w-full text-sm" aria-label="Список заказов">
          <thead className="admin-table-head">
            <tr>
              <th scope="col" aria-sort={sortBy === "created_at" ? "descending" : "none"} className="text-left p-3">Создан</th>
              <th scope="col" className="text-left p-3">Клиент / Компания</th>
              <th scope="col" className="text-left p-3">Контакты</th>
              <th scope="col" aria-sort={sortBy === "event_date" ? "descending" : "none"} className="text-left p-3">Мероприятие</th>
              <th scope="col" className="text-left p-3">Источник</th>
              <th scope="col" className="text-left p-3">Статус</th>
              <th scope="col" className="text-left p-3" title="Время в текущем статусе (по updated_at)">В статусе</th>
              <th scope="col" aria-sort={sortBy === "total" ? "descending" : "none"} className="text-right p-3">Сумма</th>
              <th scope="col" className="text-right p-3">Оплачено</th>
              <th scope="col" className="text-right p-3">Долг</th>
              <th scope="col" className="p-3"><span className="sr-only">Действия</span></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && Array.from({ length: 6 }).map((_, i) => (
              <tr key={`sk-${i}`} className="border-t border-border/40">
                {Array.from({ length: 11 }).map((__, j) => (
                  <td key={j} className="p-3"><Skeleton className="h-4 w-full" /></td>
                ))}
              </tr>
            ))}
            {!isLoading && sorted.length === 0 && (
              <tr><td colSpan={11} className="p-10 text-center">
                <div className="text-muted-foreground mb-3">
                  {q || status ? "По текущему фильтру ничего не найдено" : "Заказов пока нет"}
                </div>
                {(q || status) ? (
                  <Button variant="outline" size="sm" onClick={() => { setQ(""); setStatus(""); }}>Сбросить фильтры</Button>
                ) : (
                  <Button size="sm" className="btn-primary-gradient" onClick={() => toast.info("Заказы создаются автоматически через форму на сайте")}>
                    <Plus className="h-4 w-4 mr-1" />Откуда берутся заказы?
                  </Button>
                )}
              </td></tr>
            )}
            {showVirtual && paddingTop > 0 && (
              <tr aria-hidden="true"><td colSpan={11} style={{ height: paddingTop, padding: 0, border: 0 }} /></tr>
            )}
            {showVirtual && items.map((vi) => {
              const o = sorted[vi.index];
              const debt = Number(o.total ?? 0) - Number(o.paid ?? 0);
              const age = ageInfo(o.updated_at ?? o.created_at, o.status);
              const canConfirm = (o.status as string) === "new" || (o.status as string) === "pending";
              return (
                <tr
                  key={o.id}
                  data-index={vi.index}
                  ref={virtualizer.measureElement}
                  onClick={() => setOpenId(o.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpenId(o.id); }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`Заказ ${o.client_name}, ${fmtDate(o.created_at)}`}
                  className="border-t border-border/40 hover:bg-muted/20 cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                >
                  <td className="p-3 whitespace-nowrap text-muted-foreground">
                    <div>{fmtDate(o.created_at)}</div>
                    <div className="text-[10px]">{new Date(o.created_at).toLocaleTimeString("ru-BY", { hour: "2-digit", minute: "2-digit" })}</div>
                  </td>
                  <td className="p-3">
                    <div className="font-medium">{o.client_name}</div>
                    {o.client_company && <div className="text-xs text-muted-foreground">{o.client_company}</div>}
                  </td>
                  <td className="p-3 text-xs">
                    <span className="hover:text-primary">{o.client_phone}</span>
                    <br /><a href={`mailto:${o.client_email}`} className="text-muted-foreground hover:text-primary">{o.client_email}</a>
                  </td>
                  <td className="p-3 whitespace-nowrap text-muted-foreground">{fmtDate(o.event_date)}</td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {o.source ?? "—"}
                    {o.utm_source && <div className="text-[10px]">{o.utm_source}{o.utm_campaign ? ` / ${o.utm_campaign}` : ""}</div>}
                  </td>
                  <td className="p-3" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
                    <select
                      value={o.status}
                      disabled={updateStatus.isPending}
                      onChange={(e) => updateStatus.mutate({ id: o.id, newStatus: e.target.value as OrderStatus })}
                      className={`px-2 py-1 rounded-full text-xs border bg-transparent outline-none cursor-pointer ${STATUS_COLOR[o.status] ?? "border-primary/30"}`}
                    >
                      {orderStatusOptions(o.status).map((s) => (
                        <option key={s.value} value={s.value} className="bg-background text-foreground">{s.label}</option>
                      ))}

                    </select>
                  </td>
                  <td className={`p-3 whitespace-nowrap text-xs tabular-nums ${age.cls}`} title={`Обновлён: ${fmtDateTime(o.updated_at ?? o.created_at)}`}>
                    <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{age.label}</span>
                  </td>
                  <td className="p-3 text-right whitespace-nowrap font-medium">{fmtMoney(o.total)}</td>
                  <td className="p-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
                    <PaidCell
                      value={Number(o.paid ?? 0)}
                      total={Number(o.total ?? 0)}
                      disabled={updatePaid.isPending}
                      onSave={(v) => updatePaid.mutate({ id: o.id, newPaid: v, prevPaid: Number(o.paid ?? 0) })}
                    />
                  </td>
                  <td className={`p-3 text-right whitespace-nowrap ${debt > 0 ? "text-amber-300" : "text-muted-foreground"}`}>{fmtMoney(debt)}</td>
                  <td className="p-3 text-right" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
                    <div className="inline-flex items-center gap-2">
                      {canConfirm ? (
                        <button
                          type="button"
                          title="Подтвердить заказ"
                          disabled={confirmOrder.isPending}
                          onClick={() => confirmOrder.mutate(o.id)}
                          className="inline-flex items-center text-emerald-400 hover:text-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          title={o.client_email ? "Отправить письмо клиенту повторно" : "У клиента не указан email"}
                          disabled={resendEmail.isPending || !o.client_email}
                          onClick={() => resendEmail.mutate(o.id)}
                          className="inline-flex items-center text-primary hover:text-primary/80 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                        >
                          <Mail className="h-4 w-4" />
                        </button>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button
                            type="button"
                            aria-label={`Удалить заказ ${o.client_name}`}
                            className="inline-flex items-center text-muted-foreground hover:text-rose-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 rounded"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
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
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Удалить
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </td>
                </tr>
              );
            })}
            {showVirtual && paddingBottom > 0 && (
              <tr aria-hidden="true"><td colSpan={11} style={{ height: paddingBottom, padding: 0, border: 0 }} /></tr>
            )}
          </tbody>
          {!isLoading && sorted.length > 0 && (
            <tfoot className="sticky bottom-0 bg-background/95 backdrop-blur border-t border-border/60">
              <tr className="text-sm font-medium">
                <td colSpan={7} className="p-3 text-right text-muted-foreground">
                  Итого по фильтру ({sorted.length}):
                </td>
                <td className="p-3 text-right whitespace-nowrap">{fmtMoney(totals.total)}</td>
                <td className="p-3 text-right whitespace-nowrap text-emerald-300">{fmtMoney(totals.paid)}</td>
                <td className={`p-3 text-right whitespace-nowrap ${totals.debt > 0 ? "text-amber-300" : "text-muted-foreground"}`}>{fmtMoney(totals.debt)}</td>
                <td className="p-3" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

