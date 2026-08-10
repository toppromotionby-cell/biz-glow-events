// Единый рендер слайда презентации 16:9 (1280×720) — используется в
// миниатюрах, крупном предпросмотре и печати. Масштабируется через transform.
import type { CSSProperties, ReactNode } from "react";
import { useResolvedUrl } from "@/components/StorageMedia";
import type { CompanyProfile } from "@/lib/documents/company-profile";
import type { PresentationSlide, PresentationTemplate } from "@/lib/presentations/model";

export const SLIDE_W = 1280;
export const SLIDE_H = 720;

type Theme = {
  bg: string;
  panel: string;
  ink: string;
  muted: string;
  accent: string;
  line: string;
  onAccent: string;
};

export function slideTheme(template: PresentationTemplate, accent: string): Theme {
  if (template === "dark") {
    return {
      bg: "#0f1115",
      panel: "rgba(255,255,255,0.06)",
      ink: "#f8fafc",
      muted: "rgba(248,250,252,0.66)",
      accent,
      line: "rgba(255,255,255,0.14)",
      onAccent: "#0f1115",
    };
  }
  if (template === "accent") {
    return {
      bg: `linear-gradient(135deg, ${accent} 0%, #111827 100%)`,
      panel: "rgba(255,255,255,0.12)",
      ink: "#ffffff",
      muted: "rgba(255,255,255,0.78)",
      accent: "#ffffff",
      line: "rgba(255,255,255,0.24)",
      onAccent: accent,
    };
  }
  return {
    bg: "#ffffff",
    panel: "#f7f8fa",
    ink: "#111827",
    muted: "#6b7280",
    accent,
    line: "#e5e7eb",
    onAccent: "#ffffff",
  };
}

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

export type SlideCanvasProps = {
  slide: PresentationSlide;
  company: CompanyProfile | null;
  template: PresentationTemplate;
  presentationTitle: string;
  /** Ширина, в которую вписать слайд (px). */
  width: number;
  index?: number;
  total?: number;
  /** Инлайн-редактирование заголовка и подзаголовка. */
  onEdit?: (patch: Partial<Pick<PresentationSlide, "title" | "subtitle">>) => void;
};

