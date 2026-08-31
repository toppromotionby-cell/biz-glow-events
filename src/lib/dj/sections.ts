// Иерархия DJ-библиотеки. Две независимые оси:
//   1) РАЗДЕЛ (section)  — что это за звук: музыка, отбивка, фон ведущему…
//   2) ФОРМАТ (format)   — где это играет: свадьба, корпоратив, Новый год…
// Категории внутри разделов живут в БД (dj_categories), форматы — в dj_event_formats.
// Файл client-safe.

export type DjSectionKey =
  | "music"
  | "jingles"
  | "host"
  | "samples"
  | "inout"
  | "welcome"
  | "family"
  | "show"
  | "club"
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
  { key: "music", label: "Музыка", short: "Музыка", hint: "Танцпол, медляки, ретро, русское и зарубежное", accent: "from-primary/80 to-primary/30" },
  { key: "jingles", label: "Отбивки и джинглы", short: "Отбивки", hint: "Логотипы, фанфары, дробь, переходы", accent: "from-accent/80 to-accent/30" },
  { key: "host", label: "Ведущему", short: "Ведущему", hint: "Фоны под речь, конкурсы, аукцион, церемонии", accent: "from-secondary/80 to-secondary/30" },
  { key: "samples", label: "Сэмплы и эффекты", short: "Сэмплы", hint: "FX, импакты, ризеры, атмосферы", accent: "from-primary/70 to-accent/30" },
  { key: "inout", label: "Входы и выходы", short: "Входы", hint: "Выход молодых и именинника, торт, финал", accent: "from-accent/70 to-primary/30" },
  { key: "welcome", label: "Регистрация и welcome", short: "Welcome", hint: "Сбор гостей, лаунж, ужин, фотозона", accent: "from-secondary/70 to-primary/30" },
  { key: "family", label: "Семейные моменты", short: "Семья", hint: "Очаг, танец с мамой, благословение, свечи", accent: "from-primary/60 to-accent/25" },
  { key: "show", label: "Шоу-программы", short: "Шоу", hint: "Артисты, файер, барабаны, свет, цирк", accent: "from-primary/60 to-secondary/30" },
  { key: "club", label: "Бар и клуб", short: "Клуб", hint: "Warm-up, peak-time, closing, ремиксы", accent: "from-accent/60 to-primary/25" },
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

// ─── Ось 2: форматы мероприятий ──────────────────────────────────────────────

export type DjFormatKey =
  | "wedding" | "birthday" | "corporate" | "newyear" | "march8"
  | "feb23" | "graduation" | "kids" | "themed" | "openair";

export type DjFormat = {
  key: DjFormatKey;
  label: string;
  hint: string;
  /** Подтемы — показываются как быстрые теги внутри формата. */
  subtags?: string[];
};

export const DJ_FORMATS: DjFormat[] = [
  { key: "wedding", label: "Свадьба", hint: "Церемония, банкет, первый танец" },
  { key: "birthday", label: "День рождения и юбилей", hint: "Именинник, торт, поздравления" },
  { key: "corporate", label: "Корпоратив", hint: "Тимбилдинг, награждение, банкет" },
  { key: "newyear", label: "Новый год", hint: "Ёлка, куранты, зимние хиты" },
  { key: "march8", label: "8 Марта", hint: "Женский праздник" },
  { key: "feb23", label: "23 Февраля", hint: "Мужской праздник" },
  { key: "graduation", label: "Выпускной", hint: "Школа, вуз, последний звонок" },
  { key: "kids", label: "Детский праздник", hint: "Аниматоры, игры, мультхиты" },
  {
    key: "themed", label: "Тематическая вечеринка", hint: "Гэтсби, Хэллоуин, неон и другие",
    subtags: ["Гэтсби", "Мафия", "Гавайская", "Хэллоуин", "Диско 80-х", "Стиляги", "Неон / UV", "Кино и супергерои", "Casino", "Пижамная"],
  },
  { key: "openair", label: "Городское и open-air", hint: "Площади, фестивали, улица" },
];

