// Таблица позиций заказа с зеброй, иконками типа и строкой итога.
import { MapPin, Wrench, Sparkles, Video, Package } from "lucide-react";
import { fmtMoney } from "@/lib/formatters";
import type { OrderItemRow } from "./types";

const ENTITY: Record<string, { label: string; Icon: typeof MapPin }> = {
  zone: { label: "Зона", Icon: MapPin },
  zones: { label: "Зона", Icon: MapPin },
  service: { label: "Услуга", Icon: Sparkles },
  services: { label: "Услуга", Icon: Sparkles },
  equipment: { label: "Оборудование", Icon: Wrench },
  tech_equipment: { label: "Оборудование", Icon: Wrench },
  production: { label: "Продакшн", Icon: Video },
  production_item: { label: "Продакшн", Icon: Video },
  extras: { label: "Доп.", Icon: Package },
};

export function OrderItemsTable({ items }: { items: OrderItemRow[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Позиций нет</p>;
  }
  const total = items.reduce((s, i) => s + Number(i.price ?? 0) * Number(i.qty ?? 1), 0);

  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-sm">
        <thead className="text-[11px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="text-left font-medium py-2 px-2">Название</th>
            <th className="text-left font-medium py-2 px-2 hidden sm:table-cell">Тип</th>
            <th className="text-right font-medium py-2 px-2 w-16">Кол-во</th>
            <th className="text-right font-medium py-2 px-2">Цена</th>
            <th className="text-right font-medium py-2 px-2">Итого</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => {
            const meta = ENTITY[it.entity_type ?? ""] ?? { label: it.entity_type ?? "—", Icon: Package };
            const Icon = meta.Icon;
            const lineTotal = Number(it.price ?? 0) * Number(it.qty ?? 1);
            return (
              <tr key={it.id} className={`border-t border-border/30 ${i % 2 === 1 ? "bg-muted/5" : ""}`}>
                <td className="py-2 px-2">
                  <div className="font-medium">{it.title}</div>
                  <div className="text-[11px] text-muted-foreground sm:hidden inline-flex items-center gap-1 mt-0.5">
                    <Icon className="h-3 w-3" />{meta.label}
                  </div>
                </td>
                <td className="py-2 px-2 text-muted-foreground hidden sm:table-cell">
                  <span className="inline-flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5" />{meta.label}
                  </span>
                </td>
                <td className="py-2 px-2 text-right tabular-nums">{it.qty}</td>
                <td className="py-2 px-2 text-right tabular-nums">{fmtMoney(it.price)}</td>
                <td className="py-2 px-2 text-right font-medium tabular-nums">{fmtMoney(lineTotal)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-border/60">
            <td colSpan={4} className="py-2.5 px-2 text-right text-xs uppercase tracking-wider text-muted-foreground">Итого</td>
            <td className="py-2.5 px-2 text-right font-semibold tabular-nums">{fmtMoney(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
