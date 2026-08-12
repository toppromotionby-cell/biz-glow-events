// Интерактивный слой поверх слайда в редакторе: перетаскивание и масштабирование
// фотоблока, текста, блока цены и логотипов по «умным зонам».
// Логика как в Canva: блок «летит» за курсором, подсвечивается ровно одна цель,
// а слайд пересобирается прямо во время перетаскивания — что видишь, то и получишь.
// Все изменения — это входные параметры автораскладки (design.ts), поэтому
// остальные элементы перестраиваются автоматически и не перекрывают друг друга.
import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { GRID, SLIDE_H, SLIDE_W, type Rect } from "@/lib/presentations/design";
import type { SlideFit } from "@/lib/presentations/fit";
import type { SlideLogoPlan } from "@/lib/presentations/logo-plan";
import {
  PHOTO_SCALE_MAX, PHOTO_SCALE_MIN, TEXT_WIDTH_MAX, TEXT_WIDTH_MIN, clampNum,
  type SlideLayoutOverrides,
} from "@/lib/presentations/model";
import { logoZones, nearestZone, photoZones, priceZones, textZones, type ZoneDef } from "@/lib/presentations/zones";

type Kind = "photo" | "text" | "price" | "brand" | "client";

export type SlideLayoutOverlayProps = {
  fit: SlideFit;
  plan: SlideLogoPlan;
  overrides: SlideLayoutOverrides;
  scale: number;
  onLayout: (patch: Partial<SlideLayoutOverrides>) => void;
};

const LOGO_RECTS: Record<string, Rect> = Object.fromEntries(
  logoZones().map((z) => [z.id, z.rect]),
);

function logoRect(slot: string): Rect | null {
  if (slot === "hero") return { x: GRID.marginX, y: GRID.marginTop, w: 320, h: 80 };
  return LOGO_RECTS[slot] ?? null;
}

