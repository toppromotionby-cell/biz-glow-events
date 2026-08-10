// Инлайн-форма запроса КП внутри модалки «Подробнее».
// Не требует регистрации: отправляет заявку тем же серверным обработчиком,
// что и форма на странице «Контакты».
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, CheckCircle2 } from "lucide-react";
import { submitLead } from "@/lib/leads.functions";
import { readUtm } from "@/lib/utm";
import { trackLead } from "@/lib/analytics";
import { DateField } from "@/components/DateField";

type Errors = Record<string, string>;

function validate(name: string, value: string): string | null {
  const v = value.trim();
  switch (name) {
    case "client_name":
      return v.length < 2 ? "Укажите имя (минимум 2 символа)" : null;
    case "client_phone":
      return v.length < 5 ? "Укажите телефон" : null;
    case "client_email":
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : "Укажите корректный email";
    default:
      return null;
  }
}

function Field({
  label,
  name,
  type = "text",
  error,
  onBlurValidate,
}: {
  label: string;
  name: string;
  type?: string;
  error?: string;
  onBlurValidate: (name: string, value: string) => void;
}) {
  const errorId = `qq-${name}-error`;
  return (
    <label className="block text-sm">
      <span className="text-muted-foreground">{label}</span>
      <input
        name={name}
        type={type}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onBlur={(e) => onBlurValidate(name, e.currentTarget.value)}
        onInput={(e) => { if (error) onBlurValidate(name, e.currentTarget.value); }}
        className={`mt-1 w-full rounded-md bg-background/50 border px-3 py-2 text-sm outline-none transition ${
          error ? "border-destructive focus:border-destructive" : "border-border focus:border-primary"
        }`}
      />
      {error && (
        <span id={errorId} role="alert" className="mt-1 block text-xs text-destructive">{error}</span>
      )}
    </label>
  );
}

export function QuickQuoteRequest({
  subject,
  source,
  details = [],
  itemUrl,
  defaultNotes,
  onDone,
}: {
  subject: string;
  source: string;
  /** Ключевые данные позиции: цена/пакет, требования, медиа — уходят в заявку. */
  details?: { label: string; value: string }[];
  /** Ссылка на карточку позиции — менеджер сразу видит, о чём речь. */
  itemUrl?: string;
  /** Предзаполненный комментарий. */
  defaultNotes?: string;
  onDone?: () => void;
}) {
  const submit = useServerFn(submitLead);
  const formRef = useRef<HTMLFormElement | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);


  function handleBlurValidate(name: string, value: string) {
    const msg = validate(name, value);
    setErrors((prev) => {
      const next = { ...prev };
      if (msg) next[name] = msg;
      else delete next[name];
      return next;
    });
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);

    const nextErrors: Errors = {};
    for (const field of ["client_name", "client_phone", "client_email"]) {
      const msg = validate(field, String(fd.get(field) ?? ""));
      if (msg) nextErrors[field] = msg;
    }
    setErrors(nextErrors);
    const first = Object.keys(nextErrors)[0];
    if (first) {
      toast.error(nextErrors[first]);
      const el = form.querySelector<HTMLInputElement>(`[name="${first}"]`);
      el?.focus();
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (!fd.get("consent_pd")) {
      toast.error("Подтвердите согласие на обработку персональных данных");
      return;
    }

    const utm = readUtm() ?? {};
    const comment = String(fd.get("notes") ?? "").trim();
    setLoading(true);
    try {
      await submit({
        data: {
          client_name: String(fd.get("client_name") ?? "").trim(),
          client_phone: String(fd.get("client_phone") ?? "").trim(),
          client_email: String(fd.get("client_email") ?? "").trim(),
          client_company: String(fd.get("client_company") ?? "").trim() || null,
          notes: [
            `Запрос КП: ${subject}`,
            details.length ? details.map((d) => `${d.label}: ${d.value}`).join("\n") : "",
            itemUrl ? `Позиция: ${itemUrl}` : "",
            comment,
          ].filter(Boolean).join("\n\n"),
          event_date: String(fd.get("event_date") ?? "") || null,
          event_end_date: String(fd.get("event_end_date") ?? "") || null,
          source,
          utm_source: utm.utm_source ?? null,
          utm_medium: utm.utm_medium ?? null,
          utm_campaign: utm.utm_campaign ?? null,
          utm_term: utm.utm_term ?? null,
          utm_content: utm.utm_content ?? null,
          consent_pd: true,
        },
      });
      trackLead("quickview");
      setDone(true);
      toast.success("Запрос отправлен — подготовим КП и свяжемся с вами.");
      onDone?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка отправки");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="glass rounded-xl p-4 text-sm space-y-1.5">
        <div className="flex items-center gap-2 font-medium">
          <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
          Запрос отправлен
        </div>
        <p className="text-muted-foreground text-xs">
          Менеджер подготовит коммерческое предложение по позиции «{subject}» и свяжется с вами в течение рабочего дня.
        </p>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="glass rounded-xl p-4 space-y-3">
      <div>
        <h3 className="text-sm font-semibold">Запросить КП</h3>
        <p className="text-xs text-muted-foreground">
          Без регистрации. Предмет запроса: <span className="text-foreground">{subject}</span>
        </p>
      </div>
      {details.length > 0 && (
        <div className="rounded-lg border border-border/60 bg-background/40 p-3">
          <div className="text-xs font-medium mb-1.5">Данные позиции подставлены автоматически</div>
          <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-2 text-xs">
            {details.map((d) => (
              <div key={d.label} className="flex justify-between gap-2">
                <dt className="text-muted-foreground">{d.label}</dt>
                <dd className="text-right text-foreground">{d.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Имя *" name="client_name" error={errors.client_name} onBlurValidate={handleBlurValidate} />
        <Field label="Телефон *" name="client_phone" type="tel" error={errors.client_phone} onBlurValidate={handleBlurValidate} />
        <Field label="Email *" name="client_email" type="email" error={errors.client_email} onBlurValidate={handleBlurValidate} />
        <Field label="Компания" name="client_company" onBlurValidate={handleBlurValidate} />
      </div>
      <DateField
        label="Дата мероприятия"
        name="event_date"
        endName="event_end_date"
        minDate={new Date(new Date().setHours(0, 0, 0, 0))}
      />
      <label className="block text-sm">
        <span className="text-muted-foreground">Комментарий</span>
        <textarea
          name="notes"
          rows={2}
          defaultValue={defaultNotes ?? ""}
          className="mt-1 w-full rounded-md bg-background/50 border border-border px-3 py-2 text-sm"
          placeholder="Площадка, количество гостей, пожелания"
        />
      </label>
      <label className="flex items-start gap-2 text-xs text-muted-foreground">
        <input type="checkbox" name="consent_pd" className="mt-0.5" />
        <span>Согласен на обработку персональных данных.</span>
      </label>
      <button
        type="submit"
        disabled={loading}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-gradient-primary px-5 py-2.5 text-sm font-medium text-primary-foreground glow-primary disabled:opacity-60"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {loading ? "Отправляем..." : "Отправить запрос КП"}
      </button>
    </form>
  );
}
