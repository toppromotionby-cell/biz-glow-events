// Интерактивный слой поверх слайда в редакторе: перетаскивание и масштабирование
// фотоблока, текста, блока цены и логотипов по «умным зонам».
// Логика как в Canva: блок «летит» за курсором, подсвечивается ровно одна цель,
// а слайд пересобирается прямо во время перетаскивания — что видишь, то и получишь.
// Все изменения — это входные параметры автораскладки (design.ts), поэтому
// остальные элементы перестраиваются автоматически и не перекрывают друг друга.
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { BlockToolbar, BLOCK_LABELS, type BlockKind } from "@/components/admin/presentations/BlockToolbar";
import { GRID, SLIDE_H, SLIDE_W, type Rect } from "@/lib/presentations/design";
import type { SlideFit } from "@/lib/presentations/fit";
import type { SlideLogoPlan } from "@/lib/presentations/logo-plan";
import { snapRect, type Guide } from "@/lib/presentations/snap";
import {
  LOGO_SCALE_MAX, LOGO_SCALE_MIN, PHOTO_SCALE_MAX, PHOTO_SCALE_MIN,
  PRICE_SCALE_MAX, PRICE_SCALE_MIN, TEXT_WIDTH_MAX, TEXT_WIDTH_MIN, clampNum,
  type SlideLayoutOverrides,
} from "@/lib/presentations/model";
import { logoZones, nearestZone, photoZones, priceZones, textZones, type ZoneDef } from "@/lib/presentations/zones";

type Kind = BlockKind;

export type SlideLayoutOverlayProps = {
  fit: SlideFit;
  plan: SlideLogoPlan;
  overrides: SlideLayoutOverrides;
  scale: number;
  onLayout: (patch: Partial<SlideLayoutOverrides>) => void;
  /** Выделенный блок (управляется извне — панель свойств справа). */
  selected?: Kind | null;
  onSelect?: (kind: Kind | null) => void;
  /** Двойной клик по тексту — редактор просит переключиться в набор текста. */
  onTextEdit?: (kind: Kind) => void;
  /** Показывать плавающую панель блока (на десктопе свойства живут справа). */
  floatingToolbar?: boolean;
};


const LOGO_RECTS: Record<string, Rect> = Object.fromEntries(
  logoZones().map((z) => [z.id, z.rect]),
);

function logoRect(place: { slot: string; x?: number; y?: number; maxW: number; maxH: number } | null): Rect | null {
  if (!place) return null;
  // Свободное положение — рамка ровно по логотипу.
  if (place.slot === "free") {
    return { x: place.x ?? 0, y: place.y ?? 0, w: place.maxW, h: place.maxH };
  }
  if (place.slot === "hero") return { x: GRID.marginX, y: GRID.marginTop, w: 320, h: 80 };
  return LOGO_RECTS[place.slot] ?? null;
}

/** data-block из превью → тип блока для панели настроек. */
const BLOCK_BY_ATTR: Record<string, Kind> = {
  title: "title",
  subtitle: "subtitle",
  body: "body",
  brandLogo: "brand",
  clientLogo: "client",
};

