import { createFileRoute, Link } from "@tanstack/react-router";
import { Truck, MapPin, Clock, CreditCard, Banknote, FileText, Building2, ArrowRight, Package } from "lucide-react";
import { Button } from "@/components/ui/button";

const ZONES = [
  { name: "Минск (в пределах МКАД)", price: "Включено", time: "1–3 ч до старта", note: "Бесплатно при заказе от 500 BYN" },
  { name: "Минский район", price: "от 40 BYN", time: "2–4 ч", note: "До 30 км от МКАД" },
  { name: "Областные центры РБ", price: "1,5 BYN/км", time: "обсуждается", note: "Брест, Гродно, Витебск, Гомель, Могилёв" },
  { name: "Другие города РБ", price: "1,5 BYN/км", time: "по согласованию", note: "В одну сторону, минимум 80 BYN" },
];

const PAYMENT = [
  { icon: Building2, title: "Безналичный расчёт", text: "Для юр. лиц и ИП. Счёт, договор, акт, ЭСЧФ. Работаем с НДС.", badge: "Основной" },
  { icon: CreditCard, title: "Банковская карта", text: "Visa, Mastercard, Белкарт. Онлайн-оплата через защищённый шлюз банка.", badge: null },
  { icon: Banknote, title: "Наличные", text: "Приём наличных в офисе по адресу или у курьера при доставке.", badge: null },
  { icon: FileText, title: "Рассрочка", text: "Для постоянных клиентов и крупных проектов — оплата 50/50 или поэтапно.", badge: "По договору" },
];

const STEPS = [
  { n: "01", title: "Бронирование", text: "Подтверждаете заказ, вносите предоплату 50%. Закрепляем оборудование за датой." },
  { n: "02", title: "Подготовка", text: "За 24 ч до события: финальный созвон, доплата остатка, согласование тайминга монтажа." },
  { n: "03", title: "Доставка и монтаж", text: "Приезжаем за 2–4 часа до старта. Технический специалист настраивает оборудование." },
  { n: "04", title: "Демонтаж", text: "Сразу после события или утром следующего дня. Возврат депозита в течение 3 рабочих дней." },
];

export const Route = createFileRoute("/delivery")({
  head: () => ({
    meta: [
      { title: "Доставка и оплата — event-hub.by" },
      { name: "description", content: "Условия доставки event-оборудования по Минску и Беларуси. Способы оплаты: безнал, карта, наличные. Сроки, тарифы, депозит." },
      { property: "og:title", content: "Доставка и оплата event-оборудования" },
      { property: "og:description", content: "Доставка по Минску бесплатно от 500 BYN. Безнал, карта, наличные. Прозрачные тарифы." },
    ],
    links: [{ rel: "canonical", href: "/delivery" }],
  }),
  component: Page,
});

function Page() {
  return (
    <div className="page-shell section-y max-w-6xl">
      <header className="max-w-3xl">
        <span className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-primary">
          <Truck className="h-3.5 w-3.5" /> Логистика
        </span>
        <h1 className="mt-3 text-4xl md:text-5xl font-display font-bold gradient-text">
          Доставка и оплата
        </h1>
        <p className="mt-5 text-lg text-muted-foreground">
          Привозим оборудование точно в срок, монтируем под ключ. Работаем по всей Беларуси —
          от Минска до областных центров. Прозрачные тарифы без скрытых наценок.
        </p>
      </header>

      <section aria-labelledby="zones-heading" className="mt-14">
        <h2 id="zones-heading" className="text-2xl md:text-3xl font-display font-bold flex items-center gap-3">
          <MapPin className="h-6 w-6 text-primary" /> География и тарифы
        </h2>
        <div className="mt-6 grid md:grid-cols-2 gap-4">
          {ZONES.map((z) => (
            <article key={z.name} className="glass p-6 rounded-2xl border border-border/50">
              <div className="flex items-start justify-between gap-4">
                <h3 className="font-display font-semibold text-lg">{z.name}</h3>
                <span className="text-primary font-medium whitespace-nowrap">{z.price}</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground flex items-center gap-2">
                <Clock className="h-3.5 w-3.5" /> {z.time}
              </p>
              <p className="mt-3 text-sm text-muted-foreground">{z.note}</p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="payment-heading" className="mt-16">
        <h2 id="payment-heading" className="text-2xl md:text-3xl font-display font-bold flex items-center gap-3">
          <CreditCard className="h-6 w-6 text-primary" /> Способы оплаты
        </h2>
        <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
          {PAYMENT.map((p) => (
            <article key={p.title} className="glass p-6 rounded-2xl border border-border/50 flex h-full flex-col items-center text-center md:items-start md:text-left">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <p.icon className="h-5 w-5" />
              </div>
              <div className="mt-4 flex items-center gap-2 flex-wrap justify-center md:justify-start">
                <h3 className="font-display font-semibold leading-snug">{p.title}</h3>
                {p.badge && (
                  <span className="text-[10px] uppercase tracking-wider bg-primary/15 text-primary px-2 py-0.5 rounded-full">
                    {p.badge}
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty max-w-[34ch] md:max-w-none">{p.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="steps-heading" className="mt-16">
        <h2 id="steps-heading" className="text-2xl md:text-3xl font-display font-bold flex items-center gap-3">
          <Package className="h-6 w-6 text-primary" /> Как проходит сделка
        </h2>
        <ol className="mt-6 grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {STEPS.map((s) => (
            <li key={s.n} className="glass p-6 rounded-2xl border border-border/50 relative">
              <span className="text-4xl font-display font-bold gradient-text">{s.n}</span>
              <h3 className="mt-3 font-display font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-16 glass-strong rounded-3xl p-8 md:p-12 border border-border/50">
        <div className="grid md:grid-cols-[1fr_auto] gap-6 items-center">
          <div>
            <h2 className="text-2xl md:text-3xl font-display font-bold">
              Не нашли свой город?
            </h2>
            <p className="mt-3 text-muted-foreground max-w-xl">
              Доставляем за пределы Беларуси по индивидуальному расчёту. Свяжитесь с менеджером —
              посчитаем точную стоимость логистики и таможенного оформления.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/contacts">
                Связаться <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/terms-rental">Условия аренды</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
