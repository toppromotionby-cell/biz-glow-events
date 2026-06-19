import type { Database } from "@/integrations/supabase/types";

export type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
export type OrderItemRow = Database["public"]["Tables"]["order_items"]["Row"];
export type OrderTimelineRow = Database["public"]["Tables"]["order_timeline"]["Row"];
export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export type OrderDetails = {
  items: OrderItemRow[];
  timeline: OrderTimelineRow[];
};

export type EditOrderForm = {
  client_name: string;
  client_phone: string;
  client_email: string;
  client_company: string;
  event_date: string;
  notes: string;
};