export function SlideCanvas(props: SlideCanvasProps) {
  const { slide, company, template, presentationTitle, width, index, total, onEdit } = props;
  const scale = width / SLIDE_W;
  const theme = slideTheme(template, company?.accent_color || "#FF7500");

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
          fontFamily: "'Inter', system-ui, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <SlideBody
          slide={slide}
          company={company}
          theme={theme}
          presentationTitle={presentationTitle}
          index={index}
          total={total}
          onEdit={onEdit}
        />
      </div>
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
  presentationTitle,
  index,
  total,
  onEdit,
}: {
  slide: PresentationSlide;
  company: CompanyProfile | null;
  theme: Theme;
  presentationTitle: string;
  index?: number;
  total?: number;
  onEdit?: SlideCanvasProps["onEdit"];
}) {
  const brand = company?.company_brand || company?.company_legal_name || company?.name || "";
  const logo = company?.logo_url ?? null;
  const c = slide.content;

  const footer = (
    <div
      style={{
        position: "absolute",
        left: 64,
        right: 64,
        bottom: 32,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        fontSize: 16,
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
        <div style={{ position: "absolute", inset: 0, padding: "88px 96px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          {logo ? (
            <Logo path={logo} height={72} />
          ) : brand ? (
            <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: -0.4 }}>{brand}</div>
          ) : null}
          <Editable
            value={slide.title || presentationTitle}
            placeholder="Название презентации"
            onChange={onEdit ? (v) => onEdit({ title: v }) : undefined}
            style={{ marginTop: 40, fontSize: 64, fontWeight: 800, lineHeight: 1.05, letterSpacing: -1.5, maxWidth: 900 }}
          />
          <Editable
            value={slide.subtitle}
            placeholder="Подзаголовок или слоган"
            onChange={onEdit ? (v) => onEdit({ subtitle: v }) : undefined}
            style={{ marginTop: 20, fontSize: 26, color: theme.muted, maxWidth: 820 }}
          />
          <div style={{ marginTop: 44, height: 4, width: 120, background: theme.accent, borderRadius: 4 }} />
          {rows.length > 0 && (
            <div style={{ marginTop: 32, display: "flex", flexWrap: "wrap", gap: "10px 28px", fontSize: 19, color: theme.muted }}>
              {rows.map((r) => (
                <span key={r}>{r}</span>
              ))}
            </div>
          )}
          <div style={{ marginTop: 22, fontSize: 17, color: theme.muted }}>
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
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 96px" }}>
          <div style={{ height: 4, width: 88, background: theme.accent, borderRadius: 4, marginBottom: 28 }} />
          <Editable
            value={slide.title}
            placeholder="Название раздела"
            onChange={onEdit ? (v) => onEdit({ title: v }) : undefined}
            style={{ fontSize: 56, fontWeight: 800, letterSpacing: -1.2 }}
          />
          <Editable
            value={slide.subtitle}
            placeholder="Короткое пояснение"
            onChange={onEdit ? (v) => onEdit({ subtitle: v }) : undefined}
            style={{ marginTop: 16, fontSize: 24, color: theme.muted, maxWidth: 860 }}
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
        <div style={{ position: "absolute", inset: 0, padding: "96px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <Editable
            value={slide.title}
            placeholder="Свяжитесь с нами"
            onChange={onEdit ? (v) => onEdit({ title: v }) : undefined}
            style={{ fontSize: 54, fontWeight: 800, letterSpacing: -1.2 }}
          />
          <Editable
            value={slide.subtitle}
            placeholder="Подзаголовок"
            onChange={onEdit ? (v) => onEdit({ subtitle: v }) : undefined}
            style={{ marginTop: 14, fontSize: 24, color: theme.muted }}
          />
          {rows.length > 0 && (
            <div style={{ marginTop: 44, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, maxWidth: 900 }}>
              {rows.map((r) => (
                <div key={r.label} style={{ background: theme.panel, borderRadius: 16, padding: "20px 24px" }}>
                  <div style={{ fontSize: 15, color: theme.muted, textTransform: "uppercase", letterSpacing: 1 }}>{r.label}</div>
                  <div style={{ fontSize: 24, fontWeight: 600, marginTop: 6 }}>{r.value}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        {footer}
      </>
    );
  }

  if (slide.type === "text") {
    return (
      <>
        <div style={{ position: "absolute", inset: 0, padding: "88px 96px 120px" }}>
          <Editable
            value={slide.title}
            placeholder="Заголовок слайда"
            onChange={onEdit ? (v) => onEdit({ title: v }) : undefined}
            style={{ fontSize: 46, fontWeight: 800, letterSpacing: -1 }}
          />
          <Editable
            value={slide.subtitle}
            placeholder="Подзаголовок"
            onChange={onEdit ? (v) => onEdit({ subtitle: v }) : undefined}
            style={{ marginTop: 10, fontSize: 22, color: theme.muted }}
          />
          <div style={{ marginTop: 28, height: 3, width: 72, background: theme.accent, borderRadius: 3 }} />
          {c.showDescription && c.description && (
            <div style={{ marginTop: 28, fontSize: 24, lineHeight: 1.5, whiteSpace: "pre-wrap", maxWidth: 1000 }}>
              {c.description}
            </div>
          )}
          {c.showIncludes && c.includes.length > 0 && (
            <ul style={{ marginTop: 24, fontSize: 22, lineHeight: 1.6, paddingLeft: 0, listStyle: "none" }}>
              {c.includes.map((i, k) => (
                <li key={k} style={{ display: "flex", gap: 12, marginBottom: 8 }}>
                  <span style={{ color: theme.accent }}>•</span>
                  <span>{i}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {footer}
      </>
    );
  }

  // product
  const hasImage = c.showImage && !!slide.image_url;
  return (
    <>
      <div style={{ position: "absolute", inset: 0, display: "flex" }}>
        {hasImage && (
          <SlideImage path={slide.image_url} style={{ width: 520, height: SLIDE_H, display: "block" }} />
        )}
        <div style={{ flex: 1, padding: hasImage ? "72px 72px 110px 56px" : "80px 96px 110px", minWidth: 0 }}>
          <Editable
            value={slide.title}
            placeholder="Название позиции"
            onChange={onEdit ? (v) => onEdit({ title: v }) : undefined}
            style={{ fontSize: hasImage ? 40 : 48, fontWeight: 800, letterSpacing: -1, lineHeight: 1.1 }}
          />
          <Editable
            value={slide.subtitle}
            placeholder="Короткий подзаголовок"
            onChange={onEdit ? (v) => onEdit({ subtitle: v }) : undefined}
            style={{ marginTop: 8, fontSize: 20, color: theme.muted }}
          />
          <div style={{ marginTop: 20, height: 3, width: 64, background: theme.accent, borderRadius: 3 }} />
          {c.showDescription && c.description && (
            <div style={{ marginTop: 22, fontSize: 20, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{c.description}</div>
          )}
          {c.showIncludes && c.includes.length > 0 && (
            <div style={{ marginTop: 22 }}>
              <div style={{ fontSize: 15, letterSpacing: 1, textTransform: "uppercase", color: theme.muted }}>Что входит</div>
              <ul style={{ marginTop: 10, fontSize: 19, lineHeight: 1.5, paddingLeft: 0, listStyle: "none" }}>
                {c.includes.slice(0, 8).map((i, k) => (
                  <li key={k} style={{ display: "flex", gap: 10, marginBottom: 6 }}>
                    <span style={{ color: theme.accent }}>•</span>
                    <span>{i}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {c.showSpecs && c.specs.length > 0 && (
            <div style={{ marginTop: 20, display: "flex", flexWrap: "wrap", gap: 12 }}>
              {c.specs.map((s, k) => (
                <div key={k} style={{ background: theme.panel, borderRadius: 12, padding: "10px 16px", fontSize: 17 }}>
                  <span style={{ color: theme.muted }}>{s.label}: </span>
                  <span style={{ fontWeight: 600 }}>{s.value}</span>
                </div>
              ))}
            </div>
          )}
          {c.showPrice && c.price != null && c.price > 0 && (
            <div style={{ marginTop: 26, display: "inline-flex", alignItems: "baseline", gap: 10, background: theme.accent, color: theme.onAccent, borderRadius: 14, padding: "12px 22px" }}>
              <span style={{ fontSize: 28, fontWeight: 800 }}>{money(c.price)}</span>
              <span style={{ fontSize: 16, opacity: 0.85 }}>/ {c.priceUnit}</span>
            </div>
          )}
          {c.sku && (
            <div style={{ marginTop: 14, fontSize: 15, color: theme.muted }}>Артикул: {c.sku}</div>
          )}
        </div>
      </div>
      {footer}
    </>
  );
}

export function SlideFrame({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}
