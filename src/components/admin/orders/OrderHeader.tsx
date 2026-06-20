// Липкий хедер модалки заказа: id, статус, возраст в статусе, ссылка на полную страницу
// и контекстное меню действий. Все мутации поднимаются через onAction.
import { Link } from "@tanstack/react-router";
import { ExternalLink, MoreHorizontal, CheckCircle2, MailCheck, Trash2, Clock } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ORDER_STATUS_LABEL, ORDER_STATUS_COLOR } from "@/lib/order-status";
import { ageInfo } from "./order-age";
import type { OrderRow, OrderStatus } from "./types";

export interface OrderHeaderProps {
  order: OrderRow;
  onStatusChange: (s: OrderStatus) => void;
  onConfirm: () => void;
  onResendEmail: () => void;
  onDelete: () => void;
  busy?: boolean;
}

export function OrderHeader({ order, onStatusChange, onConfirm, onResendEmail, onDelete, busy }: OrderHeaderProps) {
  const age = ageInfo(order.updated_at, order.status);
  const statusCls = ORDER_STATUS_COLOR[order.status] ?? "border-border";
  return (
    <div className="sticky top-0 z-20 -mx-6 -mt-6 px-6 pt-5 pb-4 bg-card/85 backdrop-blur border-b border-border/60">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="font-mono text-base sm:text-lg">
          Заказ <span className="text-muted-foreground">#</span>{order.id.slice(0, 8)}
        </span>

        <Select value={order.status} onValueChange={(v) => onStatusChange(v as OrderStatus)} disabled={busy}>
          <SelectTrigger
            className={`h-8 w-auto min-w-[140px] rounded-full px-3 py-1 text-xs font-medium border ${statusCls}`}
            aria-label="Изменить статус"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(ORDER_STATUS_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className={`inline-flex items-center gap-1 text-xs ${age.cls}`} title="Возраст в текущем статусе">
          <Clock className="h-3 w-3" />{age.label}
        </span>

        <div className="ml-auto flex items-center gap-2">
          <Link
            to="/admin/orders/$id" params={{ id: order.id }}
            className="text-xs inline-flex items-center gap-1 text-muted-foreground hover:text-primary"
          >
            <ExternalLink className="h-3 w-3" /><span className="hidden sm:inline">Полная страница</span>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Действия">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={onConfirm} disabled={busy || order.status === "cancelled"}>
                <CheckCircle2 className="h-4 w-4 mr-2" />Подтвердить + письмо
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onResendEmail} disabled={busy || !order.client_email}>
                <MailCheck className="h-4 w-4 mr-2" />Отправить письмо повторно
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />Удалить заказ
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
