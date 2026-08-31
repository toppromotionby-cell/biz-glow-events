import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { listTestimonials } from "@/lib/testimonials.functions";
import { TestimonialCard } from "@/components/TestimonialCard";

const q = queryOptions({
  queryKey: ["testimonials", "all"],
  queryFn: () => listTestimonials({ data: {} }),
});

export const Route = createFileRoute("/testimonials")({
  loader: ({ context }) => context.queryClient.ensureQueryData(q),
  head: () => ({
    meta: [
      { title: "Отзывы клиентов — event-hub.by" },
      { name: "description", content: "Отзывы наших клиентов о проведённых мероприятиях: корпоративы, конференции, презентации в Минске." },
      { property: "og:title", content: "Отзывы клиентов event-hub.by" },
      { property: "og:description", content: "Что говорят клиенты о работе нашей команды." },
    ],
  }),
  component: Page,
});

function Page() {
  const { data } = useSuspenseQuery(q);
  const avg = data.length ? (data.reduce((s, t) => s + t.rating, 0) / data.length).toFixed(1) : "—";
  return (
    <div className="page-shell py-12 max-w-6xl">
      <header className="mb-10">
        <h1 className="text-4xl md:text-5xl font-display font-bold gradient-text">Отзывы клиентов</h1>
        <p className="mt-3 text-muted-foreground max-w-2xl">
          Средняя оценка <span className="text-foreground font-semibold">{avg}/5</span> · {data.length} отзывов
        </p>
      </header>
      {data.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center text-muted-foreground">Скоро здесь появятся отзывы.</div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {data.map(t => <TestimonialCard key={t.id} t={t} />)}
        </div>
      )}
    </div>
  );
}
