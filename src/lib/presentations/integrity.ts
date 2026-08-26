// Проверка целостности презентации и автопочинка макета.
//
// Проверяем то, что реально ломает документ: дубликаты слайдов, пустые слайды
// и пустые зоны, выход блоков за границы холста, «потерянные» фото и
// расхождение превью с PDF (оба рендера собираются одним спеком, поэтому
// достаточно проверить сам спек на выход за пределы 1280×720).
import { GRID, SLIDE_H, SLIDE_W } from "@/lib/presentations/design";
import { fitSlide } from "@/lib/presentations/fit";
import { slideSpec } from "@/lib/presentations/spec";
import {
  DEFAULT_LAYOUT_OVERRIDES, MAX_IMAGES, SLIDE_VARIANTS, slideVariantId,
  type PresentationSlide,
} from "@/lib/presentations/model";

export type IntegrityLevel = "error" | "warn" | "info";

export type IntegrityCode =
  | "duplicate-slide"
  | "empty-slide"
  | "empty-zone"
  | "out-of-bounds"
  | "photo-hidden"
  | "photo-missing"
  | "photo-duplicate"
  | "photo-overflow"
  | "unknown-variant"
  | "order-gap";

export type IntegrityIssue = {
  code: IntegrityCode;
  level: IntegrityLevel;
  slideId: string;
  slideIndex: number;
  slideTitle: string;
  message: string;
  /** Проблему умеет чинить кнопка «Исправить макет». */
  fixable: boolean;
};

export type IntegrityReport = {
  issues: IntegrityIssue[];
  errors: number;
  warns: number;
  fixable: number;
};

const specInput = (slide: PresentationSlide, index: number, total: number) => ({
  slide,
  fit: fitSlide(slide),
  company: null,
  presentationTitle: "",
  brandName: "",
  heroLogo: null,
  footerLogo: false,
  dateLabel: "",
  index,
  total,
});

