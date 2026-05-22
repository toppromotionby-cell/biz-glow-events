import { Star } from "lucide-react";
import type { TestimonialRow } from "@/lib/testimonials.functions";

export function TestimonialCard({ t }: { t: TestimonialRow }) {
  return (
    <article className="glass rounded-2xl p-6 h-full flex flex-col">
      <div className="flex gap-1 mb-3" aria-label={`${t.rating} из 5`}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} className={`h-4 w-4 ${i < t.rating ? "fill-primary text-primary" : "text-muted"}`} />
        ))}
      </div>
      <p className="text-foreground/90 leading-relaxed flex-1">«{t.text}»</p>
      <footer className="mt-5 flex items-center gap-3 pt-4 border-t border-border/40">
        {t.client_photo_url ? (
          <img src={t.client_photo_url} alt={t.client_name} className="h-11 w-11 rounded-full object-cover" loading="lazy" />
        ) : (
          <div className="h-11 w-11 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground font-semibold">
            {t.client_name.charAt(0)}
          </div>
        )}
        <div className="min-w-0">
          <div className="font-medium truncate">{t.client_name}</div>
          <div className="text-xs text-muted-foreground truncate">
            {[t.client_role, t.client_company].filter(Boolean).join(" · ")}
          </div>
        </div>
      </footer>
    </article>
  );
}
