// Автоподбор плотности слайда: оцениваем объём текста и подбираем ступень
// шкалы кеглей так, чтобы содержимое помещалось в отведённую область.
// Одна и та же логика используется в превью, PDF и превью.
import {
  DENSITY_STEPS, slideLayout, typeScale,
  type Density, type Rect, type SlideLayout, type TypeScale,
} from "@/lib/presentations/design";
import {
  DEFAULT_LAYOUT_OVERRIDES, partTextScale, type PresentationSlide,
} from "@/lib/presentations/model";
import { countLines, hasOrphanWord } from "@/lib/presentations/text-metrics";

/** Перенос считаем по реальным метрикам шрифта — как в превью и в PDF. */
function lineCount(text: string, size: number, width: number): number {
  return countLines(text, size, width);
}

/** Ступени микро-подгонки кегля: общая шкала, чтобы слайды не «плясали». */
const SHRINK_STEPS = [1, 0.96, 0.92, 0.88, 0.84, 0.8] as const;
/** Ниже этой доли текст не ужимаем — становится нечитаемо. */
const MIN_SHRINK = SHRINK_STEPS[SHRINK_STEPS.length - 1];

/** Умножает все кегли шкалы на коэффициент, сохраняя пропорции. */
function scaleType(ts: TypeScale, k: number): TypeScale {
  if (k >= 1) return ts;
  const out = { ...ts };
  for (const key of Object.keys(ts) as (keyof TypeScale)[]) {
    if (key === "density" || key === "lineGap") continue;
    const v = ts[key];
    if (typeof v === "number") (out[key] as number) = Math.max(10, Math.round(v * k));
  }
  return out;
}

/** Оценка высоты текстового блока слайда при заданной шкале. */
export function estimateTextHeight(
  slide: PresentationSlide,
  ts: TypeScale,
  box: Rect,
): number {
  const c = slide.content;
  const w = box.w;
  let h = 0;

  const ov = c.layout ?? DEFAULT_LAYOUT_OVERRIDES;
  const sizes = {
    title: (slide.type === "section" ? ts.titleSection : ts.titleSlide) * partTextScale(ov.titleScale),
    subtitle: ts.subtitle * partTextScale(ov.subtitleScale),
    body: ts.body * partTextScale(ov.bodyScale),
  };
  const titleSize = sizes.title;
  h += lineCount(slide.title, titleSize, w) * titleSize * 1.14;
  if (slide.subtitle.trim()) {
    h += 10 + lineCount(slide.subtitle, sizes.subtitle, w) * sizes.subtitle * 1.3;
  }
  h += ts.blockGap; // акцентная линия

  if (c.showDescription && c.description.trim()) {
    h += lineCount(c.description, sizes.body, w) * sizes.body * ts.lineGap + ts.blockGap;
  }
  if (c.showIncludes && c.includes.length) {
    h += ts.label * 1.6;
    for (const item of c.includes) {
      h += lineCount(item, ts.bullet, w - 22) * ts.bullet * ts.lineGap + 6;
    }
    h += ts.blockGap;
  }
  if (c.showSpecs && c.specs.length) {
    const perRow = Math.max(1, Math.floor(w / 240));
    h += Math.ceil(c.specs.length / perRow) * (ts.chip * 2.2) + ts.blockGap;
  }
  if (c.showPrice && c.price != null && c.price > 0) {
    h += ts.stat * 2 + ts.blockGap;
  }
  if (c.sku.trim()) h += ts.caption * 2;
  return h;
}

export type SlideFit = {
  layout: SlideLayout;
  density: Density;
  type: TypeScale;
  /** Не помещается даже на самой плотной ступени. */
  overflow: boolean;
  /** Насколько заполнена область (1 = впритык). */
  fill: number;
  /** Коэффициент автоподгонки кегля (1 = без ужатия). */
  shrink: number;
  warnings: string[];
};

/** Подбирает плотность и возвращает готовые размеры для рендера слайда. */
export function fitSlide(slide: PresentationSlide): SlideFit {
  const layout = slideLayout(slide);
  const box = layout.textBox;

  let chosen: Density = DENSITY_STEPS[DENSITY_STEPS.length - 1];
  let ts = typeScale(chosen);
  let height = estimateTextHeight(slide, ts, box);

  for (const step of DENSITY_STEPS) {
    const candidate = typeScale(step);
    const h = estimateTextHeight(slide, candidate, box);
    if (h <= box.h) {
      chosen = step;
      ts = candidate;
      height = h;
      break;
    }
    chosen = step;
    ts = candidate;
    height = h;
  }

  // Автоподгонка: самая плотная ступень всё ещё не влезает — ужимаем кегль
  // по общей шкале, но не ниже границы читаемости.
  let shrink = 1;
  if (height > box.h) {
    for (const step of SHRINK_STEPS) {
      const candidate = scaleType(ts, step);
      const h = estimateTextHeight(slide, candidate, box);
      shrink = step;
      ts = candidate;
      height = h;
      if (h <= box.h) break;
    }
  }

  const overflow = height > box.h;
  const warnings: string[] = [];
  if (overflow) {
    warnings.push("Слишком много текста — сократите описание или разбейте на два слайда");
  } else if (shrink <= MIN_SHRINK) {
    warnings.push("Текст сильно ужат — проверьте читаемость или сократите его");
  } else if (shrink < 1) {
    warnings.push("Текст автоматически ужат, чтобы поместиться в блок");
  }
  const titleSize = (slide.type === "section" ? ts.titleSection : ts.titleSlide)
    * partTextScale((slide.content.layout ?? DEFAULT_LAYOUT_OVERRIDES).titleScale);
  if (hasOrphanWord(slide.title, titleSize, box.w)) {
    warnings.push("В заголовке «висячее» слово в последней строке — переформулируйте");
  }
  if (slide.title.trim().split(/\s+/).filter(Boolean).length > 8) {
    warnings.push("Заголовок длиннее 8 слов — плохо читается с экрана");
  }
  if (slide.content.showIncludes && slide.content.includes.length > 6) {
    warnings.push("Больше 6 пунктов в списке — правило «одна мысль на слайд» нарушено");
  }
  if (slide.content.images.length > 5) {
    warnings.push("На слайд помещается не более 5 фотографий");
  }

  // Вертикальное выравнивание текста в своей зоне: сдвигаем реальную область
  // под фактическую высоту содержимого — одинаково в превью, PDF и превью.
  let finalLayout = layout;
  if (!overflow && layout.textAlign !== "top") {
    const free = Math.max(0, box.h - height);
    const dy = layout.textAlign === "center" ? free / 2 : free;
    finalLayout = { ...layout, textBox: { ...box, y: box.y + dy, h: height } };
  }

  return {
    layout: finalLayout, density: chosen, type: ts, overflow,
    fill: height / box.h, shrink, warnings,
  };
}