/** Прямоугольник блока спека (у текста высоту оцениваем по строкам). */
function blockRect(b: Record<string, unknown>): { x: number; y: number; w: number; h: number } | null {
  const x = Number(b.x);
  const y = Number(b.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (b.kind === "text") {
    const lines = Array.isArray(b.lines) ? b.lines.length : 1;
    const size = Number(b.size) || 16;
    const lh = Number(b.lineHeight) || 1.2;
    return { x, y, w: Number(b.w) || 0, h: Math.round(size * lh * Math.max(1, lines)) };
  }
  const w = Number(b.w);
  const h = Number(b.h);
  if (!Number.isFinite(w) || !Number.isFinite(h)) return null;
  return { x, y, w, h };
}

function slideIsEmpty(s: PresentationSlide): boolean {
  const c = s.content;
  return (
    !s.title.trim() && !s.subtitle.trim() && !c.description.trim() &&
    !c.includes.length && !c.specs.length && !c.images.length && c.price == null
  );
}

function slideFingerprint(s: PresentationSlide): string {
  return [
    s.type,
    s.title.trim().toLowerCase(),
    s.subtitle.trim().toLowerCase(),
    s.content.description.trim().toLowerCase(),
    s.content.images.join("|"),
  ].join("::");
}

/** Полная проверка презентации. */
export function checkPresentation(slides: PresentationSlide[]): IntegrityReport {
  const issues: IntegrityIssue[] = [];
  const seen = new Map<string, number>();
  const total = slides.length;

  slides.forEach((slide, index) => {
    const base = {
      slideId: slide.id,
      slideIndex: index,
      slideTitle: slide.title || "Без заголовка",
    };
    const push = (
      code: IntegrityCode, level: IntegrityLevel, message: string, fixable: boolean,
    ) => issues.push({ ...base, code, level, message, fixable });

    const fp = slideFingerprint(slide);
    const first = seen.get(fp);
    if (first !== undefined) {
      push("duplicate-slide", "warn", `Дубликат слайда №${first + 1}`, true);
    } else {
      seen.set(fp, index);
    }

    if (slideIsEmpty(slide)) push("empty-slide", "error", "Слайд полностью пустой", true);
    else if (!slide.title.trim()) push("empty-zone", "warn", "Не заполнен заголовок", false);

    const known = SLIDE_VARIANTS[slide.type].some((v) => v.id === slide.content.variant);
    if (!known) {
      push("unknown-variant", "error", `Неизвестный вариант оформления «${slide.content.variant}»`, true);
    }

    const imgs = slide.content.images;
    if (new Set(imgs).size !== imgs.length) {
      push("photo-duplicate", "warn", "Одно и то же фото добавлено несколько раз", true);
    }
    if (imgs.length > MAX_IMAGES) {
      push("photo-overflow", "warn", `Больше ${MAX_IMAGES} фото — лишние не отрисуются`, true);
    }
    if (imgs.length && !slide.content.showImage) {
      push("photo-hidden", "warn", "Фото загружены, но показ фото выключен", true);
    }
    if (!imgs.length && slide.content.showImage && slide.type !== "text") {
      push("photo-missing", "info", "Зона фото пустая: фото не выбрано", false);
    }

    // Выход блоков за границы холста — единственная причина расхождений
    // превью и PDF, потому что оба рендера берут блоки из одного спека.
    try {
      const spec = slideSpec(specInput(slide, index + 1, total));
      for (const b of spec.blocks as unknown as Record<string, unknown>[]) {
        const r = blockRect(b);
        if (!r) continue;
        const out =
          r.x < -1 || r.y < -1 ||
          r.x + r.w > SLIDE_W + 1 || r.y + r.h > SLIDE_H + GRID.marginBottom;
        if (out) {
          push("out-of-bounds", "error", `Блок «${String(b.kind)}» выходит за границы слайда`, true);
          break;
        }
      }
    } catch (e) {
      push("out-of-bounds", "error", `Слайд не собирается: ${(e as Error).message}`, true);
    }
  });

  slides.forEach((s, i) => {
    if (s.position !== i) {
      issues.push({
        code: "order-gap", level: "info", slideId: s.id, slideIndex: i,
        slideTitle: s.title || "Без заголовка",
        message: "Нарушен порядок слайдов", fixable: true,
      });
    }
  });

  return {
    issues,
    errors: issues.filter((i) => i.level === "error").length,
    warns: issues.filter((i) => i.level === "warn").length,
    fixable: issues.filter((i) => i.fixable).length,
  };
}

export type RepairAction = {
  rule: string;
  slideTitle: string;
  detail: string;
};

export type RepairResult = {
  slides: PresentationSlide[];
  actions: RepairAction[];
};

/**
 * Автопочинка: удаляет пустые и дублирующие слайды, нормализует фото,
 * чинит вариант оформления и откатывает ручные сдвиги, из-за которых
 * блоки уезжают за границы слайда.
 */
export function repairPresentation(slides: PresentationSlide[]): RepairResult {
  const actions: RepairAction[] = [];
  const seen = new Set<string>();
  const out: PresentationSlide[] = [];

  slides.forEach((slide) => {
    const title = slide.title || "Без заголовка";
    if (slideIsEmpty(slide)) {
      actions.push({ rule: "empty-slide", slideTitle: title, detail: "Пустой слайд удалён" });
      return;
    }
    const fp = slideFingerprint(slide);
    if (seen.has(fp)) {
      actions.push({ rule: "duplicate-slide", slideTitle: title, detail: "Дубликат слайда удалён" });
      return;
    }
    seen.add(fp);

    let content = { ...slide.content };

    const unique = Array.from(new Set(content.images.filter(Boolean)));
    if (unique.length !== content.images.length) {
      actions.push({ rule: "photo-duplicate", slideTitle: title, detail: "Повторяющиеся фото убраны" });
    }
    if (unique.length > MAX_IMAGES) {
      actions.push({
        rule: "photo-overflow", slideTitle: title,
        detail: `Оставлено первые ${MAX_IMAGES} фото`,
      });
    }
    const images = unique.slice(0, MAX_IMAGES);
    const priority = content.photoPriority.filter((u) => images.includes(u));
    const aspect = Object.fromEntries(
      Object.entries(content.photoAspect).filter(([k]) => images.includes(k)),
    );
    content = { ...content, images, photoPriority: priority, photoAspect: aspect };

    if (images.length && !content.showImage) {
      content.showImage = true;
      actions.push({ rule: "photo-hidden", slideTitle: title, detail: "Включён показ фото" });
    }
    if (!images.length && content.showImage && slide.type === "gallery") {
      content.showImage = false;
      actions.push({ rule: "photo-missing", slideTitle: title, detail: "Показ фото выключен: фото нет" });
    }

    const fixedVariant = slideVariantId(slide.type, content.variant);
    if (fixedVariant !== content.variant) {
      actions.push({
        rule: "unknown-variant", slideTitle: title,
        detail: `Вариант оформления заменён на «${fixedVariant}»`,
      });
      content.variant = fixedVariant;
    }

    let fixed: PresentationSlide = { ...slide, content, position: out.length };

    // Если после нормализации блоки всё ещё вылезают — откатываем ручные
    // сдвиги на безопасный автолейаут.
    if (checkPresentation([fixed]).issues.some((i) => i.code === "out-of-bounds")) {
      fixed = {
        ...fixed,
        content: { ...fixed.content, layout: { ...DEFAULT_LAYOUT_OVERRIDES } },
      };
      actions.push({
        rule: "out-of-bounds", slideTitle: title,
        detail: "Ручные сдвиги сброшены на автоматическую раскладку",
      });
    }

    out.push(fixed);
  });

  const reordered = out.map((s, i) => (s.position === i ? s : { ...s, position: i }));
  if (slides.some((s, i) => s.position !== i)) {
    actions.push({ rule: "order-gap", slideTitle: "—", detail: "Порядок слайдов пересчитан" });
  }

  return { slides: reordered, actions };
}
