// Человекочитаемый таймлайн заказа: иконка + лейбл + расшифровка payload.
import {
  ArrowRight, Mail, MailX, Paperclip, Pencil, PlusCircle, CheckCircle2,
  Trash2, CreditCard, AlertCircle, Activity,
} from "lucide-react";
import { fmtDateTimeShort } from "@/lib/formatters";
import { ORDER_STATUS_LABEL } from "@/lib/order-status";
import type { OrderTimelineRow } from "./types";

type Json = OrderTimelineRow["payload"];

interface Resolved {
  Icon: typeof Activity;
  label: string;
  detail?: string;
  tone?: string;
}

function resolve(t: OrderTimelineRow): Resolved {
  const ev = t.event ?? "";
  const p = (t.payload && typeof t.payload === "object" && !Array.isArray(t.payload)
    ? t.payload
    : {}) as Record<string, unknown>;

  if (ev.startsWith("status_changed")) {
    const from = String(p.from ?? "");
    const to = String(p.to ?? ev.split(":")[1] ?? "");
    return {
      Icon: ArrowRight,
      label: "Статус изменён",
      detail: `${ORDER_STATUS_LABEL[from] ?? from || "—"} → ${ORDER_STATUS_LABEL[to] ?? to}`,
      tone: "text-violet-300",
    };
  }
  if (ev === "paid_changed") {
    return {
      Icon: CreditCard,
      label: "Оплата изменена",
      detail: `${Number(p.from ?? 0)} → ${Number(p.to ?? 0)} BYN`,
      tone: "text-emerald-300",
    };
  }
  if (ev === "order_created") {
    return { Icon: PlusCircle, label: "Заказ создан", tone: "text-blue-300",
      detail: p.items ? `${p.items} поз. · ${p.total ?? 0} BYN` : undefined };
  }
  if (ev === "order_confirmed_by_admin") {
    return { Icon: CheckCircle2, label: "Подтверждён администратором", tone: "text-emerald-300" };
  }
  if (ev === "confirmation_email_sent") {
    return { Icon: Mail, label: "Письмо отправлено", tone: "text-emerald-300",
      detail: p.recipient ? String(p.recipient) : undefined };
  }
  if (ev === "confirmation_email_failed") {
    return { Icon: MailX, label: "Письмо не доставлено", tone: "text-rose-300",
      detail: p.error ? String(p.error) : undefined };
  }
  if (ev === "order_edited_by_client") {
    return { Icon: Pencil, label: "Клиент изменил заявку", tone: "text-amber-300" };
  }
  if (ev === "attachment_added") {
    return { Icon: Paperclip, label: "Файл прикреплён",
      detail: p.file_name ? String(p.file_name) : undefined };
  }
  if (ev === "attachment_removed") {
    return { Icon: Trash2, label: "Файл удалён",
      detail: p.file_name ? String(p.file_name) : undefined, tone: "text-rose-300" };
  }
  return { Icon: Activity, label: ev || "Событие",
    detail: summarisePayload(t.payload), tone: "text-muted-foreground" };
}

function summarisePayload(payload: Json): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const keys = Object.keys(payload as object);
  if (keys.length === 0) return undefined;
  const short = JSON.stringify(payload);
  return short.length > 80 ? short.slice(0, 77) + "…" : short;
}

export function OrderTimelineList({ timeline }: { timeline: OrderTimelineRow[] }) {
  if (timeline.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <AlertCircle className="h-4 w-4" />Событий пока нет
      </div>
    );
  }
  return (
    <ol className="relative space-y-3 pl-5 before:absolute before:left-2 before:top-1 before:bottom-1 before:w-px before:bg-border/40">
      {timeline.map((t) => {
        const r = resolve(t);
        const Icon = r.Icon;
        return (
          <li key={t.id} className="relative text-sm">
            <span className={`absolute -left-5 top-0.5 grid h-4 w-4 place-items-center rounded-full bg-card border border-border/60 ${r.tone ?? "text-foreground"}`}>
              <Icon className="h-2.5 w-2.5" />
            </span>
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-medium">{r.label}</span>
              {r.detail && <span className="text-muted-foreground text-xs">{r.detail}</span>}
              <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
                {fmtDateTimeShort(t.created_at)}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
