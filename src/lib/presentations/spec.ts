// Единая точка сборки блоков слайда.
//
// Раньше каждый рендер (канвас редактора и PDF) сам решал, какой генератор
// вызвать для конкретного типа слайда, и параметры расходились — из-за этого
// превью и PDF могли отличаться. Теперь диспетчер один, а рендеры лишь рисуют
// готовый список блоков.
import type { CompanyProfile } from "@/lib/documents/company-profile";
import type { Rect } from "@/lib/presentations/design";
import type { SlideFit } from "@/lib/presentations/fit";
import type { PresentationSlide } from "@/lib/presentations/model";
import { isLayoutSlideType, layoutSlideSpec } from "@/lib/presentations/blocks";
import { contentSlideSpec } from "@/lib/presentations/content-spec";
import { staticSlideSpec, type SpecBlock } from "@/lib/presentations/slide-spec";

export type SlideSpecKind = "layout" | "static" | "content";

export type SlideSpecInput = {
  slide: PresentationSlide;
  fit: SlideFit;
  company: CompanyProfile | null;
  presentationTitle: string;
  /** Название компании для футера. */
  brandName: string;
  /** Размер логотипа в геройском слоте (титульный слайд), если он там есть. */
  heroLogo: { w: number; h: number } | null;
  /** Логотип стоит в футере — генератор оставит под него место. */
  footerLogo: boolean;
  /** Дата на титульном слайде. */
  dateLabel: string;
  index: number;
  total: number;
  /** Области, занятые логотипами: текст их обтекает. */
  reserved?: (Rect | null)[];
};

export type SlideSpecResult = {
  kind: SlideSpecKind;
  blocks: SpecBlock[];
  /** Футер (логотип/название + номер слайда) рисует сам рендер. */
  footer: boolean;
};

/** Собирает блоки слайда любого типа — одинаково для превью, PDF и проверок. */
export function slideSpec(a: SlideSpecInput): SlideSpecResult {
  const { slide, fit } = a;

  if (isLayoutSlideType(slide.type)) {
    return {
      kind: "layout",
      footer: false,
      blocks: layoutSlideSpec({
        slide,
        ts: fit.type,
        brandName: a.brandName,
        footerLogo: a.footerLogo,
        index: a.index,
        total: a.total,
      }),
    };
  }

  if (slide.type === "title" || slide.type === "section" || slide.type === "contacts") {
    return {
      kind: "static",
      footer: slide.type !== "title",
      blocks: staticSlideSpec({
        slide,
        ts: fit.type,
        company: a.company,
        presentationTitle: a.presentationTitle,
        brandName: a.brandName,
        heroLogo: a.heroLogo,
        dateLabel: slide.type === "title" ? a.dateLabel : "",
        layout: fit.layout,
      }),
    };
  }

  return {
    kind: "content",
    footer: false,
    blocks: contentSlideSpec({
      slide,
      fit,
      brandName: a.brandName,
      footerLogo: a.footerLogo,
      index: a.index,
      total: a.total,
      reserved: a.reserved ?? [],
    }),
  };
}
