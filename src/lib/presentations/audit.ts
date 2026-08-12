// Проверка слайдов: вмещается ли текст, не слишком ли мелкий кегль,
// нет ли разнобоя размеров между однотипными слайдами и наложений блоков.
// Используется панелью «Проверка» в редакторе презентаций.
import { fitSlide } from "@/lib/presentations/fit";
import type { PresentationSlide } from "@/lib/presentations/model";
import type { Rect } from "@/lib/presentations/design";

export type AuditLevel = "error" | "warn";

export type AuditIssue = {
  slideId: string;
  slideIndex: number;
  slideTitle: string;
  block: "title" | "text" | "photo" | "price" | "layout";
  level: AuditLevel;
  message: string;
};

/** Минимально читаемый кегль основного текста на слайде (px в макете 1280×720). */
const MIN_BODY = 16;

function overlaps(a: Rect, b: Rect): boolean {
  const pad = 2;
  return (
    a.x + a.w - pad > b.x && b.x + b.w - pad > a.x &&
    a.y + a.h - pad > b.y && b.y + b.h - pad > a.y
  );
}

/** Проверяет один слайд. */
export function auditSlide(slide: PresentationSlide, index: number): AuditIssue[] {
  const fit = fitSlide(slide);
  const base = { slideId: slide.id, slideIndex: index, slideTitle: slide.title || "Без заголовка" };
  const issues: AuditIssue[] = [];

  if (!slide.title.trim()) {
    issues.push({ ...base, block: "title", level: "warn", message: "Нет заголовка слайда" });
  }
  if (fit.overflow) {
    issues.push({
      ...base, block: "text", level: "error",
      message: "Текст не помещается в блок даже после автоподгонки",
    });
  } else if (fit.shrink < 1) {
    issues.push({
      ...base, block: "text", level: "warn",
      message: `Текст автоматически ужат до ${Math.round(fit.shrink * 100)}% — проверьте читаемость`,
    });
  }
  if (fit.type.body < MIN_BODY || fit.type.bullet < MIN_BODY) {
    issues.push({
      ...base, block: "text", level: "warn",
      message: "Кегль основного текста ниже комфортного минимума",
    });
  }

  const { textBox, photoBox, priceBox } = fit.layout;
  if (photoBox && overlaps(textBox, photoBox)) {
    issues.push({ ...base, block: "layout", level: "error", message: "Текст перекрывает фото" });
  }
  if (priceBox && overlaps(textBox, priceBox)) {
    issues.push({ ...base, block: "layout", level: "warn", message: "Текст перекрывает блок цены" });
  }

  if (slide.content.showImage && !slide.content.images.length && !slide.content.image_url) {
    issues.push({ ...base, block: "photo", level: "warn", message: "Показ фото включён, но фото не выбрано" });
  }

  for (const w of fit.warnings) {
    if (issues.some((i) => i.message === w)) continue;
    issues.push({ ...base, block: "text", level: "warn", message: w });
  }
  return issues;
}

export type AuditReport = {
  issues: AuditIssue[];
  errors: number;
  warns: number;
};

/** Проверяет всю презентацию, включая единообразие кеглей между слайдами. */
export function auditPresentation(slides: PresentationSlide[]): AuditReport {
  const visible = slides.filter((s) => s.is_visible);
  const issues: AuditIssue[] = [];
  visible.forEach((s, i) => issues.push(...auditSlide(s, i)));

  // Разнобой: у однотипных слайдов кегль заголовка должен совпадать.
  const byType = new Map<string, { slide: PresentationSlide; index: number; size: number }[]>();
  visible.forEach((slide, index) => {
    const fit = fitSlide(slide);
    const size = slide.type === "section" ? fit.type.titleSection : fit.type.titleSlide;
    const arr = byType.get(slide.type) ?? [];
    arr.push({ slide, index, size });
    byType.set(slide.type, arr);
  });
  for (const [, group] of byType) {
    if (group.length < 2) continue;
    const max = Math.max(...group.map((g) => g.size));
    for (const g of group) {
      if (g.size >= max * 0.9) continue;
      issues.push({
        slideId: g.slide.id,
        slideIndex: g.index,
        slideTitle: g.slide.title || "Без заголовка",
        block: "title",
        level: "warn",
        message: "Заголовок мельче, чем на других слайдах того же типа",
      });
    }
  }

  return {
    issues,
    errors: issues.filter((i) => i.level === "error").length,
    warns: issues.filter((i) => i.level === "warn").length,
  };
}
