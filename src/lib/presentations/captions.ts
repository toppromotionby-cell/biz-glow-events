// Автоподписи и alt-текст для фотографий слайда.
//
// Никакого ИИ: короткая осмысленная подпись собирается из названия проекта,
// заголовка слайда и позиции фото в наборе. Одинаково работает в превью,
// PDF и при экспорте — поэтому alt всегда осмысленный и стабильный.

/** Убирает лишние пробелы и хвостовую пунктуацию. */
function clean(s: string): string {
  return (s ?? "").replace(/\s+/g, " ").trim().replace(/[.,;:–—-]+$/, "");
}

/** Обрезает по словам до `max` символов. */
export function shorten(s: string, max = 70): string {
  const t = clean(s);
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const i = cut.lastIndexOf(" ");
  return `${(i > max * 0.5 ? cut.slice(0, i) : cut).trim()}…`;
}

export type PhotoAltInput = {
  /** Заголовок слайда (обычно название позиции). */
  slideTitle: string;
  /** Название презентации / проекта. */
  projectTitle?: string;
  /** Подзаголовок или раздел — уточняет контекст. */
  context?: string;
  index: number;
  total: number;
};

/**
 * Alt-текст фотографии: «Фотозона Neon — фото 2 из 5 (Свадьба Ивановых)».
 * Пустые части просто выпадают, дубли не повторяются.
 */
export function photoAlt(a: PhotoAltInput): string {
  const title = clean(a.slideTitle);
  const context = clean(a.context ?? "");
  const project = clean(a.projectTitle ?? "");
  const head = title || context || project || "Фотография";
  const parts = [head];
  if (context && context !== head) parts.push(context);
  const base = shorten(parts.join(" — "), 80);
  const counter = a.total > 1 ? `фото ${a.index + 1} из ${a.total}` : "фото";
  const tail = project && project !== head ? `${counter}, ${shorten(project, 40)}` : counter;
  return `${base} — ${tail}`;
}

/** Короткая подпись под кадром (без счётчика), например для контактного листа. */
export function photoCaption(a: PhotoAltInput): string {
  const title = clean(a.slideTitle) || clean(a.context ?? "") || clean(a.projectTitle ?? "");
  if (!title) return "";
  return a.total > 1 ? `${shorten(title, 46)} · ${a.index + 1}` : shorten(title, 46);
}
