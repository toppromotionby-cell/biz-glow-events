// Публичная витрина DJ-клуба event-hub.by.
import { createFileRoute, Link } from "@tanstack/react-router";
import { Disc3, Music4, Sparkles, Users, Wrench, ShieldCheck, Headphones } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/dj/")({
  head: () => ({
    meta: [
      { title: "DJ Hub — закрытый клуб диджеев event-hub.by" },
      { name: "description", content: "Библиотека треков с BPM и тональностью, DJ-софт, рейтинги и обсуждения. Закрытый клуб диджеев Минска: доступ по заявке." },
      { property: "og:title", content: "DJ Hub — закрытый клуб диджеев" },
      { property: "og:description", content: "Треки, версии, BPM и Camelot, софт и обсуждения для event-диджеев." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DjLanding,
});

const FEATURES = [
  { icon: Music4, title: "Библиотека треков", text: "Extended, Clean, Intro, Acapella и мэшапы. Поиск по BPM, тональности Camelot, жанру, году и языку." },
  { icon: Headphones, title: "Встроенный плеер", text: "Прослушивание прямо в браузере с очередью и горячими клавишами — до скачивания." },
  { icon: Wrench, title: "DJ-софт и версии", text: "Каталог программ с версиями, платформами и датами релизов: всегда актуальная сборка." },
  { icon: Sparkles, title: "Рейтинги и избранное", text: "Оценки от коллег помогают быстро собрать сет под площадку и формат мероприятия." },
  { icon: Users, title: "Обсуждения", text: "Разделы «Ищу трек», оборудование, площадки — живое комьюнити event-диджеев." },
  { icon: ShieldCheck, title: "Закрытый доступ", text: "Файлы отдаются по временным ссылкам, вход только для одобренных участников клуба." },
];

const STEPS = [
  { n: 1, title: "Заявка", text: "Заполните короткую анкету: DJ-имя, город, опыт и контакт." },
  { n: 2, title: "Проверка", text: "Мы подтверждаем участника обычно в течение суток." },
  { n: 3, title: "Работа", text: "Доступ к библиотеке, софту и обсуждениям. Проверенные DJ могут загружать свои треки." },
];

function DjLanding() {
  return (
    <div className="container mx-auto max-w-6xl px-4 py-12">
      <section className="glass rounded-3xl p-8 md:p-12">
        <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <Disc3 className="h-3.5 w-3.5" /> Закрытый клуб
        </span>
        <h1 className="mt-4 font-display text-4xl font-bold gradient-text md:text-5xl">DJ Hub event-hub.by</h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          Рабочее место event-диджея: чистая библиотека треков с версиями и метаданными, актуальный софт,
          рейтинги коллег. Всё в одном месте и без лишнего шума.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild size="lg"><Link to="/dj/pool">Войти в библиотеку</Link></Button>
          <Button asChild size="lg" variant="outline"><Link to="/dj/software">Софт и плагины</Link></Button>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-2xl font-bold">Что внутри</h2>
        <ul className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <li key={f.title} className="glass rounded-2xl p-5">
              <f.icon className="h-5 w-5 text-primary" />
              <h3 className="mt-3 font-medium">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-2xl font-bold">Как получить доступ</h2>
        <ol className="mt-6 grid gap-4 md:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.n} className="glass rounded-2xl p-5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 font-display font-bold text-primary">{s.n}</span>
              <h3 className="mt-3 font-medium">{s.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{s.text}</p>
            </li>
          ))}
        </ol>
        <div className="mt-6">
          <Button asChild><Link to="/dj/pool">Подать заявку</Link></Button>
        </div>
      </section>
    </div>
  );
}
