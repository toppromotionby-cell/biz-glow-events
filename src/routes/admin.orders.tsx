import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { downloadCsv, toCsv } from "@/lib/csv";
import { Download, Search, ExternalLink, Clock, Paperclip } from "lucide-react";
import { OrderAttachments } from "@/components/admin/OrderAttachments";
import { toast } from "sonner";

const STATUS_LABEL: Record<string, string> = {
  new: "Новый", consultation: "Консультация", estimate: "Смета", contract: "Договор",
  in_progress: "В работе", paid: "Оплачен", completed: "Завершён", cancelled: "Отменён",
};

const STATUS_COLOR: Record<string, string> = {
  new: "bg-blue-500/15 text-blue-300 border-blue-400/30",
  consultation: "bg-cyan-500/15 text-cyan-300 border-cyan-400/30",
  estimate: "bg-violet-500/15 text-violet-300 border-violet-400/30",
  contract: "bg-amber-500/15 text-amber-300 border-amber-400/30",
  in_progress: "bg-orange-500/15 text-orange-300 border-orange-400/30",
  paid: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30",
  completed: "bg-green-600/15 text-green-300 border-green-500/30",
  cancelled: "bg-red-500/15 text-red-300 border-red-400/30",
};

const fmtMoney = (v: any) => `${Number(v ?? 0).toLocaleString("ru-BY")} BYN`;
const fmtDate = (v: any) => (v ? new Date(v).toLocaleDateString("ru-BY") : "—");
const fmtDateTime = (v: any) => (v ? new Date(v).toLocaleString("ru-BY") : "—");

export const Route = createFileRoute("/admin/orders")({
  component: AdminOrders,
});

