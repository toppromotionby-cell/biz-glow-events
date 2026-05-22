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

export const listItemAvailability = createServerFn({ method: "GET" })
  .inputValidator((i) =>
    z.object({
      entity_type: z.enum(["zones", "tech_equipment", "services", "production_items"]),
      item_id: z.string().uuid(),
      from: z.string().optional(),
      to: z.string().optional(),
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
    if (error) throw new Error(error.message);
    return (rows ?? []) as AvailabilityRow[];
  });
