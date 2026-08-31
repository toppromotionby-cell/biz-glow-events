// Публичная страница уточнения по запросу. Открывается клиентом по ссылке
// из письма-подтверждения (`/inquiry/<clarification_token>`). Токен — uuid,
// уникальный индекс есть в БД, ничего лишнего не отдаём.
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { getInquiryByToken, submitInquiryClarification } from "@/lib/leads.functions";

export const Route = createFileRoute("/inquiry/$token")({
  head: () => ({
    meta: [{ name: "robots", content: "noindex,nofollow" }],
  }),
  component: InquiryClarificationPage,
});

function InquiryClarificationPage() {
  const { token } = Route.useParams();
  const fetchInquiry = useServerFn(getInquiryByToken);
  const submit = useServerFn(submitInquiryClarification);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["inquiry", token],
    queryFn: () => fetchInquiry({ data: { token } }),
  });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    try {
      await submit({
        data: {
          token,
          event_format: String(fd.get("event_format") ?? "").trim() || null,
          guests_count: String(fd.get("guests_count") ?? "").trim() || null,
          budget: String(fd.get("budget") ?? "").trim() || null,
          venue: String(fd.get("venue") ?? "").trim() || null,
          extra: String(fd.get("extra") ?? "").trim() || null,
        },
      });
      setDone(true);
      toast.success("Спасибо! Мы получили ваши уточнения.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка отправки");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-shell section-y max-w-2xl">
      <h1 className="text-3xl font-display font-bold gradient-text">Уточните детали запроса</h1>
      <p className="mt-3 text-muted-foreground">
        Чем подробнее опишете задачу — тем точнее менеджер подготовит варианты. Все поля по желанию.
      </p>

      {isLoading ? (
        <div className="mt-8 glass rounded-xl p-6 text-sm text-muted-foreground">Загрузка…</div>
      ) : !data ? (
        <div className="mt-8 glass rounded-xl p-6 text-sm">
          Ссылка устарела или недействительна. Если у вас остались вопросы — напишите нам на <a href="mailto:hello@event-hub.by" className="text-primary underline">hello@event-hub.by</a>.
        </div>
      ) : done ? (
        <div className="mt-8 glass rounded-xl p-6 text-sm space-y-2">
          <div className="font-medium">Готово!</div>
          <div className="text-muted-foreground">Менеджер увидит ваши ответы и свяжется с вами с готовым предложением.</div>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-8 glass rounded-xl p-6 space-y-4">
          <div className="text-sm text-muted-foreground">
            Запрос на имя <b className="text-foreground">{data.clientName}</b>
            {data.eventDate ? <> · дата {data.eventDate}</> : null}
          </div>
          <Field name="event_format" label="Формат мероприятия" placeholder="Корпоратив, свадьба, конференция…" />
          <div className="grid sm:grid-cols-2 gap-4">
            <Field name="guests_count" label="Количество гостей" placeholder="Например, 80" />
            <Field name="budget" label="Ориентир по бюджету" placeholder="Например, до 5 000 BYN" />
          </div>
          <Field name="venue" label="Площадка / адрес" placeholder="Если уже выбрана" />
          <label className="block text-sm">
            <span className="text-muted-foreground">Что важно учесть</span>
            <textarea name="extra" rows={4} className="mt-1 w-full rounded-md bg-background/50 border border-border px-3 py-2" placeholder="Особые пожелания, тайминг, референсы, оборудование…" />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-gradient-primary px-5 py-2.5 text-sm font-medium text-primary-foreground glow-primary disabled:opacity-60"
          >
            {loading ? "Отправляем…" : "Отправить уточнения"}
          </button>
        </form>
      )}
    </div>
  );
}

function Field({ name, label, placeholder }: { name: string; label: string; placeholder?: string }) {
  return (
    <label className="block text-sm">
      <span className="text-muted-foreground">{label}</span>
      <input
        name={name}
        placeholder={placeholder}
        className="mt-1 w-full rounded-md bg-background/50 border border-border px-3 py-2 outline-none focus:border-primary"
      />
    </label>
  );
}
