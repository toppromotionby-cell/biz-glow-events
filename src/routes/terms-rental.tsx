import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, Clock, Wallet, AlertTriangle, FileSignature, Truck, HeartHandshake, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const FAQ = [
  { q: "Какой размер залога?", a: "Стандартный страховой депозит — 20% от стоимости аренды техники, возвращается в течение 3 рабочих дней после демонтажа при отсутствии повреждений." },
  { q: "За сколько дней бронировать?", a: "Зоны и фотозоны — минимум за 7 дней, сложная техника и LED — за 14 дней, продакшн декораций — за 21 день." },
  { q: "Что входит в стоимость?", a: "Доставка по Минску, монтаж/демонтаж, технический специалист на площадке, базовая настройка. Логистика по РБ — по тарифу." },
  { q: "Можно ли отменить бронь?", a: "Бесплатная отмена за 7 дней до события. За 3–7 дней удерживается 30%, менее 72 ч — 100% предоплаты." },
  { q: "Кто отвечает за повреждения?", a: "Арендатор. Мы фиксируем состояние оборудования актом приёма-передачи. Ремонт или замена — по рыночной стоимости комплектующих." },
  { q: "Работаете с НДС?", a: "Да. ООО на ОСН, выставляем ЭСЧФ, работаем с юр. лицами и ИП по договору и безналичному расчёту." },
];

const BLOCKS = [
  { icon: Wallet, title: "Депозит и оплата", text: "Предоплата 50% — бронь подтверждена. Остаток — за 24 ч до монтажа. Безнал, карта, наличные." },
  { icon: Clock, title: "Сроки", text: "Монтаж за 2–4 ч до старта, демонтаж — сразу после события или утром следующего дня." },
  { icon: Truck, title: "Логистика", text: "Доставка по Минску включена. По Беларуси — 1,5 BYN/км в одну сторону. Подъём на этажи без лифта — отдельно." },
  { icon: ShieldCheck, title: "Страхование", text: "Дорогое оборудование (LED, лазеры, VR) застраховано. Полис покрывает кражу и физические повреждения." },
  { icon: AlertTriangle, title: "Форс-мажор", text: "При отмене события по причинам, не зависящим от сторон (погода, ЧП), переносим бронь без штрафа в течение 90 дней." },
  { icon: HeartHandshake, title: "Поддержка", text: "Дежурный инженер на связи 24/7 в день события. Замена оборудования в течение 60 минут в пределах Минска." },
];

export const Route = createFileRoute("/terms-rental")({
  head: () => ({
    meta: [
      { title: "Гарантии и условия аренды — event-hub.by" },
      { name: "description", content: "Условия аренды event-оборудования: депозит, сроки, оплата, ответственность, страхование. Прозрачные правила работы event-hub.by." },
      { property: "og:title", content: "Условия аренды event-hub.by" },
      { property: "og:description", content: "Депозит, сроки бронирования, оплата, страхование и форс-мажор." },
    ],
    links: [{ rel: "canonical", href: "/terms-rental" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQ.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }),
      },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <div className="page-shell section-y max-w-5xl">
      <header className="max-w-3xl">
        <span className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-primary">
          <FileSignature className="h-3.5 w-3.5" /> Документы
        </span>
        <h1 className="mt-3 text-4xl md:text-5xl font-display font-bold gradient-text">
          Гарантии и условия аренды
        </h1>
        <p className="mt-5 text-lg text-muted-foreground">
          Чёткие правила работы, без сюрпризов в смете. Всё, что нужно знать перед бронированием.
        </p>
      </header>

      <section className="mt-12 grid md:grid-cols-2 gap-4 items-stretch">
        {BLOCKS.map((b) => (
          <div key={b.title} className="glass rounded-2xl p-6 flex h-full flex-col items-center text-center gap-3 md:flex-row md:items-start md:text-left md:gap-4">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <b.icon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex flex-1 flex-col items-center md:items-start">
              <h2 className="font-medium leading-snug text-balance">{b.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground text-pretty max-w-[34ch] md:max-w-none">{b.text}</p>
            </div>
          </div>
        ))}
      </section>

      <section aria-labelledby="faq-heading" className="mt-16">
        <h2 id="faq-heading" className="text-2xl md:text-3xl font-display font-bold">Частые вопросы по аренде</h2>
        <div className="mt-6 space-y-3">
          {FAQ.map((f) => (
            <details key={f.q} className="glass rounded-xl p-5 group">
              <summary className="cursor-pointer font-medium list-none flex justify-between items-center">
                {f.q}
                <span className="text-primary text-xl transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mt-16 glass-strong rounded-3xl p-10 text-center">
        <ShieldCheck className="mx-auto h-8 w-8 text-primary" />
        <h2 className="mt-4 text-2xl md:text-3xl font-display font-bold">Готовы оформить заявку?</h2>
        <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
          Пришлём договор и счёт в течение одного рабочего дня. Все условия фиксируем письменно.
        </p>
        <div className="mt-6 flex justify-center gap-3 flex-wrap">
          <Link to="/contacts"><Button className="bg-gradient-primary glow-primary">Связаться <ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
          <Link to="/offer"><Button variant="outline">Публичная оферта</Button></Link>
        </div>
      </section>
    </div>
  );
}
