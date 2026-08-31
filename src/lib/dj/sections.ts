// Иерархия DJ-библиотеки: фиксированные разделы + категории из БД.
// Файл client-safe.

export type DjSectionKey =
  | "music"
  | "jingles"
  | "host"
  | "samples"
  | "inout"
  | "welcome"
  | "show"
  | "software";

export type DjSection = {
  key: DjSectionKey;
  label: string;
  short: string;
  hint: string;
  /** Классы градиента из дизайн-системы (токены, без хардкода цветов). */
  accent: string;
};

export const DJ_SECTIONS: DjSection[] = [
  { key: "music", label: "Музыка", short: "Музыка", hint: "Танцпол, медляки, ретро, русское", accent: "from-primary/80 to-primary/30" },
  { key: "jingles", label: "Отбивки и джинглы", short: "Отбивки", hint: "Логотипы, переходы, сбивки", accent: "from-accent/80 to-accent/30" },
  { key: "host", label: "Ведущему", short: "Ведущему", hint: "Фоны под речь, конкурсы, церемонии", accent: "from-secondary/80 to-secondary/30" },
  { key: "samples", label: "Сэмплы и эффекты", short: "Сэмплы", hint: "FX, ударные, атмосферы", accent: "from-primary/70 to-accent/30" },
  { key: "inout", label: "Входы и выходы", short: "Входы", hint: "Выход молодых, финал, награждение", accent: "from-accent/70 to-primary/30" },
  { key: "welcome", label: "Регистрация и welcome", short: "Welcome", hint: "Сбор гостей, лаунж, ужин", accent: "from-secondary/70 to-primary/30" },
  { key: "show", label: "Шоу-программы", short: "Шоу", hint: "Артисты, файер, номера", accent: "from-primary/60 to-secondary/30" },
  { key: "software", label: "Софт", short: "Софт", hint: "DJ-софт, DAW, плагины, библиотеки", accent: "from-muted-foreground/40 to-muted/30" },
];

export const AUDIO_SECTIONS = DJ_SECTIONS.filter((s) => s.key !== "software");

export const SECTION_LABEL: Record<string, string> = Object.fromEntries(
  DJ_SECTIONS.map((s) => [s.key, s.label]),
);

export function isSectionKey(v: string): v is DjSectionKey {
  return DJ_SECTIONS.some((s) => s.key === v);
}

export type DjCategory = {
  id: string;
  section: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  sort_order: number;
  hidden: boolean;
  track_count?: number;
};

/** Автоподбор раздела по имени файла/папки и длительности. */
export function guessSection(relativePath: string, durationSec?: number | null): DjSectionKey {
  const p = relativePath.toLowerCase();
  const rules: [RegExp, DjSectionKey][] = [
    [/отбив|стингер|sting|jingle|джингл|logo|переход|transition|сбивк/, "jingles"],
    [/ведущ|host|речь|speech|виктор|конкурс|тост|церемон|ceremony/, "host"],
    [/сэмпл|sample|fx|свуш|swoosh|атмосф|ambient|drum|удар/, "samples"],
    [/выход|вход|молод|первый танец|first ?dance|финал|final|награжд|award/, "inout"],
    [/welcome|регистрац|сбор|лаунж|lounge|ужин|dinner|фуршет/, "welcome"],
    [/шоу|show|файер|fire|артист|номер/, "show"],
    [/софт|soft|setup|installer|плагин|plugin|vst/, "software"],
  ];
  for (const [re, key] of rules) if (re.test(p)) return key;
  if (typeof durationSec === "number" && durationSec > 0 && durationSec <= 30) return "jingles";
  return "music";
}
