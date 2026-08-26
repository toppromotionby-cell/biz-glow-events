import { memo, useEffect, useMemo, useState } from "react";
// Единый рендер слайда презентации 16:9 (1280×720) — используется в
// миниатюрах, крупном предпросмотре и показе. Масштабируется через transform.
// Сетка, кегли и раскладка фото берутся из design.ts / fit.ts, поэтому
// превью, PDF и превью выглядят одинаково.
import type { CSSProperties, ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { useResolvedUrl } from "@/components/StorageMedia";
import type { CompanyProfile } from "@/lib/documents/company-profile";
import {
  FONTS, GRID, SLIDE_H, SLIDE_W, slideTheme,
  type Rect, type SlideThemeTokens,
} from "@/lib/presentations/design";
import { fitSlide, type SlideFit } from "@/lib/presentations/fit";
import { planSlideLogos, logoReserveRect, type LogoSlot, type SlideLogoPlan } from "@/lib/presentations/logo-plan";
import {
  DEFAULT_LAYOUT_OVERRIDES,
  DEFAULT_PRESENTATION_LOGO_LAYOUT,
  type PresentationLogoLayout,
  type SlideLayoutOverrides,
  type PresentationSlide,
  type PresentationTemplate,
} from "@/lib/presentations/model";
import { SlideLayoutOverlay } from "@/components/admin/presentations/SlideLayoutOverlay";
import type { BlockKind } from "@/components/admin/presentations/BlockToolbar";

import { fontStacks, needsBodyFallback, resolveDocFont, type DocFont, type DocFontChoice } from "@/lib/documents/doc-font";
import { staticSlideSpec, type SpecBlock, type SpecPaint } from "@/lib/presentations/slide-spec";
import { contentSlideSpec } from "@/lib/presentations/content-spec";
import { isLayoutSlideType, layoutSlideSpec } from "@/lib/presentations/blocks";
import {
  cssObjectPosition, type PhotoAnchor, type PhotoFit,
} from "@/lib/presentations/photo-fit";


export { SLIDE_W, SLIDE_H, slideTheme };

type Theme = SlideThemeTokens;

function money(n: number): string {
  return `${new Intl.NumberFormat("ru-BY", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)} BYN`;
}

function SlideImage({ path, style, fit = "cover", anchor = "center", alt = "" }: {
  path: string | null;
  style: CSSProperties;
  fit?: PhotoFit;
  anchor?: PhotoAnchor;
  alt?: string;
}) {
  const url = useResolvedUrl(path);
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [url]);
  if (!url || failed) {
    return (
      <div
        style={{
          ...style,
          background: "rgba(127,127,127,0.12)",
          border: failed ? "1px dashed rgba(127,127,127,0.45)" : undefined,
        }}
        aria-hidden
      />
    );
  }
  return (
    <img
      src={url}
      alt={alt}
      title={alt || undefined}
      onError={() => setFailed(true)}
      style={{ ...style, objectFit: fit, objectPosition: cssObjectPosition(anchor) }}
    />
  );
}

function Logo({ path, height }: { path: string | null; height: number }) {
  const url = useResolvedUrl(path);
  if (!url) return null;
  return <img src={url} alt="" style={{ height, width: "auto", objectFit: "contain" }} />;
}

