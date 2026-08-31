// Гостевой кабинет заказа: открывается по ссылке-токену сразу после оформления
// и из письма. Регистрация и вход не нужны — токен уникален (uuid).
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileText, Package, Clock, CheckCircle2 } from "lucide-react";
import { getOrderByToken } from "@/lib/orders.functions";
import { ORDER_STATUS_LABEL, ORDER_STATUS_COLOR, formatOrderBYN } from "@/lib/order-status";
import { displayOrderNumber } from "@/lib/order-number";
import { CONTACT } from "@/lib/contacts";

export const Route = createFileRoute("/my/$token")({
  head: () => ({
    meta: [
      { title: "Мой заказ — event-hub.by" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: GuestOrderPage,
});

const EVENT_LABEL: Record<string, string> = {
  order_created: "Заявка создана",
  account_created: "Личный кабинет создан",
  account_linked: "Заказ привязан к кабинету",
  paid_changed: "Изменена оплата",
  order_edited_by_client: "Клиент изменил заявку",
};

function eventLabel(e: string): string {
  if (EVENT_LABEL[e]) return EVENT_LABEL[e];
  if (e.startsWith("status_changed:")) {
    const s = e.split(":")[1] ?? "";
    return `Статус: ${ORDER_STATUS_LABEL[s] ?? s}`;
  }
  return e;
}

function GuestOrderPage() {
  const { token } = Route.useParams();
  const fetchOrder = useServerFn(getOrderByToken);
  const { data, isLoading } = useQuery({
    queryKey: ["guest-order", token],
    queryFn: () => fetchOrder({ data: { token } }),
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="page-shell section-y max-w-3xl">
        <div className="h-40 rounded-2xl bg-muted/30 animate-pulse" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="page-shell section-y max-w-xl text-center">
        <h1 className="text-2xl font-display font-bold">Ссылка недействительна</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Заказ не найден. Проверьте ссылку из письма или свяжитесь с нами: {CONTACT.phoneDisplay}.
        </p>
        <Link to="/" className="mt-6 inline-flex rounded-md bg-gradient-primary px-5 py-2.5 text-sm font-medium text-primary-foreground glow-primary">
          На главную
        </Link>
      </div>
    );
  }

  const label = displayOrderNumber({ id: data.id, order_number: data.orderNumber });

  return (
    <div className="page-shell py-12 max-w-3xl space-y-5">
      <header className="glass-strong rounded-2xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs text-muted-foreground">Заказ</div>
            <h1 className="text-2xl font-display font-bold gradient-text">{label}</h1>
          </div>
          <span className={`rounded-full border px-3 py-1 text-xs ${ORDER_STATUS_COLOR[data.status] ?? "border-border"}`}>
            {ORDER_STATUS_LABEL[data.status] ?? data.status}
          </span>
        </div>
        <div className="mt-4 grid sm:grid-cols-3 gap-3 text-sm">
          <div className="glass rounded-xl p-3">
            <div className="text-xs text-muted-foreground">Сумма</div>
            <div className="font-medium">{formatOrderBYN(data.total)}</div>
          </div>
          <div className="glass rounded-xl p-3">
            <div className="text-xs text-muted-foreground">Оплачено</div>
            <div className="font-medium">{formatOrderBYN(data.paid)}</div>
          </div>
          <div className="glass rounded-xl p-3">
            <div className="text-xs text-muted-foreground">Дата мероприятия</div>
            <div className="font-medium">{data.eventDate ?? "уточняется"}</div>
          </div>
        </div>
      </header>

      <section className="glass rounded-2xl p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold mb-3">
          <Package className="h-4 w-4 text-primary" aria-hidden="true" /> Состав заказа
        </h2>
        <ul className="divide-y divide-border/40 text-sm">
          {data.items.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-3 py-2">
              <span>{i.title} <span className="text-muted-foreground">× {i.qty}</span></span>
              <span className="font-medium whitespace-nowrap">{formatOrderBYN(i.price * i.qty)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="glass rounded-2xl p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold mb-3">
          <FileText className="h-4 w-4 text-primary" aria-hidden="true" /> Документы
        </h2>
        {data.documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Документы появятся здесь, как только менеджер их подготовит.
          </p>
        ) : (
          <ul className="space-y-2 text-sm">
            {data.documents.map((d) => (
              <li key={d.id}>
                <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                  {d.name}
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="glass rounded-2xl p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold mb-3">
          <Clock className="h-4 w-4 text-primary" aria-hidden="true" /> История
        </h2>
        <ul className="space-y-2 text-sm">
          {data.timeline.map((t) => (
            <li key={t.id} className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-success shrink-0" aria-hidden="true" />
              <span>
                {eventLabel(t.event)}
                <span className="ml-2 text-xs text-muted-foreground">
                  {new Date(t.created_at).toLocaleString("ru-BY")}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-xs text-muted-foreground">
        Полная история заказов и повторный заказ — в личном кабинете:{" "}
        <Link to="/login" className="text-accent">войти по email {data.clientEmail}</Link>.
      </p>
    </div>
  );
}
