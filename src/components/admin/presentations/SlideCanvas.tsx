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
import { planSlideLogos, type LogoSlot, type SlideLogoPlan } from "@/lib/presentations/logo-plan";
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

import { fontStacks, resolveDocFont, type DocFontChoice } from "@/lib/documents/doc-font";
import { staticSlideSpec, type SpecBlock } from "@/lib/presentations/slide-spec";


export { SLIDE_W, SLIDE_H, slideTheme };

type Theme = SlideThemeTokens;

function money(n: number): string {
  return `${new Intl.NumberFormat("ru-BY", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)} BYN`;
}

function SlideImage({ path, style }: { path: string | null; style: CSSProperties }) {
  const url = useResolvedUrl(path);
  if (!url) return <div style={{ ...style, background: "rgba(127,127,127,0.12)" }} aria-hidden />;
  return <img src={url} alt="" style={{ ...style, objectFit: "cover" }} />;
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
  heading: CSSProperties;
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
    ...(block.font === "display" ? heading : null),
    ...(block.id ? partAlign(block.id) : null),
  };
  if (block.id && onEdit) {
    const id = block.id;
    return (
      <Editable
        value={block.text}
        placeholder={block.placeholder ?? ""}
        block={id}
        onChange={(v) =>
          onEdit(id === "title" ? { title: v } : id === "subtitle" ? { subtitle: v } : { subtitle: v })
        }
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
  onLayout?: (patch: Partial<SlideLayoutOverrides>) => void;
  /** Выделенный блок — свойства показываются в правой панели редактора. */
  selectedBlock?: BlockKind | null;
  onSelectBlock?: (kind: BlockKind | null) => void;
  /** Двойной клик по тексту — редактор переходит в набор текста. */
  onTextEdit?: (kind: BlockKind) => void;
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

export function SlideCanvas(props: SlideCanvasProps) {
  const { slide, company, template, presentationTitle, width, index, total, showWarnings, onEdit } = props;
  const scale = width / SLIDE_W;
  const theme = slideTheme(template, company?.accent_color || "#FF7500");
  const fit = fitSlide(slide);
  const layout = props.logoLayout ?? DEFAULT_PRESENTATION_LOGO_LAYOUT;
  const stacks = fontStacks(resolveDocFont(props.fontFamily));
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
      style={{ width, height: SLIDE_H * scale, position: "relative", overflow: "hidden" }}
      className="rounded-xl"
    >
      <div
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
  const heading = { fontFamily: "var(--slide-font-display, " + FONTS.display + ")", letterSpacing: "-0.03em" } as const;
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

  if (slide.type === "title" || slide.type === "section" || slide.type === "contacts") {
    const blocks = staticSlideSpec({
      slide,
      ts,
      company,
      presentationTitle,
      brandName: brand,
      heroLogo: heroLogo && plan.brand ? { w: plan.brand.maxW, h: plan.brand.maxH } : null,
      dateLabel: slide.type === "title" ? new Date().toLocaleDateString("ru-RU") : "",
    });
    return (
      <>
        {blocks.map((b, i) => (
          <SpecBlockView
            key={i}
            block={b}
            theme={theme}
            heading={heading}
            logoPath={heroLogo}
            onEdit={onEdit}
            partAlign={partAlign}
          />
        ))}
        {slide.type !== "title" && footer}
      </>
    );
  }


  // Текстовый слайд и слайд позиции: единая раскладка «фото + текст».
  const box = layout.textBox;
  const isFullBleed = layout.placement === "full";

  return (
    <>
      {layout.photos.length > 0 && (
        <PhotoGallery frames={layout.frames} photos={layout.photos} radius={GRID.radius} />
      )}
      {isFullBleed && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(180deg, rgba(0,0,0,0) 45%, rgba(0,0,0,0.72) 100%)",
          }}
        />
      )}
      <div
        style={{
          position: "absolute",
          left: box.x,
          top: box.y,
          width: box.w,
          maxHeight: box.h,
          height: layout.textFill ? box.h : undefined,
          textAlign: layout.textAlignX,
          color: isFullBleed ? "#fff" : theme.ink,
          overflow: "hidden",
        }}
      >
        <Editable
          value={slide.title}
          placeholder={slide.type === "product" ? "Название позиции" : "Заголовок слайда"}
          block="title"
          onChange={onEdit ? (v) => onEdit({ title: v }) : undefined}
          style={{ ...heading, fontSize: ts.titleSlide, fontWeight: 800, lineHeight: 1.1, ...partAlign("title") }}
        />
        <Editable
          value={slide.subtitle}
          placeholder="Подзаголовок"
          block="subtitle"
          onChange={onEdit ? (v) => onEdit({ subtitle: v }) : undefined}
          style={{ marginTop: 8, fontSize: ts.subtitle, color: isFullBleed ? "rgba(255,255,255,0.82)" : theme.muted, ...partAlign("subtitle") }}
        />
        {!isFullBleed && (
          <div
            style={{
              marginTop: 18,
              height: 3,
              width: 64,
              background: theme.accent,
              borderRadius: 3,
              marginLeft: layout.textAlignX === "center" ? "auto" : layout.textAlignX === "right" ? "auto" : 0,
              marginRight: layout.textAlignX === "center" ? "auto" : 0,
            }}
          />
        )}
        {c.showDescription && c.description.trim() && (
          <div data-block="body" style={{ marginTop: ts.blockGap, fontSize: ts.body, lineHeight: ts.lineGap, whiteSpace: "pre-wrap", ...partAlign("body") }}>
            {c.description}
          </div>
        )}
        {c.showIncludes && c.includes.length > 0 && (
          <div style={{ marginTop: ts.blockGap }}>
            {slide.type === "product" && (
              <div style={{ fontSize: ts.label, letterSpacing: 1, textTransform: "uppercase", color: theme.muted }}>
                Что входит
              </div>
            )}
            <ul style={{ marginTop: 10, fontSize: ts.bullet, lineHeight: ts.lineGap, paddingLeft: 0, listStyle: "none" }}>
              {c.includes.map((i, k) => (
                <li
                  key={k}
                  style={{
                    display: "flex",
                    gap: 10,
                    marginBottom: 6,
                    justifyContent:
                      layout.textAlignX === "center" ? "center" : layout.textAlignX === "right" ? "flex-end" : "flex-start",
                    textAlign: layout.textAlignX,
                  }}
                >
                  <span style={{ color: theme.accent }}>•</span>
                  <span>{i}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {c.showSpecs && c.specs.length > 0 && (
          <div
            style={{
              marginTop: ts.blockGap,
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              justifyContent:
                layout.textAlignX === "center" ? "center" : layout.textAlignX === "right" ? "flex-end" : "flex-start",
            }}
          >
            {c.specs.map((s, k) => (
              <div key={k} style={{ background: theme.panel, borderRadius: 12, padding: "9px 14px", fontSize: ts.chip }}>
                <span style={{ color: theme.muted }}>{s.label}: </span>
                <span style={{ fontWeight: 600 }}>{s.value}</span>
              </div>
            ))}
          </div>
        )}
        {c.showPrice && c.price != null && c.price > 0 && !layout.priceBox && (
          <div
            style={{
              marginTop: ts.blockGap,
              display: "inline-flex",
              alignItems: "baseline",
              gap: 10,
              background: theme.accent,
              color: theme.onAccent,
              borderRadius: 14,
              padding: "10px 20px",
            }}
          >
            <span style={{ ...heading, fontSize: ts.stat, fontWeight: 800 }}>{money(c.price)}</span>
            <span style={{ fontSize: ts.caption, opacity: 0.85 }}>/ {c.priceUnit}</span>
          </div>
        )}
        {c.sku && (
          <div style={{ marginTop: 12, fontSize: ts.caption, color: isFullBleed ? "rgba(255,255,255,0.8)" : theme.muted }}>
            Артикул: {c.sku}
          </div>
        )}
      </div>
      {c.showPrice && c.price != null && c.price > 0 && layout.priceBox && (
        <div
          style={{
            position: "absolute",
            left: layout.priceBox.x,
            top: layout.priceBox.y,
            display: "inline-flex",
            alignItems: "baseline",
            gap: 10,
            background: theme.accent,
            color: theme.onAccent,
            borderRadius: 14,
            padding: "10px 20px",
          }}
        >
          <span style={{ ...heading, fontSize: ts.stat, fontWeight: 800 }}>{money(c.price)}</span>
          <span style={{ fontSize: ts.caption, opacity: 0.85 }}>/ {c.priceUnit}</span>
        </div>
      )}
      {footer}
    </>
  );
}

export function SlideFrame({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}
