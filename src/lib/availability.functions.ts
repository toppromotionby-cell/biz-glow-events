// Public availability reads for catalog items.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type AvailabilityRow = {
  id: string;
  entity_type: string;
  item_id: string;
  start_date: string;
  end_date: string;
  status: "available" | "booked" | "maintenance";
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const listItemAvailability = createServerFn({ method: "GET" })
  .inputValidator((i) =>
    z.object({
      entity_type: z.enum(["zones", "tech_equipment", "services", "production_items", "attractions"]),
      item_id: z.string().uuid(),
      from: z.string().regex(ISO_DATE).optional(),
      to: z.string().regex(ISO_DATE).optional(),
    }).parse(i)
  )
  .handler(async ({ data }) => {
    let q = supabaseAdmin
      .from("availability")
      .select("id,entity_type,item_id,start_date,end_date,status")
      .eq("entity_type", data.entity_type)
      .eq("item_id", data.item_id)
      .in("status", ["booked", "maintenance"]);
    if (data.from) q = q.gte("end_date", data.from);
    if (data.to) q = q.lte("start_date", data.to);
    const { data: rows, error } = await q;
    if (error) {
      console.error("[listItemAvailability] DB error:", error);
      throw new Error("Не удалось загрузить данные о доступности.");
    }
    return (rows ?? []) as AvailabilityRow[];
  });
