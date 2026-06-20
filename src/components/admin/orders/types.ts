// Типы для админки заказов: единый источник истины поверх Database.
import type { Database } from "@/integrations/supabase/types";

export type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
export type OrderStatus = Database["public"]["Enums"]["order_status"];
export type OrderItemRow = Database["public"]["Tables"]["order_items"]["Row"];
export type OrderTimelineRow = Database["public"]["Tables"]["order_timeline"]["Row"];

/** Набор колонок, которые тянет список заказов (узкий select). */
export type OrderListRow = Pick<
  OrderRow,
  | "id" | "order_number" | "created_at" | "updated_at" | "status"
  | "client_name" | "client_company" | "client_phone" | "client_email"
  | "event_date" | "source" | "utm_source" | "utm_campaign"
  | "total" | "paid"
>;
