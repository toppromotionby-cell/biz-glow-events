// Единый рендер слайда презентации 16:9 (1280×720) — используется в
// миниатюрах, крупном предпросмотре и показе. Масштабируется через transform.
// Сетка, кегли и раскладка фото берутся из design.ts / fit.ts, поэтому
// превью, PDF и PPTX выглядят одинаково.
import type { CSSProperties, ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { useResolvedUrl } from "@/components/StorageMedia";
import type { CompanyProfile } from "@/lib/documents/company-profile";
import {
  FONTS, GRID, SLIDE_H, SLIDE_W, slideTheme,
  type Rect, type SlideThemeTokens,
} from "@/lib/presentations/design";
import { fitSlide, type SlideFit } from "@/lib/presentations/fit";
import {
  DEFAULT_PRESENTATION_LOGO_LAYOUT,
  type PresentationLogoLayout,
  type PresentationSlide,
  type PresentationTemplate,
} from "@/lib/presentations/model";
import { fontStacks, resolveDocFont, type DocFontChoice } from "@/lib/documents/doc-font";

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
};

export type SlideBranding = Pick<
  SlideCanvasProps,
  "brandLogoUrl" | "clientLogoUrl" | "logoLayout" | "fontFamily"
>;

/** Позиционирование логотипа в угловом слоте. */
function cornerStyle(slot: LogoSlot): CSSProperties {
  const base: CSSProperties = { position: "absolute" };
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
          <div style={cornerStyle(plan.client.slot)}>
            <Logo path={clientLogo} height={plan.client.maxH} />
          </div>
        )}
        {plan.brand && plan.brand.slot !== "hero" && plan.brand.slot !== "footer" && (
          <div style={cornerStyle(plan.brand.slot)}>
            <Logo path={brandLogo} height={plan.brand.maxH} />
          </div>
        )}
      </div>

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
}: {
  value: string;
  placeholder: string;
  style: CSSProperties;
  onChange?: (v: string) => void;
}) {
  if (!onChange) return <div style={style}>{value || ""}</div>;
  return (
    <div
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
}) {
  const brand = company?.company_brand || company?.company_legal_name || company?.name || "";
  const logo = brandLogo ?? company?.logo_url ?? null;
  const c = slide.content;
  const ts = fit.type;
  const { layout } = fit;
  const heading = { fontFamily: "var(--slide-font-display, " + FONTS.display + ")", letterSpacing: "-0.03em" } as const;

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
        {logo ? <Logo path={logo} height={26} /> : brand ? <span>{brand}</span> : null}
      </div>
      {index !== undefined && total !== undefined && (
        <span>
          {index + 1} / {total}
        </span>
      )}
    </div>
  );

  if (slide.type === "title") {
    const rows = [
      company?.company_website,
      company?.company_phone,
      company?.company_email,
      company?.company_address,
    ].filter((v): v is string => !!v && !!v.trim());
    return (
      <>
        <div
          style={{
            position: "absolute",
            inset: 0,
            padding: `${GRID.marginTop + 24}px ${GRID.marginX + 24}px`,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          {logo ? (
            <Logo path={logo} height={72} />
          ) : brand ? (
            <div style={{ ...heading, fontSize: 30, fontWeight: 700 }}>{brand}</div>
          ) : null}
          <Editable
            value={slide.title || presentationTitle}
            placeholder="Название презентации"
            onChange={onEdit ? (v) => onEdit({ title: v }) : undefined}
            style={{ ...heading, marginTop: 40, fontSize: ts.titleHero, fontWeight: 800, lineHeight: 1.05, maxWidth: 900 }}
          />
          <Editable
            value={slide.subtitle}
            placeholder="Подзаголовок или слоган"
            onChange={onEdit ? (v) => onEdit({ subtitle: v }) : undefined}
            style={{ marginTop: 20, fontSize: ts.subtitle, color: theme.muted, maxWidth: 820 }}
          />
          <div style={{ marginTop: 40, height: 4, width: 120, background: theme.accent, borderRadius: 4 }} />
          {rows.length > 0 && (
            <div style={{ marginTop: 30, display: "flex", flexWrap: "wrap", gap: "10px 28px", fontSize: ts.chip, color: theme.muted }}>
              {rows.map((r) => (
                <span key={r}>{r}</span>
              ))}
            </div>
          )}
          <div style={{ marginTop: 20, fontSize: ts.caption, color: theme.muted }}>
            {new Date().toLocaleDateString("ru-RU")}
          </div>
        </div>
        <div style={{ position: "absolute", right: -160, top: -160, width: 520, height: 520, borderRadius: "50%", background: theme.accent, opacity: 0.12 }} />
      </>
    );
  }

  if (slide.type === "section") {
    return (
      <>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", padding: `0 ${GRID.marginX + 24}px` }}>
          <div style={{ height: 4, width: 88, background: theme.accent, borderRadius: 4, marginBottom: 26 }} />
          <Editable
            value={slide.title}
            placeholder="Название раздела"
            onChange={onEdit ? (v) => onEdit({ title: v }) : undefined}
            style={{ ...heading, fontSize: ts.titleSection, fontWeight: 800 }}
          />
          <Editable
            value={slide.subtitle}
            placeholder="Короткое пояснение"
            onChange={onEdit ? (v) => onEdit({ subtitle: v }) : undefined}
            style={{ marginTop: 16, fontSize: ts.subtitle, color: theme.muted, maxWidth: 860 }}
          />
        </div>
        {footer}
      </>
    );
  }

  if (slide.type === "contacts") {
    const rows: { label: string; value: string }[] = [
      { label: "Телефон", value: company?.company_phone ?? "" },
      { label: "E-mail", value: company?.company_email ?? "" },
      { label: "Сайт", value: company?.company_website ?? "" },
      { label: "Адрес", value: company?.company_address ?? "" },
    ].filter((r) => r.value.trim());
    return (
      <>
        <div style={{ position: "absolute", inset: 0, padding: `${GRID.marginTop + 32}px ${GRID.marginX + 24}px`, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <Editable
            value={slide.title}
            placeholder="Свяжитесь с нами"
            onChange={onEdit ? (v) => onEdit({ title: v }) : undefined}
            style={{ ...heading, fontSize: ts.titleSection, fontWeight: 800 }}
          />
          <Editable
            value={slide.subtitle}
            placeholder="Подзаголовок"
            onChange={onEdit ? (v) => onEdit({ subtitle: v }) : undefined}
            style={{ marginTop: 14, fontSize: ts.subtitle, color: theme.muted }}
          />
          {rows.length > 0 && (
            <div style={{ marginTop: 40, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, maxWidth: 900 }}>
              {rows.map((r) => (
                <div key={r.label} style={{ background: theme.panel, borderRadius: GRID.radius, padding: "20px 24px" }}>
                  <div style={{ fontSize: ts.label, color: theme.muted, textTransform: "uppercase", letterSpacing: 1 }}>{r.label}</div>
                  <div style={{ fontSize: ts.subtitle, fontWeight: 600, marginTop: 6 }}>{r.value}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        {footer}
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
          color: isFullBleed ? "#fff" : theme.ink,
          overflow: "hidden",
        }}
      >
        <Editable
          value={slide.title}
          placeholder={slide.type === "product" ? "Название позиции" : "Заголовок слайда"}
          onChange={onEdit ? (v) => onEdit({ title: v }) : undefined}
          style={{ ...heading, fontSize: ts.titleSlide, fontWeight: 800, lineHeight: 1.1 }}
        />
        <Editable
          value={slide.subtitle}
          placeholder="Подзаголовок"
          onChange={onEdit ? (v) => onEdit({ subtitle: v }) : undefined}
          style={{ marginTop: 8, fontSize: ts.subtitle, color: isFullBleed ? "rgba(255,255,255,0.82)" : theme.muted }}
        />
        {!isFullBleed && (
          <div style={{ marginTop: 18, height: 3, width: 64, background: theme.accent, borderRadius: 3 }} />
        )}
        {c.showDescription && c.description.trim() && (
          <div style={{ marginTop: ts.blockGap, fontSize: ts.body, lineHeight: ts.lineGap, whiteSpace: "pre-wrap" }}>
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
                <li key={k} style={{ display: "flex", gap: 10, marginBottom: 6 }}>
                  <span style={{ color: theme.accent }}>•</span>
                  <span>{i}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {c.showSpecs && c.specs.length > 0 && (
          <div style={{ marginTop: ts.blockGap, display: "flex", flexWrap: "wrap", gap: 10 }}>
            {c.specs.map((s, k) => (
              <div key={k} style={{ background: theme.panel, borderRadius: 12, padding: "9px 14px", fontSize: ts.chip }}>
                <span style={{ color: theme.muted }}>{s.label}: </span>
                <span style={{ fontWeight: 600 }}>{s.value}</span>
              </div>
            ))}
          </div>
        )}
        {c.showPrice && c.price != null && c.price > 0 && (
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
      {footer}
    </>
  );
}

export function SlideFrame({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}