/** Рендер одного блока общего спека слайда. */
function SpecBlockView({
  block,
  theme,
  heading,
  logoPath,
  onEdit,
  partAlign,
}: {
  block: SpecBlock;
  theme: SlideThemeTokens;
  heading: (text: string) => CSSProperties | null;
  logoPath: string | null;
  onEdit?: SlideCanvasProps["onEdit"];
  partAlign: (part: "title" | "subtitle" | "body") => CSSProperties;
}) {
  const paint = (c: SpecPaint): string =>
    c === "ink" ? theme.ink
      : c === "muted" ? theme.muted
        : c === "accent" ? theme.accent
          : c === "onAccent" ? theme.onAccent
            : c === "onPhoto" ? "#fff"
              : c === "onPhotoMuted" ? "rgba(255,255,255,0.82)"
                : theme.panel;

  if (block.kind === "shade") {
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(180deg, rgba(0,0,0,0) ${block.from * 100}%, rgba(0,0,0,${block.alpha}) 100%)`,
        }}
      />
    );
  }
  if (block.kind === "image") {
    return (
      <SlideImage
        path={block.path}
        fit={block.fit}
        anchor={block.anchor}
        alt={block.alt}
        style={{
          position: "absolute",
          left: block.x,
          top: block.y,
          width: block.w,
          height: block.h,
          borderRadius: block.radius,
          display: "block",
        }}
      />
    );
  }
  if (block.kind === "circle") {
    return (
      <div
        style={{
          position: "absolute",
          left: block.cx - block.r,
          top: block.cy - block.r,
          width: block.r * 2,
          height: block.r * 2,
          borderRadius: "50%",
          background: paint(block.color),
          opacity: block.opacity,
        }}
      />
    );
  }
  if (block.kind === "rect") {
    return (
      <div
        style={{
          position: "absolute",
          left: block.x,
          top: block.y,
          width: block.w,
          height: block.h,
          borderRadius: block.radius,
          background: paint(block.color),
          opacity: block.opacity ?? 1,
        }}
      />
    );
  }
  if (block.kind === "logo") {
    return (
      <div data-block="brandLogo" style={{ position: "absolute", left: block.x, top: block.y }}>
        <Logo path={logoPath} height={block.h} />
      </div>
    );
  }

  const style: CSSProperties = {
    position: "absolute",
    left: block.x,
    top: block.y,
    width: block.w,
    fontSize: block.size,
    lineHeight: block.lineHeight,
    fontWeight: block.weight,
    color: paint(block.color),
    textAlign: block.align,
    textTransform: block.uppercase ? "uppercase" : undefined,
    letterSpacing: block.letterSpacing,
    whiteSpace: "pre-wrap",
    ...(block.font === "display" ? heading(block.text) : null),
    ...(block.id ? partAlign(block.id) : null),
  };
  // Прямо в холсте правятся только заголовок и подзаголовок; описание —
  // многострочный текст, он редактируется в панели содержимого слайда.
  if (onEdit && (block.id === "title" || block.id === "subtitle")) {
    const id = block.id;
    return (
      <Editable
        value={block.text}
        placeholder={block.placeholder ?? ""}
        block={id}
        onChange={(v) => onEdit(id === "title" ? { title: v } : { subtitle: v })}
        style={style}
      />
    );
  }
  const content = block.lines ? block.lines.join("\n") : block.text;
  return <div data-block={block.id} style={style}>{content}</div>;
}



function PhotoGallery({ frames, photos, radius }: { frames: Rect[]; photos: string[]; radius: number }) {
  return (
    <>
      {photos.map((p, i) => {
        const f = frames[i];
        if (!f) return null;
        return (
          <SlideImage
            key={`${p}-${i}`}
            path={p}
            style={{
              position: "absolute",
              left: f.x,
              top: f.y,
              width: f.w,
              height: f.h,
              borderRadius: f.x === 0 || f.w >= SLIDE_W ? 0 : radius,
              display: "block",
            }}
          />
        );
      })}
    </>
  );
}

export type SlideCanvasProps = {
  slide: PresentationSlide;
  company: CompanyProfile | null;
  template: PresentationTemplate;
  presentationTitle: string;
  /** Ширина, в которую вписать слайд (px). */
  width: number;
  index?: number;
  total?: number;
  /** Показывать значок предупреждения о переполнении (только в редакторе). */
  showWarnings?: boolean;
  /** Инлайн-редактирование заголовка и подзаголовка. */
  onEdit?: (patch: Partial<Pick<PresentationSlide, "title" | "subtitle">>) => void;
  /** Логотип компании (переопределяет логотип из профиля). */
  brandLogoUrl?: string | null;
  /** Логотип клиента — накладывается автоматически. */
  clientLogoUrl?: string | null;
  logoLayout?: PresentationLogoLayout;
  /** Шрифт презентации. */
  fontFamily?: DocFontChoice;
  /** Режим редактора: перетаскивание и масштабирование элементов слайда. */
  interactive?: boolean;
  onLayout?: import("@/components/admin/presentations/SlideLayoutOverlay").LayoutPatch;
  /** Выделенный блок — свойства показываются в правой панели редактора. */
  selectedBlock?: BlockKind | null;
  onSelectBlock?: (kind: BlockKind | null) => void;
  /** Двойной клик по тексту — редактор переходит в набор текста. */
  onTextEdit?: (kind: BlockKind) => void;
  /** Двойной клик по фото, цене или логотипу — окно с данными блока. */
  onBlockEdit?: (kind: BlockKind) => void;
  /** Пока идёт набор текста, слой перетаскивания не перехватывает клики. */
  textEditing?: boolean;
  /** Плавающая панель блока (мобильный режим — свойств справа нет). */
  floatingToolbar?: boolean;
};


export type SlideBranding = Pick<
  SlideCanvasProps,
  "brandLogoUrl" | "clientLogoUrl" | "logoLayout" | "fontFamily"
>;

/** Позиционирование логотипа в угловом слоте. */
function logoStyle(p: { slot: LogoSlot; x?: number; y?: number }): CSSProperties {
  const base: CSSProperties = { position: "absolute" };
  // Свободная позиция (логотип перетащили мышью) — абсолютные координаты холста.
  if (p.slot === "free") return { ...base, left: p.x ?? 0, top: p.y ?? 0 };
  const slot = p.slot;
  if (slot === "tl") return { ...base, top: 36, left: 56 };
  if (slot === "tr") return { ...base, top: 36, right: 56 };
  if (slot === "bl") return { ...base, bottom: 84, left: 56 };
  return { ...base, bottom: 84, right: 56 };
}

function SlideCanvasInner(props: SlideCanvasProps) {
  const { slide, company, template, presentationTitle, width, index, total, showWarnings, onEdit } = props;
  const scale = width / SLIDE_W;
  const accent = company?.accent_color || "#FF7500";
  const theme = useMemo(
    () => slideTheme(template, accent, slide.content.background),
    [template, accent, slide.content.background],
  );
  const fit = useMemo(() => fitSlide(slide), [slide]);
  const layout = props.logoLayout ?? DEFAULT_PRESENTATION_LOGO_LAYOUT;
  const docFont = resolveDocFont(props.fontFamily);
  const stacks = useMemo(() => fontStacks(docFont), [docFont]);
  const brandLogo = props.brandLogoUrl ?? company?.logo_url ?? null;
  const clientLogo = props.clientLogoUrl ?? null;
  const plan = planSlideLogos({
    slideType: slide.type,
    frames: fit.layout.frames,
    placement: fit.layout.placement,
    layout,
    hasBrandLogo: !!brandLogo,
    hasClientLogo: !!clientLogo,
    overrides: slide.content.layout ?? DEFAULT_LAYOUT_OVERRIDES,
    blocked: [fit.layout.textBox, fit.layout.priceBox].filter(Boolean) as Rect[],
  });

  return (
    <div
      data-slide-root=""
      style={{ width, height: SLIDE_H * scale, position: "relative", overflow: "hidden" }}
      className="rounded-xl"
    >
      <div
        data-slide-inner=""
        style={{
          width: SLIDE_W,
          height: SLIDE_H,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          background: theme.bg,
          color: theme.ink,
          fontFamily: stacks.body,
          ["--slide-font-display" as string]: stacks.display,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <SlideBody
          docFont={docFont}
          slide={slide}
          company={company}
          theme={theme}
          fit={fit}
          presentationTitle={presentationTitle}
          index={index}
          total={total}
          onEdit={onEdit}
          brandLogo={brandLogo}
          plan={plan}
        />
        {plan.client && plan.client.slot !== "hero" && plan.client.slot !== "footer" && (
          <div data-block="clientLogo" style={logoStyle(plan.client)}>
            <Logo path={clientLogo} height={plan.client.maxH} />
          </div>
        )}
        {plan.brand && plan.brand.slot !== "hero" && plan.brand.slot !== "footer" && (
          <div data-block="brandLogo" style={logoStyle(plan.brand)}>
            <Logo path={brandLogo} height={plan.brand.maxH} />
          </div>
        )}
      </div>

      {props.interactive && props.onLayout && (
        <div style={{ pointerEvents: props.textEditing ? "none" : undefined }}>
          <SlideLayoutOverlay
            fit={fit}
            plan={plan}
            overrides={slide.content.layout ?? DEFAULT_LAYOUT_OVERRIDES}
            scale={scale}
            onLayout={props.onLayout}
            selected={props.selectedBlock}
            onSelect={props.onSelectBlock}
            onTextEdit={props.onTextEdit}
            onBlockEdit={props.onBlockEdit}
            floatingToolbar={props.floatingToolbar}
          />
        </div>
      )}


      {showWarnings && fit.warnings.length > 0 && (
        <div
          className="absolute right-2 top-2 flex items-center gap-1.5 rounded-md bg-amber-500 px-2 py-1 text-[11px] font-medium text-black shadow print:hidden"
          title={fit.warnings.join("\n")}
        >
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
          {fit.warnings.length}
        </div>
      )}
    </div>
  );
}

function Editable({
  value,
  placeholder,
  style,
  onChange,
  block,
}: {
  value: string;
  placeholder: string;
  style: CSSProperties;
  onChange?: (v: string) => void;
  /** Идентификатор блока для выделения двойным кликом в режиме раскладки. */
  block?: string;
}) {
  if (!onChange) return <div data-block={block} style={style}>{value || ""}</div>;
  return (
    <div
      data-block={block}
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder}
      onBlur={(e) => onChange(e.currentTarget.textContent ?? "")}
      style={{ ...style, outline: "none", minHeight: 8 }}
      className="focus:bg-black/[0.04]"
    >
      {value}
    </div>
  );
}

function SlideBody({
  docFont,
  slide,
  company,
  theme,
  fit,
  presentationTitle,
  index,
  total,
  onEdit,
  brandLogo,
  plan,
}: {
  docFont: DocFont;
  slide: PresentationSlide;
  company: CompanyProfile | null;
  theme: Theme;
  fit: SlideFit;
  presentationTitle: string;
  index?: number;
  total?: number;
  onEdit?: SlideCanvasProps["onEdit"];
  brandLogo?: string | null;
  plan: SlideLogoPlan;
}) {
  const brand = company?.company_brand || company?.company_legal_name || company?.name || "";
  const logo = brandLogo ?? company?.logo_url ?? null;
  const footerLogo = plan.brand?.slot === "footer" ? logo : null;
  const heroLogo = plan.brand?.slot === "hero" ? logo : null;
  const c = slide.content;
  const ts = fit.type;
  const { layout } = fit;
  // Кириллицы нет в фирменном display-шрифте — такие заголовки рисуем
  // основным шрифтом, чтобы превью совпадало с PDF (там та же подмена).
  const headingStyle: CSSProperties = {
    fontFamily: "var(--slide-font-display, " + FONTS.display + ")",
    letterSpacing: "-0.03em",
  };
  const heading = (text: string): CSSProperties | null =>
    needsBodyFallback(docFont, text) ? { fontWeight: 700 } : headingStyle;
  // Выравнивание отдельных частей текста (Canva-подобно): auto = как у блока.
  const ov = slide.content.layout ?? DEFAULT_LAYOUT_OVERRIDES;
  const partAlign = (part: "title" | "subtitle" | "body"): CSSProperties => {
    const v = part === "title" ? ov.titleAlignX : part === "subtitle" ? ov.subtitleAlignX : ov.bodyAlignX;
    return v === "auto" ? {} : { textAlign: v };
  };

  const footer = (
    <div
      style={{
        position: "absolute",
        left: GRID.marginX,
        right: GRID.marginX,
        bottom: 28,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        fontSize: ts.caption,
        color: theme.muted,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {footerLogo ? (
          <Logo path={footerLogo} height={plan.brand?.maxH ?? 26} />
        ) : brand ? (
          <span>{brand}</span>
        ) : null}
      </div>
      {index !== undefined && total !== undefined && (
        <span>
          {index + 1} / {total}
        </span>
      )}
    </div>
  );

  // Один диспетчер на превью и PDF: расхождения между ними невозможны.
  const spec = slideSpec({
    slide,
    fit,
    company,
    presentationTitle,
    brandName: brand,
    heroLogo: heroLogo && plan.brand ? { w: plan.brand.maxW, h: plan.brand.maxH } : null,
    footerLogo: !!footerLogo,
    dateLabel: new Date().toLocaleDateString("ru-RU"),
    index: index ?? 0,
    total: total ?? 1,
    reserved: [logoReserveRect(plan.client), logoReserveRect(plan.brand)],
  });

  return (
    <>
      {spec.blocks.map((b, i) => (
        <SpecBlockView
          key={i}
          block={b}
          theme={theme}
          heading={heading}
          logoPath={spec.kind === "static" ? heroLogo : null}
          onEdit={onEdit}
          partAlign={partAlign}
        />
      ))}
      {spec.footer && footer}
      {spec.kind === "content" && footerLogo && (
        <div style={{ position: "absolute", left: GRID.marginX, bottom: 28 }}>
          <Logo path={footerLogo} height={plan.brand?.maxH ?? 26} />
        </div>
      )}
    </>
  );
}

export function SlideFrame({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}

/** Мемоизация: миниатюры и соседние слайды не пересобираются при правке одного. */
export const SlideCanvas = memo(SlideCanvasInner);
