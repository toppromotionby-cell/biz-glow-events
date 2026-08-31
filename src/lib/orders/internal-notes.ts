// Внутренние заметки заказа хранятся в отдельной staff-only таблице
// public.order_internal_notes — клиент не видит их даже при чтении своего заказа.
import { supabase } from "@/integrations/supabase/client";

export const internalNotesKey = (orderId: string) => ["order-internal-notes", orderId] as const;

export async function fetchInternalNotes(orderId: string): Promise<string> {
  const { data, error } = await supabase
    .from("order_internal_notes")
    .select("notes")
    .eq("order_id", orderId)
    .maybeSingle();
  if (error) throw error;
  return data?.notes ?? "";
}

export async function saveInternalNotes(orderId: string, notes: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("order_internal_notes")
    .upsert({ order_id: orderId, notes, updated_by: auth?.user?.id ?? null }, { onConflict: "order_id" });
  if (error) throw error;
}
