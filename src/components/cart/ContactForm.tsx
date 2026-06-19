import type { FormEvent, RefObject } from "react";
import { DateField } from "@/components/DateField";
import { fmtCurrency } from "@/lib/formatters";

export type ClientType = "individual" | "company";

function Field({
  label,
  name,
  type = "text",
  required,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="text-muted-foreground">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        className="mt-1 w-full rounded-md bg-background/50 border border-border px-3 py-2 outline-none focus:border-primary"
      />
    </label>
  );
}

export function ContactForm({
  formRef,
  loading,
  clientType,
  onClientTypeChange,
  draft,
  finalTotal,
  onSubmit,
}: {
  formRef: RefObject<HTMLFormElement | null>;
  loading: boolean;
  clientType: ClientType;
  onClientTypeChange: (t: ClientType) => void;
  draft: Record<string, string>;
  finalTotal: number;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <aside className="lg:col-span-2">
      <form ref={formRef} onSubmit={onSubmit} className="glass rounded-xl p-5 space-y-3">
        <h2 className="font-display font-semibold">Контактные данные</h2>
        <div className="flex gap-2 p-1 rounded-md bg-background/40 border border-border">
          {(["individual", "company"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onClientTypeChange(t)}
              className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition ${
                clientType === t
                  ? "bg-gradient-primary text-primary-foreground glow-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "individual" ? "Физлицо" : "Юрлицо / ИП"}
            </button>
          ))}
        </div>
        <Field label="Имя *" name="client_name" required defaultValue={draft.client_name} />
        <Field label="Телефон *" name="client_phone" type="tel" required defaultValue={draft.client_phone} />
        <Field label="Email *" name="client_email" type="email" required defaultValue={draft.client_email} />
        {clientType === "company" && (
          <Field label="Компания *" name="client_company" required defaultValue={draft.client_company} />
        )}
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
            rows={3}
            defaultValue={draft.notes ?? ""}
            className="mt-1 w-full rounded-md bg-background/50 border border-border px-3 py-2"
          />
        </label>
        <label className="flex items-start gap-2 text-xs text-muted-foreground">
          <input type="checkbox" name="consent_pd" required className="mt-0.5" />
          <span>Согласен на обработку персональных данных.</span>
        </label>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-gradient-primary px-5 py-2.5 text-sm font-medium text-primary-foreground glow-primary disabled:opacity-60"
        >
          {loading
            ? "Отправляем..."
            : clientType === "company"
            ? `Далее: реквизиты • ${fmtCurrency(finalTotal)}`
            : `Отправить заказ • ${fmtCurrency(finalTotal)}`}
        </button>
        {clientType === "individual" && (
          <p className="text-[11px] text-muted-foreground text-center">
            Реквизиты компании при необходимости запросит менеджер.
          </p>
        )}
      </form>
    </aside>
  );
}