export function SlideLayoutOverlay({ fit, plan, overrides, scale, onLayout }: SlideLayoutOverlayProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState<Kind | null>(null);
  const [zone, setZone] = useState<string | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const grab = useRef({ dx: 0, dy: 0 });

  const zonesFor = (kind: Kind): ZoneDef<string>[] => {
    if (kind === "photo") return photoZones() as ZoneDef<string>[];
    if (kind === "text") return textZones() as ZoneDef<string>[];
    if (kind === "price") return priceZones() as ZoneDef<string>[];
    return logoZones() as ZoneDef<string>[];
  };

  const currentZone = (kind: Kind): string | null => {
    if (kind === "photo") return overrides.photoZone === "auto" ? null : overrides.photoZone;
    if (kind === "text") return overrides.textZone === "auto" ? null : overrides.textZone;
    if (kind === "price") return overrides.priceZone === "auto" ? null : overrides.priceZone;
    const o = kind === "brand" ? overrides.brandLogo : overrides.clientLogo;
    return o.zone === "auto" ? null : o.zone;
  };

  const apply = (kind: Kind, zoneId: string) => {
    if (kind === "photo") onLayout({ photoZone: zoneId as SlideLayoutOverrides["photoZone"] });
    else if (kind === "text") onLayout({ textZone: zoneId as SlideLayoutOverrides["textZone"] });
    else if (kind === "price") onLayout({ priceZone: zoneId as SlideLayoutOverrides["priceZone"] });
    else if (kind === "brand") onLayout({ brandLogo: { ...overrides.brandLogo, zone: zoneId as never } });
    else onLayout({ clientLogo: { ...overrides.clientLogo, zone: zoneId as never } });
  };

  const toCanvas = (e: { clientX: number; clientY: number }) => {
    const host = hostRef.current;
    if (!host) return { x: 0, y: 0 };
    const r = host.getBoundingClientRect();
    return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
  };

  const startDrag = (kind: Kind, rect: Rect) => (e: ReactPointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const p = toCanvas(e);
    grab.current = { dx: p.x - rect.x, dy: p.y - rect.y };
    setDragging(kind);
    setZone(currentZone(kind));
    setGhost({ x: rect.x, y: rect.y, w: rect.w, h: rect.h });
  };

  const onMove = (kind: Kind, rect: Rect) => (e: ReactPointerEvent) => {
    if (dragging !== kind) return;
    const p = toCanvas(e);
    setGhost({ x: p.x - grab.current.dx, y: p.y - grab.current.dy, w: rect.w, h: rect.h });
    const z = nearestZone(zonesFor(kind), p);
    if (z.id !== zone) {
      setZone(z.id);
      // Живое превью: слайд пересобирается сразу, ещё до отпускания.
      apply(kind, z.id);
    }
  };

  const endDrag = (kind: Kind) => (e: ReactPointerEvent) => {
    if (dragging !== kind) return;
    apply(kind, nearestZone(zonesFor(kind), toCanvas(e)).id);
    setDragging(null);
    setZone(null);
    setGhost(null);
  };

  const startResize = (kind: "photo" | "text") => (e: ReactPointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const target = e.target as HTMLElement;
    target.setPointerCapture?.(e.pointerId);
    const move = (ev: PointerEvent) => {
      const p = toCanvas(ev);
      if (kind === "photo") {
        const box = fit.layout.photoBox;
        if (!box) return;
        const raw = fit.layout.placement === "right" ? (SLIDE_W - p.x) / SLIDE_W : p.x / SLIDE_W;
        onLayout({ photoScale: clampNum(raw, PHOTO_SCALE_MIN, PHOTO_SCALE_MAX) });
      } else {
        const box = fit.layout.textBox;
        const base = SLIDE_W - GRID.marginX * 2;
        const raw = (p.x - box.x) / Math.max(120, base - (box.x - GRID.marginX));
        onLayout({ textWidth: clampNum(raw, TEXT_WIDTH_MIN, TEXT_WIDTH_MAX), stretchX: false });
      }
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const items: { kind: Kind; rect: Rect | null; label: string; resizable?: boolean }[] = [
    { kind: "photo", rect: fit.layout.photoBox, label: "Фото", resizable: true },
    { kind: "text", rect: fit.layout.textBox, label: "Текст", resizable: true },
    { kind: "price", rect: fit.layout.priceBox, label: "Цена" },
    { kind: "brand", rect: plan.brand ? logoRect(plan.brand.slot) : null, label: "Логотип" },
    { kind: "client", rect: plan.client ? logoRect(plan.client.slot) : null, label: "Лого клиента" },
  ];

  const px = (v: number) => v * scale;
  const target = dragging ? zonesFor(dragging).find((z) => z.id === zone) : null;

  return (
    <div
      ref={hostRef}
      className="absolute inset-0 print:hidden"
      style={{ width: px(SLIDE_W), height: px(SLIDE_H) }}
    >
      {/* Подсвечивается только та зона, куда попадёт блок. */}
      {target && (
        <div
          className="pointer-events-none absolute flex items-center justify-center rounded-lg border-2 border-primary bg-primary/15 transition-all duration-100"
          style={{
            left: px(target.rect.x),
            top: px(target.rect.y),
            width: px(target.rect.w),
            height: px(target.rect.h),
          }}
        >
          <span className="rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground shadow">
            {target.label}
          </span>
        </div>
      )}

      {/* «Призрак» — блок под курсором. */}
      {ghost && (
        <div
          className="pointer-events-none absolute rounded-md border-2 border-primary/70 bg-background/40"
          style={{ left: px(ghost.x), top: px(ghost.y), width: px(ghost.w), height: px(ghost.h) }}
        />
      )}

      {items.map((it) =>
        it.rect ? (
          <div
            key={it.kind}
            role="button"
            tabIndex={0}
            aria-label={`${it.label}: перетащите в нужную зону`}
            onPointerDown={startDrag(it.kind, it.rect)}
            onPointerMove={onMove(it.kind, it.rect)}
            onPointerUp={endDrag(it.kind)}
            onPointerCancel={() => {
              setDragging(null);
              setZone(null);
              setGhost(null);
            }}
            className={`group absolute cursor-grab rounded-md border border-transparent hover:border-primary/70 hover:bg-primary/5 ${
              dragging === it.kind ? "opacity-40" : ""
            }`}
            style={{
              left: px(it.rect.x),
              top: px(it.rect.y),
              width: px(it.rect.w),
              height: px(it.rect.h),
              touchAction: "none",
            }}
          >
            <span className="pointer-events-none absolute left-1 top-1 rounded bg-background/85 px-1 text-[10px] font-medium text-foreground opacity-0 transition group-hover:opacity-100">
              {it.label}
            </span>
            {it.resizable && (
              <span
                onPointerDown={startResize(it.kind as "photo" | "text")}
                className="absolute -bottom-1.5 -right-1.5 h-3.5 w-3.5 cursor-nwse-resize rounded-full border border-background bg-primary opacity-0 transition group-hover:opacity-100"
                style={{ touchAction: "none" }}
                aria-hidden
              />
            )}
          </div>
        ) : null,
      )}
    </div>
  );
}
