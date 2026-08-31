// Публичная витрина DJ-клуба event-hub.by.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Disc3, Music4, Sparkles, Wrench, ShieldCheck, Headphones, Flame, Star, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CoverArt } from "@/components/dj/CoverArt";
import { djShowcase } from "@/lib/dj/dj.functions";
import { AUDIO_SECTIONS } from "@/lib/dj/sections";
import { coverCssGradient } from "@/lib/dj/cover-role";
import { formatDuration, type DjTrackFilters } from "@/lib/dj/types";
import type { ShowcaseTrack } from "@/lib/dj/library.server";

export const Route = createFileRoute("/dj/")({
  head: () => ({
    meta: [
      { title: "DJ Hub — закрытый клуб диджеев event-hub.by" },
      { name: "description", content: "Библиотека треков с BPM и тональностью, отбивки, фоны ведущему, сэмплы и DJ-софт. Закрытый клуб event-диджеев: доступ по заявке." },
      { property: "og:title", content: "DJ Hub — закрытый клуб диджеев" },
      { property: "og:description", content: "Треки, версии, BPM и Camelot, отбивки, сэмплы и софт для event-диджеев." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DjLanding,
});

const FEATURES = [
  { icon: Music4, title: "Чистая библиотека", text: "Extended, Clean, Intro, Acapella и мэшапы. Дубли отсекаются автоматически — один трек в одной лучшей версии." },
  { icon: Headphones, title: "Плеер с волной", text: "Прослушивание прямо в браузере: волна, очередь, пробел на паузу — до скачивания." },
  { icon: Sparkles, title: "Фирменные обложки", text: "Каждому файлу автоматически рисуется обложка в едином стиле с логотипом event-hub.by." },
  { icon: Wrench, title: "Софт и версии", text: "Каталог программ с версиями, платформами и датами релизов: всегда актуальная сборка." },
  { icon: Star, title: "Рейтинги и избранное", text: "Оценки коллег помогают быстро собрать сет под площадку и формат мероприятия." },
  { icon: ShieldCheck, title: "Закрытый доступ", text: "Файлы отдаются по временным ссылкам, вход только для одобренных участников клуба." },
];

const STEPS = [
  { n: 1, title: "Заявка", text: "Заполните короткую анкету: DJ-имя, город, опыт и контакт." },
  { n: 2, title: "Проверка", text: "Мы подтверждаем участника обычно в течение суток." },
  { n: 3, title: "Работа", text: "Доступ к библиотеке, софту и загрузкам. Проверенные DJ могут пополнять пул." },
];

function poolSearch(filters: Partial<DjTrackFilters>) {
  return filters as Record<string, unknown>;
}

function RailCard({ track }: { track: ShowcaseTrack }) {
  return (
    <Link
      to="/dj/pool"
      search={poolSearch({ q: `${track.artist} ${track.title}` })}
      className="dj-ring group block overflow-hidden rounded-2xl border border-border/60 bg-card/70 transition-transform duration-300 hover:-translate-y-1"
    >
      <div className="aspect-square overflow-hidden">
        <div className="h-full w-full transition-transform duration-500 group-hover:scale-105">
          <CoverArt track={track} rounded="rounded-none" />
        </div>
      </div>
      <div className="p-3">
        <p className="truncate text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">{track.artist}</p>
        <p className="truncate text-sm font-bold">{track.title}</p>
        <p className="mt-1 text-[0.62rem] tabular-nums text-muted-foreground">
          {track.bpm ? `${track.bpm} BPM · ` : ""}{track.key_camelot ? `${track.key_camelot} · ` : ""}
          {formatDuration(track.duration_sec)}
        </p>
      </div>
    </Link>
  );
}

function Rail({
  icon: Icon, title, tracks, loading,
}: {
  icon: typeof Flame;
  title: string;
  tracks: ShowcaseTrack[] | undefined;
  loading: boolean;
}) {
  if (!loading && (!tracks || tracks.length === 0)) return null;
  return (
    <section className="mt-12">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-2xl font-bold">
          <Icon className="h-5 w-5 text-primary" /> {title}
        </h2>
        <Button asChild variant="ghost" size="sm"><Link to="/dj/pool">Весь пул</Link></Button>
      </div>
      <div className="dj-rail">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />)
          : tracks!.map((t) => <RailCard key={t.id} track={t} />)}
      </div>
    </section>
  );
}

function DjLanding() {
  const { data, isLoading } = useQuery({
    queryKey: ["dj", "showcase"],
    queryFn: () => djShowcase(),
    staleTime: 60_000,
  });

  const stats = [
    { label: "треков в пуле", value: data?.stats.tracks ?? 0 },
    { label: "новинок за неделю", value: data?.stats.fresh7d ?? 0 },
    { label: "программ и плагинов", value: data?.stats.software ?? 0 },
  ];

  return (
    <div className="container mx-auto max-w-6xl px-4 py-12">
      {/* Хиро */}
      <section className="glass dj-grain relative isolate overflow-hidden rounded-3xl p-8 md:p-12">
        <div className="dj-aurora" aria-hidden />
        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary">
            <Disc3 className="h-3.5 w-3.5 animate-spin [animation-duration:6s]" /> Закрытый клуб
          </span>
          <h1 className="mt-4 font-display text-4xl font-bold gradient-text md:text-6xl">DJ Hub event-hub.by</h1>
          <p className="mt-4 max-w-2xl text-base text-muted-foreground md:text-lg">
            Рабочее место event-диджея: музыка, отбивки, фоны ведущему, сэмплы, входы-выходы и welcome —
            с BPM, тональностью Camelot и фирменными обложками. Без дублей и лишнего шума.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-glow hover:opacity-90">
              <Link to="/dj/pool">Войти в библиотеку</Link>
            </Button>
            <Button asChild size="lg" variant="outline"><Link to="/dj/software">Софт и плагины</Link></Button>
          </div>
          <dl className="mt-8 grid max-w-lg grid-cols-3 gap-4">
            {stats.map((s) => (
              <div key={s.label}>
                <dt className="sr-only">{s.label}</dt>
                <dd className="font-display text-3xl font-bold tabular-nums gradient-text">{s.value}</dd>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Разделы библиотеки */}
      <section className="mt-12">
        <h2 className="font-display text-2xl font-bold">Разделы библиотеки</h2>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {AUDIO_SECTIONS.map((s) => (
            <li key={s.key}>
              <Link
                to="/dj/pool"
                search={poolSearch({ section: s.key })}
                className="dj-ring dj-grain group relative flex h-32 flex-col justify-end overflow-hidden rounded-2xl p-4 text-white transition-transform duration-300 hover:-translate-y-1"
                style={{ backgroundImage: coverCssGradient({ artist: s.key, title: s.label, section: s.key }) }}
              >
                <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
                <span className="relative text-base font-bold">{s.label}</span>
                <span className="relative text-[0.7rem] text-white/75">{s.hint}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <Rail icon={Clock} title="Свежее в пуле" tracks={data?.fresh} loading={isLoading} />
      <Rail icon={Flame} title="Топ загрузок" tracks={data?.popular} loading={isLoading} />
      <Rail icon={Star} title="Высокий рейтинг" tracks={data?.rated} loading={isLoading} />

      <section className="mt-14">
        <h2 className="font-display text-2xl font-bold">Что внутри</h2>
        <ul className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <li key={f.title} className="dj-ring glass rounded-2xl p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-accent/20">
                <f.icon className="h-5 w-5 text-primary" />
              </span>
              <h3 className="mt-3 font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-14">
        <h2 className="font-display text-2xl font-bold">Как получить доступ</h2>
        <ol className="mt-6 grid gap-4 md:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.n} className="glass rounded-2xl p-5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent font-display font-bold text-primary-foreground">
                {s.n}
              </span>
              <h3 className="mt-3 font-semibold">{s.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{s.text}</p>
            </li>
          ))}
        </ol>
        <div className="mt-6">
          <Button asChild className="bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-glow hover:opacity-90">
            <Link to="/dj/pool">Подать заявку</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