function AdminOrders() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("");
  const [sortBy, setSortBy] = useState<"created_at" | "total" | "event_date">("created_at");
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["admin-orders", q, status],
    queryFn: async () => {
      let query = supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(500);
      if (status) query = query.eq("status", status as any);
      if (q) query = query.or(`client_name.ilike.%${q}%,client_phone.ilike.%${q}%,client_email.ilike.%${q}%,client_company.ilike.%${q}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Realtime: обновляем список при любых изменениях в orders
  useEffect(() => {
    const ch = supabase
      .channel("admin-orders-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        qc.invalidateQueries({ queryKey: ["admin-orders"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const updateStatus = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: string }) => {
      const { error } = await supabase.from("orders").update({ status: newStatus as any }).eq("id", id);
      if (error) throw error;
      const { data: u } = await supabase.auth.getUser();
      await supabase.from("order_timeline").insert({
        order_id: id, event: `status_changed:${newStatus}`,
        actor_id: u.user?.id ?? null, payload: { status: newStatus },
      });
    },
    onSuccess: () => {
      toast.success("Статус обновлён");
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      qc.invalidateQueries({ queryKey: ["order-modal"] });
      qc.invalidateQueries({ queryKey: ["order-modal-timeline"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Не удалось изменить статус"),
  });

  const updatePaid = useMutation({
    mutationFn: async ({ id, newPaid, prevPaid }: { id: string; newPaid: number; prevPaid: number }) => {
      const { error } = await supabase.from("orders").update({ paid: newPaid }).eq("id", id);
      if (error) throw error;
      const { data: u } = await supabase.auth.getUser();
      await supabase.from("order_timeline").insert({
        order_id: id, event: "paid_changed",
        actor_id: u.user?.id ?? null, payload: { from: prevPaid, to: newPaid },
      });
    },
    onSuccess: () => {
      toast.success("Оплата обновлена");
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      qc.invalidateQueries({ queryKey: ["order-modal"] });
      qc.invalidateQueries({ queryKey: ["order-modal-timeline"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Не удалось обновить оплату"),
  });


  const sorted = useMemo(() => {
    const arr = [...orders];
    arr.sort((a: any, b: any) => {
      if (sortBy === "total") return Number(b.total ?? 0) - Number(a.total ?? 0);
      if (sortBy === "event_date") return (b.event_date ?? "").localeCompare(a.event_date ?? "");
      return (b.created_at ?? "").localeCompare(a.created_at ?? "");
    });
    return arr;
  }, [orders, sortBy]);

  const totals = useMemo(() => {
    const total = orders.reduce((s: number, o: any) => s + Number(o.total ?? 0), 0);
    const paid = orders.reduce((s: number, o: any) => s + Number(o.paid ?? 0), 0);
    return { total, paid, debt: total - paid };
  }, [orders]);

  const exportCsv = () => {
    const rows = orders.map((o: any) => ({
      id: o.id, created: o.created_at, status: STATUS_LABEL[o.status] ?? o.status,
      client: o.client_name, phone: o.client_phone, email: o.client_email,
      company: o.client_company ?? "", event_date: o.event_date ?? "",
      total: o.total, paid: o.paid, debt: Number(o.total ?? 0) - Number(o.paid ?? 0),
      source: o.source ?? "", utm_source: o.utm_source ?? "", utm_medium: o.utm_medium ?? "",
      utm_campaign: o.utm_campaign ?? "", utm_term: o.utm_term ?? "", utm_content: o.utm_content ?? "",
      notes: (o.notes ?? "").replace(/\s+/g, " "),
    }));
    downloadCsv(`orders-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows));
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-display font-bold gradient-text">Заказы (CRM)</h1>
          <p className="text-sm text-muted-foreground">{orders.length} записей · двойной клик по строке — подробности</p>
        </div>
        <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-2" />Экспорт CSV</Button>
      </header>

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
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="rounded-md border border-border bg-input px-3 text-sm">
          <option value="created_at">Сначала новые</option>
          <option value="event_date">По дате мероприятия</option>
          <option value="total">По сумме</option>
        </select>
      </div>

      <div className="glass rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-muted-foreground text-xs uppercase">
              <tr>
                <th className="text-left p-3">Создан</th>
                <th className="text-left p-3">Клиент / Компания</th>
                <th className="text-left p-3">Контакты</th>
                <th className="text-left p-3">Мероприятие</th>
                <th className="text-left p-3">Источник</th>
                <th className="text-left p-3">Статус</th>
                <th className="text-right p-3">Сумма</th>
                <th className="text-right p-3">Оплачено</th>
                <th className="text-right p-3">Долг</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">Загрузка...</td></tr>}
              {!isLoading && sorted.length === 0 && <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">Нет заказов</td></tr>}
              {sorted.map((o: any) => {
                const debt = Number(o.total ?? 0) - Number(o.paid ?? 0);
                return (
                  <tr
                    key={o.id}
                    onDoubleClick={() => setOpenId(o.id)}
                    className="border-t border-border/40 hover:bg-muted/20 cursor-pointer select-none"
                    title="Двойной клик — открыть карточку"
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
                      <a href={`tel:${o.client_phone}`} className="hover:text-primary">{o.client_phone}</a>
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
                        onChange={(e) => updateStatus.mutate({ id: o.id, newStatus: e.target.value })}
                        className={`px-2 py-1 rounded-full text-xs border bg-transparent outline-none cursor-pointer ${STATUS_COLOR[o.status] ?? "border-primary/30"}`}
                      >
                        {Object.entries(STATUS_LABEL).map(([k, v]) => (
                          <option key={k} value={k} className="bg-background text-foreground">{v}</option>
                        ))}
                      </select>
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
                    <td className="p-3 text-right">
                      <Link to="/admin/orders/$id" params={{ id: o.id }} className="inline-flex items-center text-muted-foreground hover:text-primary" onClick={(e) => e.stopPropagation()}>
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

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

function OrderDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const enabled = !!id;

  const { data: order } = useQuery({
    queryKey: ["order-modal", id],
    enabled,
    queryFn: async () => (await supabase.from("orders").select("*").eq("id", id!).single()).data,
  });
  const { data: items = [] } = useQuery({
    queryKey: ["order-modal-items", id],
    enabled,
    queryFn: async () => (await supabase.from("order_items").select("*").eq("order_id", id!)).data ?? [],
  });
  const { data: timeline = [] } = useQuery({
    queryKey: ["order-modal-timeline", id],
    enabled,
    queryFn: async () => (await supabase.from("order_timeline").select("*").eq("order_id", id!).order("created_at", { ascending: false })).data ?? [],
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
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
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
                <Row k="Телефон" v={<a href={`tel:${order.client_phone}`} className="hover:text-primary">{order.client_phone}</a>} />
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
                    {items.map((it: any) => (
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
              <OrderAttachments orderId={order.id} />
            </InfoCard>

            <InfoCard title={<span className="flex items-center gap-2"><Clock className="h-4 w-4" />Таймлайн ({timeline.length})</span>}>
              {timeline.length === 0 ? <p className="text-sm text-muted-foreground">Событий пока нет</p> : (
                <ol className="space-y-2">
                  {timeline.map((t: any) => (
                    <li key={t.id} className="text-sm flex gap-3">
                      <span className="text-xs text-muted-foreground whitespace-nowrap w-36">{fmtDateTime(t.created_at)}</span>
                      <span className="font-medium">{t.event}</span>
                      {t.payload && Object.keys(t.payload).length > 0 && <span className="text-xs text-muted-foreground">{JSON.stringify(t.payload)}</span>}
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

function PaidCell({ value, total, disabled, onSave }: { value: number; total: number; disabled?: boolean; onSave: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  useEffect(() => { setDraft(String(value)); }, [value]);

  const commit = () => {
    const n = Number(draft.replace(",", "."));
    setEditing(false);
    if (Number.isFinite(n) && n >= 0 && n !== value) onSave(n);
    else setDraft(String(value));
  };

  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        min={0}
        step="0.01"
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") { setDraft(String(value)); setEditing(false); }
        }}
        className="w-28 text-right px-2 py-1 rounded border border-primary/40 bg-input outline-none text-sm"
      />
    );
  }
  const full = value >= total && total > 0;
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title="Клик — изменить оплату"
      className={`px-2 py-0.5 rounded hover:bg-muted/40 cursor-text ${full ? "text-emerald-300" : "text-emerald-300/80"}`}
    >
      {`${Number(value ?? 0).toLocaleString("ru-BY")} BYN`}
    </button>
  );
}
