import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listTestimonials } from "@/lib/testimonials.functions";
import { TestimonialCard } from "./TestimonialCard";
import { ArrowRight } from "lucide-react";

export function TestimonialsTeaser() {
  const { data = [] } = useQuery({
    queryKey: ["testimonials", "featured", 3],
    queryFn: () => listTestimonials({ data: { featuredOnly: true, limit: 3 } }),
  });
  if (data.length === 0) return null;
  return (
    <section className="page-shell section-y max-w-6xl">
      <div className="flex items-end justify-between mb-8 gap-4">
        <div>
          <h2 className="text-3xl md:text-4xl font-display font-bold gradient-text">Отзывы клиентов</h2>
          <p className="text-muted-foreground mt-2">Что говорят о нашей работе</p>
        </div>
        <Link to="/testimonials" className="text-sm text-primary inline-flex items-center gap-1 hover:underline shrink-0">
          Все отзывы <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="grid md:grid-cols-3 gap-5">
        {data.map(t => <TestimonialCard key={t.id} t={t} />)}
      </div>
    </section>
  );
}