export const FORMAT_LABEL: Record<string, string> = Object.fromEntries(
  DJ_FORMATS.map((f) => [f.key, f.label]),
);

export function isFormatKey(v: string): v is DjFormatKey {
  return DJ_FORMATS.some((f) => f.key === v);
}

// ─── Автораспределение при массовой загрузке ────────────────────────────────

const SECTION_RULES: [RegExp, DjSectionKey][] = [
  [/отбив|стингер|sting|jingle|джингл|logo|фанфар|fanfare|дроб|drumroll|аплодисм|applause|отсчёт|отсчет|countdown/, "jingles"],
  [/ведущ|host|речь|speech|виктор|конкурс|тост|аукцион|интерактив|тайминг|пауза/, "host"],
  [/сэмпл|sample|\bfx\b|свуш|swoosh|impact|импакт|riser|ризер|атмосф|ambient|whoosh/, "samples"],
  [/очаг|hearth|танец с мам|танец с пап|благослов|карава|свеч|клятв|кольц|поздравлен родител|минута молчан/, "family"],
  [/выход|вход|молод|первый танец|first ?dance|финал|final|награжд|award|торт|cake|букет|салют|провод/, "inout"],
  [/welcome|велком|регистрац|сбор гост|лаунж|lounge|ужин|dinner|фуршет|фотозон|кофе/, "welcome"],
  [/шоу|show|файер|fire|артист|номер|барабанн|лазер|крио|цирк|иллюзион/, "show"],
  [/клуб|club|bar\b|бар\b|peak|warm.?up|closing|техно|techno|деп.?хаус|deep.?house|mashup|мэшап|bootleg|эдит/, "club"],
  [/софт|soft|setup|installer|плагин|plugin|vst/, "software"],
];

/** Автоподбор раздела по имени файла/папки и длительности. */
export function guessSection(relativePath: string, durationSec?: number | null): DjSectionKey {
  const p = relativePath.toLowerCase();
  for (const [re, key] of SECTION_RULES) if (re.test(p)) return key;
  if (typeof durationSec === "number" && durationSec > 0 && durationSec <= 20) return "samples";
  if (typeof durationSec === "number" && durationSec > 20 && durationSec <= 45) return "jingles";
  return "music";
}

const FORMAT_RULES: [RegExp, DjFormatKey][] = [
  [/свадьб|wedding|молодожён|молодожен|невест|жених|первый танец/, "wedding"],
  [/юбиле|день рожден|birthday|имениннdescrib|именинник|\bдр\b|торт/, "birthday"],
  [/корпорат|corporate|тимбилд|награжден|компани/, "corporate"],
  [/новый год|новогодн|\bнг\b|new ?year|рождеств|christmas|куранты|ёлка|елка|зимн/, "newyear"],
  [/8 ?март|8март|женский день|международный женский/, "march8"],
  [/23 ?фев|23фев|день защитник|мужской праздник/, "feb23"],
  [/выпускн|последний звонок|graduation|школьн|студенч/, "graduation"],
  [/детск|kids|аниматор|мультик|мульт-?хит/, "kids"],
  [/гэтсби|gatsby|мафи|гавай|hawaii|хэллоуин|halloween|стиляг|неон|casino|казино|пижам|тематич|париж|диско ?80/, "themed"],
  [/open ?air|опенэйр|городск|фестивал|площад|улич/, "openair"],
  [/клуб|club|бар\b|bar\b|вечеринк|party/, "themed"],
];

/** Автоподбор форматов мероприятия — трек может подойти сразу нескольким. */
export function guessFormats(relativePath: string): DjFormatKey[] {
  const p = relativePath.toLowerCase();
  const hits = new Set<DjFormatKey>();
  for (const [re, key] of FORMAT_RULES) if (re.test(p)) hits.add(key);
  return [...hits];
}
