// Public reads for testimonials.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type TestimonialRow = {
  id: string;
  client_name: string;
  client_company: string | null;
  client_role: string | null;
  client_photo_url: string | null;
  rating: number;
  text: string;
  event_date: string | null;
  case_id: string | null;
  featured: boolean;
  sort_order: number;
};

const SELECT = "id,client_name,client_company,client_role,client_photo_url,rating,text,event_date,case_id,featured,sort_order";

export const listTestimonials = createServerFn({ method: "GET" })
  .inputValidator((i) =>
    z.object({
      featuredOnly: z.boolean().optional(),
      limit: z.number().int().min(1).max(50).optional(),
    }).parse(i ?? {})
  )
  .handler(async ({ data }) => {
    let q = supabaseAdmin
      .from("testimonials")
      .select(SELECT)
      .eq("published", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (data.featuredOnly) q = q.eq("featured", true);
    if (data.limit) q = q.limit(data.limit);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as TestimonialRow[];
  });
