// Inline быстрый запрос расчёта внутри карточки.
// Использует submitLead — тот же серверный путь, что и /contacts.
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Send, Check, Clock } from "lucide-react";
import { submitLead } from "@/lib/leads.functions";
import { readUtm } from "@/lib/utm";
import { trackLead } from "@/lib/analytics";
import { useAuth } from "@/hooks/use-auth";
import { ensureAuthOrPrompt } from "@/hooks/use-require-auth";

export function QuickQuoteForm({
  itemTitle,
  source = "quick_quote",
}: {
  itemTitle: string;
  source?: string;
}) {
  const submit = useServerFn(submitLead);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      toast.error("Укажите имя и телефон");
      return;
    }
    const utm = readUtm() ?? {};
    setLoading(true);
    try {
      await submit({
        data: {
          client_name: name.trim(),
          client_phone: phone.trim(),
          client_email: `quote+${Date.now()}@event-hub.by`,
          client_company: null,
          notes: `Быстрый расчёт по: «${itemTitle}»`,
          event_date: date || null,
          source,
          utm_source: utm.utm_source ?? null,
          utm_medium: utm.utm_medium ?? null,
          utm_campaign: utm.utm_campaign ?? null,
          utm_term: utm.utm_term ?? null,
          utm_content: utm.utm_content ?? null,
          consent_pd: true,
        },
      });
      trackLead(source);
      setDone(true);
      toast.success("Заявка отправлена! Перезвоним в течение 15 минут.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка отправки");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="glass rounded-2xl p-6 sm:p-8 max-w-3xl">
        <div className="flex items-start gap-3">
          <div className="shrink-0 h-10 w-10 rounded-full bg-success/15 text-success flex items-center justify-center">
            <Check className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold">Спасибо! Заявка принята.</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Менеджер перезвонит в течение 15 минут в рабочие часы и подготовит индивидуальный расчёт.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl p-6 sm:p-8 max-w-3xl border border-primary/20">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-primary">
        <Clock className="h-3.5 w-3.5" />
        <span>Ответ за 15 минут</span>
      </div>
      <h3 className="mt-2 font-display text-xl sm:text-2xl font-bold">
        Получите персональный расчёт
      </h3>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Оставьте контакт — подготовим точную смету по «{itemTitle}» и предложим лучшие условия.
      </p>
      <form onSubmit={onSubmit} className="mt-5 grid sm:grid-cols-3 gap-3">
        <label className="block">
          <span className="sr-only">Имя</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Имя *"
            required
            className="w-full rounded-md bg-background/50 border border-border px-3 h-11 outline-none focus:border-primary"
          />
        </label>
        <label className="block">
          <span className="sr-only">Телефон</span>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Телефон *"
            required
            className="w-full rounded-md bg-background/50 border border-border px-3 h-11 outline-none focus:border-primary"
          />
        </label>
        <label className="block">
          <span className="sr-only">Дата мероприятия</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            min={new Date().toISOString().slice(0, 10)}
            className="w-full rounded-md bg-background/50 border border-border px-3 h-11 outline-none focus:border-primary text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="sm:col-span-3 inline-flex items-center justify-center gap-2 rounded-md bg-gradient-primary h-12 px-5 text-base font-medium text-primary-foreground glow-primary disabled:opacity-60 transition"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {loading ? "Отправляем…" : "Получить расчёт"}
        </button>
      </form>
      <p className="mt-3 text-[11px] text-muted-foreground">
        Нажимая кнопку, вы соглашаетесь с обработкой персональных данных.
      </p>
    </div>
  );
}
