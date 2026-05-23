import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Star, Users } from "lucide-react";

export function CatalogSocialProof() {
  const { data } = useQuery({
    queryKey: ["catalog-social-proof"],
    queryFn: async () => {
      const { data: ts } = await supabase
        .from("testimonials")
        .select("rating")
        .eq("published", true);
      const { count: cases } = await supabase
        .from("cases")
        .select("id", { count: "exact", head: true })
        .eq("published", true);
      const ratings = (ts ?? []).map((t) => Number(t.rating) || 0).filter((n) => n > 0);
      const avg = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
      return { avg, reviews: ratings.length, cases: cases ?? 0 };
    },
    staleTime: 5 * 60_000,
  });

  if (!data || (data.reviews === 0 && data.cases === 0)) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground border-t border-border/40 pt-3">
      {data.reviews > 0 && (
        <span className="inline-flex items-center gap-1">
          <Star className="h-3.5 w-3.5 fill-accent text-accent" />
          <strong className="text-foreground">{data.avg.toFixed(1)}</strong>
          <span>· {data.reviews} {pluralize(data.reviews, ["отзыв", "отзыва", "отзывов"])}</span>
        </span>
      )}
      {data.cases > 0 && (
        <span className="inline-flex items-center gap-1">
          <Users className="h-3.5 w-3.5 text-primary" />
          <strong className="text-foreground">{data.cases}+</strong>
          <span>{pluralize(data.cases, ["реализованный проект", "реализованных проекта", "реализованных проектов"])}</span>
        </span>
      )}
    </div>
  );
}

function pluralize(n: number, forms: [string, string, string]) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return forms[0];
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return forms[1];
  return forms[2];
}
