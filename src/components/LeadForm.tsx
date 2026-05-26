import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { submitLead } from "@/lib/leads.functions";
import { readUtm } from "@/lib/utm";
import { DateField } from "@/components/DateField";
import { trackLead } from "@/lib/analytics";
import { useAuth } from "@/hooks/use-auth";
import { ensureAuthOrPrompt } from "@/hooks/use-require-auth";

const SUBJECT_KEY = "lead_subject_v1";

export function LeadForm({ source = "contacts" }: { source?: string }) {
  const submit = useServerFn(submitLead);
  const { isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [subjectPrefill, setSubjectPrefill] = useState<string>("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SUBJECT_KEY);
      if (raw) {
        setSubjectPrefill(`Интересует: ${raw}`);
        localStorage.removeItem(SUBJECT_KEY);
      }
    } catch {}
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!ensureAuthOrPrompt(isAuthenticated, "Войдите, чтобы отправить заявку.")) return;
    const fd = new FormData(e.currentTarget);
    const utm = readUtm() ?? {};
    setLoading(true);
    try {
      await submit({
        data: {
          client_name: String(fd.get("client_name") ?? "").trim(),
          client_phone: String(fd.get("client_phone") ?? "").trim(),
          client_email: String(fd.get("client_email") ?? "").trim(),
          client_company: String(fd.get("client_company") ?? "").trim() || null,
          notes: String(fd.get("notes") ?? "").trim() || null,
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
      setDone(true);
      trackLead(source);
      toast.success("Заявка отправлена. Мы свяжемся с вами.");
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка отправки");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="glass rounded-xl p-6 text-sm">
        Спасибо! Менеджер свяжется в течение рабочего дня.
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="glass rounded-xl p-6 space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Имя *" name="client_name" required />
        <Field label="Телефон *" name="client_phone" required type="tel" />
        <Field label="Email *" name="client_email" required type="email" />
        <Field label="Компания" name="client_company" />
        <DateField label="Дата мероприятия" name="event_date" endName="event_end_date" minDate={new Date(new Date().setHours(0, 0, 0, 0))} />
      </div>
      <label className="block text-sm">
        <span className="text-muted-foreground">Сообщение</span>
        <textarea name="notes" rows={4} defaultValue={subjectPrefill} className="mt-1 w-full rounded-md bg-background/50 border border-border px-3 py-2" />
      </label>
      <label className="flex items-start gap-2 text-xs text-muted-foreground">
        <input type="checkbox" name="consent_pd" required className="mt-0.5" />
        <span>Согласен на обработку персональных данных согласно политике конфиденциальности.</span>
      </label>
      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-gradient-primary px-5 py-2.5 text-sm font-medium text-primary-foreground glow-primary disabled:opacity-60"
      >
        {loading ? "Отправляем..." : "Отправить заявку"}
      </button>
    </form>
  );
}

function Field({ label, name, type = "text", required }: { label: string; name: string; type?: string; required?: boolean }) {
  return (
    <label className="block text-sm">
      <span className="text-muted-foreground">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        className="mt-1 w-full rounded-md bg-background/50 border border-border px-3 py-2 outline-none focus:border-primary"
      />
    </label>
  );
}
