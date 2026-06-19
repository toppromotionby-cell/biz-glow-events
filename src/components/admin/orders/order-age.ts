// Возраст «в статусе» по updated_at: цвет — SLA-подсветка.
// Финальные статусы (paid/completed/cancelled) не подсвечиваем.
import type { OrderStatus } from "./types";

const FINAL_STATUSES: OrderStatus[] = ["paid", "completed", "cancelled"];

export interface OrderAgeInfo {
  label: string;
  cls: string;
}

export function ageInfo(updatedAt: string | null | undefined, status: OrderStatus | string): OrderAgeInfo {
  if (!updatedAt) return { label: "—", cls: "text-muted-foreground" };
  const ms = Date.now() - new Date(updatedAt).getTime();
  const h = Math.floor(ms / 3_600_000);
  const d = Math.floor(h / 24);
  const label = d >= 1 ? `${d} д` : `${Math.max(h, 0)} ч`;
  if (FINAL_STATUSES.includes(status as OrderStatus)) return { label, cls: "text-muted-foreground" };
  if (h >= 72) return { label, cls: "text-rose-400" };
  if (h >= 24) return { label, cls: "text-amber-300" };
  return { label, cls: "text-emerald-300" };
}
