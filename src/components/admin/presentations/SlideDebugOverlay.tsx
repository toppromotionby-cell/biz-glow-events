// Режим «Отладка» для слайда: показывает слой-схему (куда встают фото, текст,
// цена и логотипы), подсвечивает пустые зоны и пересечения блоков.
//
// Слой чисто визуальный: не перехватывает клики и не меняет данные слайда.
import type { Rect } from "@/lib/presentations/design";
import { SLIDE_H, SLIDE_W } from "@/lib/presentations/design";
import type { SlideFit } from "@/lib/presentations/fit";
import type { SlideLogoPlan } from "@/lib/presentations/logo-plan";
import type { PresentationSlide } from "@/lib/presentations/model";

type Zone = { label: string; rect: Rect; tone: "ok" | "empty" | "clash" };

const COLORS: Record<Zone["tone"], { border: string; bg: string; text: string }> = {
  ok: { border: "#38bdf8", bg: "rgba(56,189,248,0.10)", text: "#0284c7" },
  empty: { border: "#f59e0b", bg: "rgba(245,158,11,0.14)", text: "#b45309" },
  clash: { border: "#ef4444", bg: "rgba(239,68,68,0.16)", text: "#b91c1c" },
};

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** Собирает зоны слайда с пометками «пусто» и «конфликт». */
export function debugZones(slide: PresentationSlide, fit: SlideFit, plan: SlideLogoPlan): Zone[] {
  const L = fit.layout;
  const zones: Zone[] = [];

  const hasText =
    !!slide.title.trim() || !!slide.subtitle.trim() ||
    !!slide.content.description.trim() || slide.content.includes.length > 0 ||
    slide.content.specs.length > 0;
  zones.push({ label: "Текст", rect: L.textBox, tone: hasText ? "ok" : "empty" });

  L.frames.forEach((rect, i) => {
    const filled = !!L.photos[i];
    zones.push({ label: filled ? `Фото ${i + 1}` : `Фото ${i + 1} — пусто`, rect, tone: filled ? "ok" : "empty" });
  });

  if (L.priceBox) {
    zones.push({
      label: "Цена",
      rect: L.priceBox,
      tone: slide.content.price == null ? "empty" : "ok",
    });
  }

  for (const [key, p] of [["Лого компании", plan.brand], ["Лого клиента", plan.client]] as const) {
    if (!p) continue;
    if (p.slot === "hero" || p.slot === "footer") continue;
    const x = p.slot === "free" ? (p.x ?? 0) : p.slot === "tl" || p.slot === "bl" ? 56 : SLIDE_W - 56 - p.maxW;
    const y = p.slot === "free" ? (p.y ?? 0) : p.slot === "tl" || p.slot === "tr" ? 36 : SLIDE_H - 84 - p.maxH;
    zones.push({ label: key, rect: { x, y, w: p.maxW, h: p.maxH }, tone: "ok" });
  }

  // Конфликты: любые две зоны, которые накладываются друг на друга.
  for (let i = 0; i < zones.length; i += 1) {
    for (let j = i + 1; j < zones.length; j += 1) {
      const a = zones[i]!;
      const b = zones[j]!;
      if (overlaps(a.rect, b.rect)) {
        a.tone = "clash";
        b.tone = "clash";
      }
    }
  }

  // Выход за границы холста тоже конфликт.
  for (const z of zones) {
    if (z.rect.x < 0 || z.rect.y < 0 || z.rect.x + z.rect.w > SLIDE_W + 1 || z.rect.y + z.rect.h > SLIDE_H + 1) {
      z.tone = "clash";
    }
  }

  return zones;
}

export function SlideDebugOverlay({
  slide, fit, plan, scale,
}: {
  slide: PresentationSlide;
  fit: SlideFit;
  plan: SlideLogoPlan;
  scale: number;
}) {
  const zones = debugZones(slide, fit, plan);
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 print:hidden"
      style={{ width: SLIDE_W * scale, height: SLIDE_H * scale }}
    >
      {zones.map((z, i) => {
        const c = COLORS[z.tone];
        return (
          <div
            key={`${z.label}-${i}`}
            style={{
              position: "absolute",
              left: z.rect.x * scale,
              top: z.rect.y * scale,
              width: z.rect.w * scale,
              height: z.rect.h * scale,
              border: `1px dashed ${c.border}`,
              background: c.bg,
            }}
          >
            <span
              style={{
                position: "absolute",
                left: 2,
                top: 2,
                fontSize: 10,
                lineHeight: "12px",
                padding: "0 3px",
                borderRadius: 3,
                background: "rgba(255,255,255,0.85)",
                color: c.text,
                whiteSpace: "nowrap",
              }}
            >
              {z.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
