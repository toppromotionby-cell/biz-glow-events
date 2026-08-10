// Автоподбор плотности слайда: оцениваем объём текста и подбираем ступень
// шкалы кеглей так, чтобы содержимое помещалось в отведённую область.
// Одна и та же логика используется в превью, PDF и PPTX.
import {
  DENSITY_STEPS, slideLayout, typeScale,
  type Density, type Rect, type SlideLayout, type TypeScale,
} from "@/lib/presentations/design";
import type { PresentationSlide } from "@/lib/presentations/model";

/** Среднее отношение ширины символа к кеглю для Inter/Space Grotesk. */
const CHAR_W = 0.52;

function lineCount(text: string, size: number, width: number): number {
  if (!text.trim()) return 0;
  const perLine = Math.max(8, Math.floor(width / (size * CHAR_W)));
  return text
    .split("\n")
    .reduce((sum, para) => sum + Math.max(1, Math.ceil(para.length / perLine)), 0);
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

  const titleSize = slide.type === "section" ? ts.titleSection : ts.titleSlide;
  h += lineCount(slide.title, titleSize, w) * titleSize * 1.14;
  if (slide.subtitle.trim()) {
    h += 10 + lineCount(slide.subtitle, ts.subtitle, w) * ts.subtitle * 1.3;
  }
  h += ts.blockGap; // акцентная линия

  if (c.showDescription && c.description.trim()) {
    h += lineCount(c.description, ts.body, w) * ts.body * ts.lineGap + ts.blockGap;
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

  const overflow = height > box.h;
  const warnings: string[] = [];
  if (overflow) {
    warnings.push("Слишком много текста — сократите описание или разбейте на два слайда");
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

  return { layout, density: chosen, type: ts, overflow, fill: height / box.h, warnings };
}
