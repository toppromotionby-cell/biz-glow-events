import { Link } from "@tanstack/react-router";
import { ChevronDown, ChevronUp, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fmtCurrency, fmtDate, fmtDateTimeShort } from "@/lib/formatters";
import { displayOrderNumber } from "@/lib/order-number";
import { STATUS_LABEL, STATUS_TONE, TIMELINE_EVENT_LABEL } from "./constants";
import type { OrderDetails, OrderRow } from "./types";

export function OrderHistoryList({
  orders,
  expanded,
  details,
  onToggle,
}: {
  orders: OrderRow[];
  expanded: string | null;
  details: Record<string, OrderDetails>;
  onToggle: (id: string) => void;
}) {
  if (orders.length === 0) {
    return (
      <div>
        <h2 className="text-xl font-display font-semibold mb-4">История заявок</h2>
        <div className="glass rounded-xl p-10 text-center">
          <Package className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-muted-foreground mb-4">У вас пока нет заявок</p>
          <Button asChild><Link to="/equipment">Перейти в каталог</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-display font-semibold mb-4">История заявок</h2>
      <div className="space-y-2">
        {orders.map((o) => {
          const isOpen = expanded === o.id;
          const d = details[o.id];
          return (
            <div key={o.id} className="glass rounded-xl overflow-hidden">
              <button
                onClick={() => onToggle(o.id)}
                className="w-full p-4 flex items-center justify-between gap-4 text-left hover:bg-foreground/5 transition"
              >
                <div className="min-w-0">
                  <div className="font-medium">Заявка #{o.id.slice(0, 8)}</div>
                  <div className="text-xs text-muted-foreground">
                    {fmtDate(o.created_at)}
                    {o.event_date && ` · мероприятие ${fmtDate(o.event_date)}`}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {Number(o.total ?? 0) > 0 && <div className="text-sm tabular-nums">{fmtCurrency(o.total)}</div>}
                  <div className={`text-xs px-3 py-1 rounded-full border ${STATUS_TONE[o.status] ?? "border-border"}`}>
                    {STATUS_LABEL[o.status] ?? o.status}
                  </div>
                  {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>
              </button>
              {isOpen && (
                <div className="border-t border-border/50 p-4 space-y-4 bg-background/30">
                  {!d ? (
                    <div className="text-sm text-muted-foreground">Загрузка...</div>
                  ) : (
                    <>
                      <div>
                        <h4 className="text-sm font-semibold mb-2">Позиции ({d.items.length})</h4>
                        {d.items.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Без позиций</p>
                        ) : (
                          <ul className="text-sm divide-y divide-border/40">
                            {d.items.map((it) => (
                              <li key={it.id} className="py-2 flex justify-between gap-3">
                                <span className="truncate">{it.title} <span className="text-muted-foreground">× {it.qty}</span></span>
                                <span className="tabular-nums shrink-0">{fmtCurrency(Number(it.price) * Number(it.qty))}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      {d.timeline.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold mb-2">История</h4>
                          <ol className="text-xs space-y-1.5">
                            {d.timeline.map((t) => (
                              <li key={t.id} className="flex gap-3">
                                <span className="text-muted-foreground tabular-nums shrink-0">
                                  {fmtDateTimeShort(t.created_at)}
                                </span>
                                <span>{TIMELINE_EVENT_LABEL[t.event] ?? t.event}</span>
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}
                      {o.notes && (
                        <div>
                          <h4 className="text-sm font-semibold mb-1">Комментарий</h4>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{o.notes}</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
