// Проверка уникальности slug с debounce. Возвращает статус и сообщение.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Status = "idle" | "checking" | "ok" | "taken" | "error";

const ALLOWED = ["blog_posts", "cases", "zones", "tech_equipment", "services", "production_items", "attractions"] as const;
type AllowedTable = (typeof ALLOWED)[number];

export function useSlugUnique(table: AllowedTable, slug: string, currentId?: string, delayMs = 400) {
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    if (!slug || slug.length < 1) { setStatus("idle"); return; }
    setStatus("checking");
    const handle = setTimeout(async () => {
      try {
        let q = supabase.from(table).select("id").eq("slug", slug).limit(1);
        if (currentId) q = q.neq("id", currentId);
        const { data, error } = await q;
        if (error) { setStatus("error"); return; }
        setStatus(data && data.length > 0 ? "taken" : "ok");
      } catch {
        setStatus("error");
      }
    }, delayMs);
    return () => clearTimeout(handle);
  }, [table, slug, currentId, delayMs]);

  return status;
}
