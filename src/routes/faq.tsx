import { createFileRoute } from "@tanstack/react-router";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { HelpCircle } from "lucide-react";

const FAQ: { q: string; a: string }[] = [
  {
    q: "Как оформить заказ?",
    a: "Выберите интересующие позиции в каталоге и добавьте их в корзину. После отправки наш менеджер свяжется с вами в течение рабочего дня для уточнения деталей и подтверждения дат.",
  },
  {
    q: "За сколько дней нужно бронировать?",
    a: "Оптимально — за 2–4 недели до мероприятия. Под крупные ивенты (от 200 гостей) лучше бронировать за 1–2 месяца. Срочные заказы рассматриваем индивидуально.",
  },
  {
    q: "Работаете ли вы за пределами Минска?",
    a: "Да, выезжаем по всей Беларуси. Логистика и монтаж в регионах рассчитываются отдельно в зависимости от объёма оборудования и расстояния.",
  },
  {
    q: "Можно ли арендовать только оборудование, без услуг?",
    a: "Да. Возможна аренда без техобслуживания (self-service) либо с инженером на площадке. Условия указываются в коммерческом предложении.",
  },
  {
    q: "Как происходит оплата?",
    a: "Работаем с физлицами и юрлицами по безналу и через ЕРИП. Стандартно — предоплата 50% при бронировании, остаток — за 3 дня до мероприятия. Для постоянных клиентов условия гибкие.",
  },
  {
    q: "Что если мероприятие отменится?",
    a: "При отмене за 14+ дней предоплата возвращается полностью. От 7 до 13 дней — удерживается 30%. Менее 7 дней — 100%. Перенос даты бесплатный при наличии свободных слотов.",
  },
  {
    q: "Цены указаны окончательные?",
    a: "Цены в каталоге — базовые ставки за стандартный пакет (до 4 часов). Финальная стоимость зависит от продолжительности, состава, логистики и доп. опций. Точную смету выдаём в КП.",
  },
  {
    q: "Предоставляете ли вы закрывающие документы?",
    a: "Да. Договор, счёт, акт выполненных работ — для юрлиц и ИП. Для физлиц — чек ЕРИП или квитанция.",
  },
];

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ — частые вопросы | event-hub.by" },
      { name: "description", content: "Ответы на частые вопросы об аренде оборудования, бронировании зон, оплате и работе с event-hub.by в Минске и по Беларуси." },
      { property: "og:title", content: "FAQ — event-hub.by" },
      { property: "og:description", content: "Бронирование, оплата, логистика, документы — отвечаем на главные вопросы клиентов." },
      { name: "robots", content: "index, follow" },
    ],
    links: [{ rel: "canonical", href: "https://event-hub.by/faq" }],
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
  component: FaqPage,
});

function FaqPage() {
  return (
    <div className="page-shell section-y max-w-3xl">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary glow-primary">
          <HelpCircle className="h-5 w-5 text-primary-foreground" />
        </span>
        <h1 className="text-4xl font-display font-bold gradient-text">Частые вопросы</h1>
      </div>
      <p className="mt-4 text-muted-foreground">
        Если не нашли ответ — напишите на{" "}
        <a href="mailto:hello@event-hub.by" className="text-primary hover:underline">hello@event-hub.by</a>
        {" "}или оставьте заявку на странице{" "}
        <a href="/contacts" className="text-primary hover:underline">контактов</a>.
      </p>

      <Accordion type="single" collapsible className="mt-10 glass rounded-2xl px-2">
        {FAQ.map((item, i) => (
          <AccordionItem key={i} value={`item-${i}`} className="border-border/50 last:border-0">
            <AccordionTrigger className="px-4 text-left font-medium hover:no-underline">
              {item.q}
            </AccordionTrigger>
            <AccordionContent className="px-4 text-muted-foreground leading-relaxed">
              {item.a}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