export function SlideLayoutOverlay({
  fit, plan, overrides, scale, onLayout,
  selected: selectedProp, onSelect, onTextEdit, floatingToolbar,
}: SlideLayoutOverlayProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState<Kind | null>(null);
  const [zone, setZone] = useState<string | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [ownSelected, setOwnSelected] = useState<Kind | null>(null);
  const [guides, setGuides] = useState<Guide[]>([]);
  const selected = selectedProp !== undefined ? selectedProp : ownSelected;
  const setSelected = (kind: Kind | null) => {
    setOwnSelected(kind);
    onSelect?.(kind);
  };
  // Рамка для «текстовых» блоков, выбранных двойным кликом (координаты холста).
  const [partRect, setPartRect] = useState<Rect | null>(null);
  const grab = useRef({ dx: 0, dy: 0 });
  const moved = useRef(false);

  // Esc снимает выделение, стрелки двигают логотип на 1 px (Shift — на 10) — как в Canva.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelected(null);
        setPartRect(null);
        return;
      }
      const nudge: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
      };
      const step = nudge[e.key];
      if (!step || (selected !== "brand" && selected !== "client")) return;
      const target = e.target as HTMLElement | null;
      if (target?.isContentEditable || /^(INPUT|TEXTAREA)$/.test(target?.tagName ?? "")) return;
      e.preventDefault();
      const k = e.shiftKey ? 10 : 1;
      const key = selected === "brand" ? "brandLogo" : "clientLogo";
      const cur = overrides[key];
      const base = selected === "brand" ? plan.brand : plan.client;
      const from = cur.pos ?? {
        x: (base?.x ?? 0) / SLIDE_W,
        y: (base?.y ?? 0) / SLIDE_H,
      };
      onLayout({
        [key]: {
          ...cur,
          zone: "auto",
          pos: {
            x: clampNum(from.x + (step[0] * k) / SLIDE_W, 0, 1),
            y: clampNum(from.y + (step[1] * k) / SLIDE_H, 0, 1),
          },
        },
      } as Partial<SlideLayoutOverrides>);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, overrides, plan, onLayout]);


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

  const isLogo = (kind: Kind): kind is "brand" | "client" => kind === "brand" || kind === "client";

  /** Свободное перемещение логотипа: доли холста 1280×720. */
  const moveLogoFree = (kind: "brand" | "client", x: number, y: number) => {
    const key = kind === "brand" ? "brandLogo" : "clientLogo";
    const cur = overrides[key];
    onLayout({
      [key]: { ...cur, zone: "auto", pos: { x: clampNum(x / SLIDE_W, 0, 1), y: clampNum(y / SLIDE_H, 0, 1) } },
    } as Partial<SlideLayoutOverrides>);
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
    moved.current = false;
    setSelected(kind);
    setDragging(kind);
    setZone(currentZone(kind));
    setGhost({ x: rect.x, y: rect.y, w: rect.w, h: rect.h });
  };

  /** Соседние блоки для магнитных направляющих. */
  const neighbors = (kind: Kind): Rect[] =>
    [fit.layout.textBox, fit.layout.photoBox, fit.layout.priceBox].filter(
      (r): r is Rect => !!r && !(kind === "text" && r === fit.layout.textBox),
    );

  const onMove = (kind: Kind, rect: Rect) => (e: ReactPointerEvent) => {
    if (dragging !== kind) return;
    const p = toCanvas(e);
    moved.current = true;
    const nx = p.x - grab.current.dx;
    const ny = p.y - grab.current.dy;
    // Логотип двигается свободно с магнитом к направляющим — как в Canva.
    if (isLogo(kind)) {
      const snapped = snapRect({ x: nx, y: ny, w: rect.w, h: rect.h }, neighbors(kind));
      setGhost({ x: snapped.x, y: snapped.y, w: rect.w, h: rect.h });
      setGuides(snapped.guides);
      moveLogoFree(kind, snapped.x, snapped.y);
      return;
    }
    setGhost({ x: nx, y: ny, w: rect.w, h: rect.h });
    const z = nearestZone(zonesFor(kind), p);
    if (z.id !== zone) {
      setZone(z.id);
      // Живое превью: слайд пересобирается сразу, ещё до отпускания.
      apply(kind, z.id);
    }
  };

  const endDrag = (kind: Kind) => (e: ReactPointerEvent) => {
    if (dragging !== kind) return;
    // Простой клик без перетаскивания = выделение блока, зона не меняется.
    if (moved.current && !isLogo(kind)) apply(kind, nearestZone(zonesFor(kind), toCanvas(e)).id);
    if (moved.current && isLogo(kind) && ghost) moveLogoFree(kind, ghost.x, ghost.y);
    setDragging(null);
    setZone(null);
    setGhost(null);
    setGuides([]);
  };


  /** Какие блоки можно масштабировать и какой параметр за это отвечает. */
  type ResizeKind = "photo" | "text" | "price" | "brand" | "client";
  const isResizable = (k: Kind): k is ResizeKind =>
    k === "photo" || k === "text" || k === "price" || k === "brand" || k === "client";

  const scaleOf = (kind: ResizeKind): number => {
    if (kind === "photo") return overrides.photoScale ?? 1;
    if (kind === "text") return overrides.textWidth ?? 1;
    if (kind === "price") return overrides.priceScale ?? 1;
    return (kind === "brand" ? overrides.brandLogo : overrides.clientLogo).scale ?? 1;
  };

  const applyScale = (kind: ResizeKind, value: number) => {
    if (kind === "photo") {
      onLayout({ photoScale: clampNum(value, PHOTO_SCALE_MIN, PHOTO_SCALE_MAX) });
    } else if (kind === "text") {
      onLayout({ textWidth: clampNum(value, TEXT_WIDTH_MIN, TEXT_WIDTH_MAX), stretchX: false });
    } else if (kind === "price") {
      onLayout({ priceScale: clampNum(value, PRICE_SCALE_MIN, PRICE_SCALE_MAX) });
    } else {
      const key = kind === "brand" ? "brandLogo" : "clientLogo";
      const cur = overrides[key];
      onLayout({
        [key]: { ...cur, scale: clampNum(value, LOGO_SCALE_MIN, LOGO_SCALE_MAX) },
      } as Partial<SlideLayoutOverrides>);
    }
  };

  /**
   * Масштабирование от маркера рамки (как в Canva): считаем смещение курсора
   * относительно точки захвата, а не абсолютную позицию — блок не «прыгает».
   * Горизонтальные маркеры тянут по ширине, вертикальные — по высоте,
   * угловые берут больший из двух коэффициентов.
   */
  const startHandleResize = (kind: ResizeKind, handle: string, rect: Rect) =>
    (e: ReactPointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const start = toCanvas(e);
      const startScale = scaleOf(kind);
      const w0 = Math.max(24, rect.w);
      const h0 = Math.max(24, rect.h);
      const sx = handle.includes("w") ? -1 : handle.includes("e") ? 1 : 0;
      const sy = handle.includes("n") ? -1 : handle.includes("s") ? 1 : 0;

      const move = (ev: PointerEvent) => {
        const p = toCanvas(ev);
        const dw = sx * (p.x - start.x) * (ev.altKey ? 2 : 1);
        const dh = sy * (p.y - start.y) * (ev.altKey ? 2 : 1);
        const kx = sx ? (w0 + dw) / w0 : 0;
        const ky = sy ? (h0 + dh) / h0 : 0;
        const k = sx && sy
          ? Math.max(kx, ky)
          : sx ? kx : ky;
        if (!Number.isFinite(k) || k <= 0) return;
        applyScale(kind, startScale * k);
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
    { kind: "price", rect: fit.layout.priceBox, label: "Цена", resizable: true },
    { kind: "brand", rect: logoRect(plan.brand), label: "Логотип", resizable: true },
    { kind: "client", rect: logoRect(plan.client), label: "Лого клиента", resizable: true },
  ];

  const px = (v: number) => v * scale;
  const target = dragging ? zonesFor(dragging).find((z) => z.id === zone) : null;
  const selectedItem = selected ? items.find((it) => it.kind === selected && it.rect) : null;
  const selRect = selectedItem?.rect ?? partRect;

  /**
   * Двойной клик: определяем реальный элемент под курсором (заголовок,
   * подзаголовок, описание, логотип) и выделяем именно его — как в Canva.
   * Для текстовых блоков сразу отдаём управление набору текста.
   */
  const onDoubleClick = (e: { clientX: number; clientY: number; stopPropagation: () => void }) => {
    const host = hostRef.current;
    if (!host) return;
    const el = document
      .elementsFromPoint(e.clientX, e.clientY)
      .find((n) => (n as HTMLElement).dataset?.block) as HTMLElement | undefined;
    const kind = el ? BLOCK_BY_ATTR[el.dataset.block ?? ""] : undefined;
    if (!kind) return;
    e.stopPropagation();
    const hr = host.getBoundingClientRect();
    const r = el!.getBoundingClientRect();
    setSelected(kind);
    setPartRect(
      kind === "brand" || kind === "client"
        ? null
        : { x: (r.left - hr.left) / scale, y: (r.top - hr.top) / scale, w: r.width / scale, h: r.height / scale },
    );
    if (kind === "title" || kind === "subtitle" || kind === "body") onTextEdit?.(kind);
  };

  /** Восемь маркеров рамки выделения — как в Canva. */
  const HANDLES: { key: string; style: string; cursor: string }[] = [
    { key: "nw", style: "-left-1.5 -top-1.5", cursor: "nwse-resize" },
    { key: "n", style: "left-1/2 -top-1.5 -translate-x-1/2", cursor: "ns-resize" },
    { key: "ne", style: "-right-1.5 -top-1.5", cursor: "nesw-resize" },
    { key: "e", style: "-right-1.5 top-1/2 -translate-y-1/2", cursor: "ew-resize" },
    { key: "se", style: "-right-1.5 -bottom-1.5", cursor: "nwse-resize" },
    { key: "s", style: "left-1/2 -bottom-1.5 -translate-x-1/2", cursor: "ns-resize" },
    { key: "sw", style: "-left-1.5 -bottom-1.5", cursor: "nesw-resize" },
    { key: "w", style: "-left-1.5 top-1/2 -translate-y-1/2", cursor: "ew-resize" },
  ];

  return (
    <div
      ref={hostRef}
      className="absolute inset-0 print:hidden"
      style={{ width: px(SLIDE_W), height: px(SLIDE_H) }}
      onPointerDown={() => {
        setSelected(null);
        setPartRect(null);
      }}
      onDoubleClick={onDoubleClick}
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

      {/* Умные направляющие: центр холста, поля, края соседних блоков. */}
      {guides.map((g, i) => (
        <div
          key={`${g.axis}-${g.at}-${i}`}
          className="pointer-events-none absolute bg-primary/80"
          style={
            g.axis === "x"
              ? { left: px(g.at), top: 0, width: 1, height: px(SLIDE_H) }
              : { top: px(g.at), left: 0, height: 1, width: px(SLIDE_W) }
          }
        />
      ))}

      {/* «Призрак» — блок под курсором. */}
      {ghost && (
        <div
          className="pointer-events-none absolute rounded-md border-2 border-primary/70 bg-background/40"
          style={{ left: px(ghost.x), top: px(ghost.y), width: px(ghost.w), height: px(ghost.h) }}
        />
      )}

      {/* Рамка выделения и панель управления — только у выбранного блока. */}
      {selRect && !dragging && (
        <>
          <div
            className="pointer-events-none absolute rounded-md border-2 border-primary shadow-[0_0_0_3px_hsl(var(--primary)/0.15)]"
            style={{ left: px(selRect.x), top: px(selRect.y), width: px(selRect.w), height: px(selRect.h) }}
          >
            <span className="absolute -top-5 left-0 rounded bg-primary px-1.5 text-[10px] font-medium text-primary-foreground">
              {BLOCK_LABELS[selected as Kind]}
            </span>
            {selected && isResizable(selected) && selectedItem?.rect &&
              HANDLES.map((h) => (
                <span
                  key={h.key}
                  onPointerDown={startHandleResize(selected, h.key, selectedItem.rect as Rect)}
                  className={`pointer-events-auto absolute h-3 w-3 rounded-full border border-background bg-primary ${h.style}`}
                  style={{ cursor: h.cursor, touchAction: "none" }}
                  aria-hidden
                />
              ))}
          </div>
          {floatingToolbar && (
            <div
              className="absolute z-20"
              style={{
                left: Math.min(Math.max(4, px(selRect.x)), Math.max(4, px(SLIDE_W) - 380)),
                top: px(selRect.y) > 52 ? px(selRect.y) - 44 : px(selRect.y + selRect.h) + 8,
              }}
            >
              <BlockToolbar
                kind={selected as Kind}
                layout={overrides}
                onChange={onLayout}
                onClose={() => setSelected(null)}
              />
            </div>
          )}
        </>
      )}


      {items.map((it) =>
        it.rect ? (
          <div
            key={it.kind}
            role="button"
            tabIndex={0}
            aria-label={`${it.label}: перетащите в нужную зону`}
            onDoubleClick={onDoubleClick}
            onPointerDown={startDrag(it.kind, it.rect)}
            onPointerMove={onMove(it.kind, it.rect)}
            onPointerUp={endDrag(it.kind)}
            onPointerCancel={() => {
              setDragging(null);
              setZone(null);
              setGhost(null);
            }}
            className={`group absolute cursor-grab rounded-md border border-transparent hover:border-primary/70 hover:bg-primary/5 ${
              selected === it.kind ? "bg-primary/5" : ""
            } ${
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
                onPointerDown={startResize(it.kind as "photo" | "text" | "brand" | "client")}
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
