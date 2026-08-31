import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Handshake, Percent, Zap, FileText, Users, Briefcase, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { submitLead } from "@/lib/leads.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/partners")({
  head: () => ({
    meta: [
      { title: "Партнёрская программа для агентств — event-hub.by" },
      { name: "description", content: "Партнёрская программа event-hub.by для event-агентств, BTL и продакшна: комиссия до 20%, white-label, приоритет в брони и личный менеджер." },
      { property: "og:title", content: "Партнёрская программа event-hub.by" },
      { property: "og:description", content: "White-label аренда, комиссия до 20%, приоритет в брони. Для агентств и продакшн-студий." },
    ],
    links: [{ rel: "canonical", href: "/partners" }],
  }),
  component: Page,
});

const BENEFITS = [
  { icon: Percent, title: "Комиссия до 20%", text: "Прогрессивная шкала по объёму. Выплаты раз в месяц на расчётный счёт или взаимозачёт." },
  { icon: Zap, title: "Приоритет в брони", text: "Резерв оборудования за партнёрами в высокий сезон. Первая линия на дефицитные позиции." },
  { icon: Briefcase, title: "White-label", text: "Работаем под вашим брендом: инженеры без логотипов, упаковка нейтральная, документы — на ваше юрлицо." },
  { icon: FileText, title: "Готовые сметы", text: "Шаблоны коммерческих по типам мероприятий. Прайс с partner-наценкой для пересылки клиенту." },
  { icon: Users, title: "Личный менеджер", text: "Один контакт на все проекты, ответ в течение 30 минут в рабочее время." },
  { icon: Handshake, title: "Совместный маркетинг", text: "Кейсы публикуем с упоминанием агентства, охотно делимся правами на съёмку." },
];

const TIERS = [
  { name: "Старт", volume: "до 30 000 BYN/год", commission: "10%", perks: ["Прайс с наценкой", "Личный менеджер"] },
  { name: "Бизнес", volume: "30 000 – 100 000", commission: "15%", perks: ["Всё из «Старт»", "White-label", "Приоритет брони"] },
  { name: "Премиум", volume: "от 100 000", commission: "20%", perks: ["Всё из «Бизнес»", "Совместный маркетинг", "Эксклюзивные позиции"] },
];

function Page() {
  return (
    <div className="page-shell section-y max-w-6xl">
      <header className="max-w-3xl">
        <span className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-primary">
          <Handshake className="h-3.5 w-3.5" /> B2B
        </span>
        <h1 className="mt-3 text-4xl md:text-5xl font-display font-bold gradient-text">
          Партнёрам и агентствам — техника, продакшн и зоны под вашим брендом
        </h1>
        <p className="mt-5 text-lg text-muted-foreground">
          Берём на себя инженерную часть, вы остаётесь лицом проекта перед клиентом. Гибкая комиссия и зарезервированные ресурсы.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a href="#join"><Button className="bg-gradient-primary glow-primary">Стать партнёром <ArrowRight className="ml-2 h-4 w-4" /></Button></a>
          <Link to="/cases"><Button variant="outline">Наши кейсы</Button></Link>
        </div>
      </header>

      <section aria-labelledby="benefits-heading" className="mt-16">
        <h2 id="benefits-heading" className="text-2xl md:text-3xl font-display font-bold">Что вы получаете</h2>
        <div className="mt-8 grid md:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
          {BENEFITS.map((b) => (
            <div key={b.title} className="glass rounded-2xl p-6 flex h-full flex-col items-center text-center md:items-start md:text-left">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <b.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-medium leading-snug text-balance">{b.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground text-pretty max-w-[34ch] md:max-w-none">{b.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="tiers-heading" className="mt-20">
        <h2 id="tiers-heading" className="text-2xl md:text-3xl font-display font-bold">Тарифная сетка</h2>
        <p className="mt-2 text-muted-foreground">Уровень пересчитывается раз в квартал по выручке за 12 месяцев.</p>
        <div className="mt-8 grid md:grid-cols-3 gap-4">
          {TIERS.map((t, i) => (
            <div key={t.name} className={`rounded-2xl p-6 ${i === 1 ? "glass-strong border-primary/40 border" : "glass"}`}>
              <div className="text-sm text-muted-foreground">{t.volume}</div>
              <h3 className="mt-1 text-xl font-display font-bold">{t.name}</h3>
              <div className="mt-3 text-4xl font-display font-bold gradient-text">{t.commission}</div>
              <ul className="mt-5 space-y-2 text-sm">
                {t.perks.map((p) => (
                  <li key={p} className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" /> {p}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <PartnerForm />
    </div>
  );
}

function PartnerForm() {
  const [form, setForm] = useState({
    client_name: "", client_phone: "", client_email: "", client_company: "", notes: "", consent: false,
  });

  const m = useMutation({
    mutationFn: () => submitLead({
      data: {
        client_name: form.client_name,
        client_phone: form.client_phone,
        client_email: form.client_email,
        client_company: form.client_company || null,
        notes: form.notes || null,
        source: "partner",
        consent_pd: true,
      },
    }),
    onSuccess: () => {
      toast.success("Заявка отправлена! Свяжемся в течение рабочего дня.");
      setForm({ client_name: "", client_phone: "", client_email: "", client_company: "", notes: "", consent: false });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const valid = form.client_name.length >= 2 && form.client_phone.length >= 5 && /.+@.+\..+/.test(form.client_email) && form.consent;

  return (
    <section id="join" className="mt-20 glass-strong rounded-3xl p-8 md:p-10 scroll-mt-20">
      <div className="grid lg:grid-cols-[1fr_1.2fr] gap-8">
        <div>
          <h2 className="text-2xl md:text-3xl font-display font-bold">Заявка на партнёрство</h2>
          <p className="mt-3 text-muted-foreground">
            Расскажите о вашем агентстве — отправим презентацию, прайс с partner-наценкой и пригласим на встречу.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
            <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-primary mt-0.5" /> Ответ в течение 1 рабочего дня</li>
            <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-primary mt-0.5" /> Подписываем NDA по запросу</li>
            <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-primary mt-0.5" /> Без минимального объёма для старта</li>
          </ul>
        </div>

        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (valid) m.mutate(); }}>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Имя *</Label><Input value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} required /></div>
            <div className="space-y-2"><Label>Агентство</Label><Input value={form.client_company} onChange={(e) => setForm({ ...form, client_company: e.target.value })} placeholder="ООО / ИП" /></div>
            <div className="space-y-2"><Label>Телефон *</Label><Input type="tel" value={form.client_phone} onChange={(e) => setForm({ ...form, client_phone: e.target.value })} required /></div>
            <div className="space-y-2"><Label>Email *</Label><Input type="email" value={form.client_email} onChange={(e) => setForm({ ...form, client_email: e.target.value })} required /></div>
          </div>
          <div className="space-y-2">
            <Label>О вас: профиль, объёмы, какие проекты делаете</Label>
            <Textarea rows={4} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <label className="flex items-start gap-2 text-sm text-muted-foreground">
            <Checkbox checked={form.consent} onCheckedChange={(v) => setForm({ ...form, consent: !!v })} className="mt-0.5" />
            <span>Согласен с <Link to="/privacy" className="text-primary hover:underline">политикой обработки персональных данных</Link></span>
          </label>
          <Button type="submit" disabled={!valid || m.isPending} className="bg-gradient-primary glow-primary w-full sm:w-auto">
            {m.isPending ? "Отправляем…" : "Отправить заявку"}
          </Button>
        </form>
      </div>
    </section>
  );
}
