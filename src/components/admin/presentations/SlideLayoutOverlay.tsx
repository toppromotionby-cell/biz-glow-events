// Интерактивный слой поверх слайда в редакторе: выделение, перетаскивание и
// масштабирование всех блоков слайда — как в Canva.
//
// Объекты слайда: фото, текстовая колонка, заголовок, подзаголовок, описание,
// цена и два логотипа. Клик выделяет, повторный клик по тексту — набор текста,
// восемь маркеров рамки меняют размер (у текста — кегль, с автоподгоном
// раскладки), перетаскивание ставит блок в ближайшую зону, а логотипы двигаются
// свободно с магнитными направляющими.
//
// Все изменения — это входные параметры автораскладки (design.ts), поэтому
// остальные элементы перестраиваются автоматически и не перекрывают друг друга.
import {
  useCallback, useEffect, useLayoutEffect, useRef, useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { BlockToolbar, BLOCK_LABELS, type BlockKind } from "@/components/admin/presentations/BlockToolbar";
import { SLIDE_H, SLIDE_W, type Rect } from "@/lib/presentations/design";
import type { SlideFit } from "@/lib/presentations/fit";
import type { SlideLogoPlan } from "@/lib/presentations/logo-plan";
import { snapRect, type Guide } from "@/lib/presentations/snap";
import {
  LOGO_SCALE_MAX, LOGO_SCALE_MIN, PHOTO_SCALE_MAX, PHOTO_SCALE_MIN,
  PRICE_SCALE_MAX, PRICE_SCALE_MIN, TEXT_SCALE_MAX, TEXT_SCALE_MIN,
  TEXT_WIDTH_MAX, TEXT_WIDTH_MIN, clampNum,
  type SlideLayoutOverrides,
} from "@/lib/presentations/model";
import { logoZones, nearestZone, photoZones, priceZones, textZones, type ZoneDef } from "@/lib/presentations/zones";

type Kind = BlockKind;

/** Патч раскладки: `transient` — промежуточный кадр жеста (без шага отмены). */
export type LayoutPatch = (
  patch: Partial<SlideLayoutOverrides>,
  opts?: { transient?: boolean },
) => void;

export type SlideLayoutOverlayProps = {
  fit: SlideFit;
  plan: SlideLogoPlan;
  overrides: SlideLayoutOverrides;
  scale: number;
  onLayout: LayoutPatch;
  /** Выделенный блок (управляется извне — панель свойств справа). */
  selected?: Kind | null;
  onSelect?: (kind: Kind | null) => void;
  /** Повторный клик по тексту — редактор просит переключиться в набор текста. */
  onTextEdit?: (kind: Kind) => void;
  /** Показывать плавающую панель блока (на десктопе свойства живут справа). */
  floatingToolbar?: boolean;
};

const TEXT_PARTS: Kind[] = ["title", "subtitle", "body"];
const isPart = (k: Kind): k is "title" | "subtitle" | "body" => TEXT_PARTS.includes(k);
const isLogo = (k: Kind): k is "brand" | "client" => k === "brand" || k === "client";

/** Пределы масштаба по типу блока. */
const LIMITS: Record<string, [number, number]> = {
  photo: [PHOTO_SCALE_MIN, PHOTO_SCALE_MAX],
  text: [TEXT_WIDTH_MIN, TEXT_WIDTH_MAX],
  price: [PRICE_SCALE_MIN, PRICE_SCALE_MAX],
  title: [TEXT_SCALE_MIN, TEXT_SCALE_MAX],
  subtitle: [TEXT_SCALE_MIN, TEXT_SCALE_MAX],
  body: [TEXT_SCALE_MIN, TEXT_SCALE_MAX],
  brand: [LOGO_SCALE_MIN, LOGO_SCALE_MAX],
  client: [LOGO_SCALE_MIN, LOGO_SCALE_MAX],
};

const rectEq = (a: Rect | undefined, b: Rect | undefined): boolean =>
  !!a && !!b && Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5 &&
  Math.abs(a.w - b.w) < 0.5 && Math.abs(a.h - b.h) < 0.5;

/**
 * Реальные рамки текстовых частей и логотипов — измеряем прямо в превью,
 * поэтому маркеры всегда стоят ровно по краю того, что видит пользователь.
 */
function useRenderedRects(
  host: HTMLDivElement | null,
  deps: unknown,
): Record<string, Rect> {
  const [rects, setRects] = useState<Record<string, Rect>>({});
  const measure = useCallback(() => {
    const root = host?.closest("[data-slide-root]");
    const inner = root?.querySelector<HTMLElement>("[data-slide-inner]");
    if (!inner) return;
    // Масштаб берём из самого DOM: во время перерисовки проп может отставать
    // от применённого transform, и рамки уезжали бы мимо блоков.
    const ir = inner.getBoundingClientRect();
    const k = ir.width / SLIDE_W;
    if (!(k > 0)) return;
    const next: Record<string, Rect> = {};
    inner.querySelectorAll<HTMLElement>("[data-block]").forEach((el) => {
      const key = el.dataset.block;
      if (!key) return;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return;
      next[key] = {
        x: (r.left - ir.left) / k,
        y: (r.top - ir.top) / k,
        w: r.width / k,
        h: r.height / k,
      };
    });
    setRects((prev) => {
      const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
      for (const key of keys) if (!rectEq(prev[key], next[key])) return next;
      return prev;
    });
  }, [host]);

  useLayoutEffect(() => {
    measure();
    // Шрифты, картинки и зум приходят позже — перемеряем несколько кадров подряд
    // и следим за размером холста, чтобы рамки всегда стояли по месту.
    let frames = 0;
    let raf = 0;
    const tick = () => {
      measure();
      if (++frames < 8) raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    const root = host?.closest("[data-slide-root]");
    const ro = root ? new ResizeObserver(() => measure()) : null;
    if (root && ro) ro.observe(root);
    // Холст может смещаться без изменения размера (прокрутка, панели редактора) —
    // подстраховываемся слушателями и лёгкой периодической сверкой.
    const onView = () => measure();
    window.addEventListener("scroll", onView, true);
    window.addEventListener("resize", onView);
    const timer = window.setInterval(measure, 400);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearInterval(timer);
      window.removeEventListener("scroll", onView, true);
      window.removeEventListener("resize", onView);
      ro?.disconnect();
    };
  }, [measure, host, deps]);

  return rects;
}

export function SlideLayoutOverlay({
  fit, plan, overrides, scale, onLayout,
  selected: selectedProp, onSelect, onTextEdit, floatingToolbar,
}: SlideLayoutOverlayProps) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState<Kind | null>(null);
  const [zone, setZone] = useState<string | null>(null);
  const [ghost, setGhost] = useState<Rect | null>(null);
  const [ownSelected, setOwnSelected] = useState<Kind | null>(null);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [sizeHint, setSizeHint] = useState<{ text: string; limit: boolean } | null>(null);
  const selected = selectedProp !== undefined ? selectedProp : ownSelected;
  const setSelected = (kind: Kind | null) => {
    setOwnSelected(kind);
    onSelect?.(kind);
  };
  const grab = useRef({ dx: 0, dy: 0 });
  const moved = useRef(false);
  /** Внутри жеста первый патч создаёт шаг отмены, остальные — нет. */
  const stepStarted = useRef(false);
  const rafId = useRef<number | null>(null);

  const setRef = (el: HTMLDivElement | null) => {
    hostRef.current = el;
    setHost(el);
  };

  const dom = useRenderedRects(host, [fit, overrides, plan, scale]);

  /** Патч раскладки внутри жеста: первый — с шагом отмены, дальше — без. */
  const push = useCallback(
    (patch: Partial<SlideLayoutOverrides>) => {
      onLayout(patch, { transient: stepStarted.current });
      stepStarted.current = true;
    },
    [onLayout],
  );

  /** Кадровая синхронизация: не чаще одного пересчёта слайда на кадр. */
  const pushFrame = useCallback(
    (patch: Partial<SlideLayoutOverrides>) => {
      if (rafId.current !== null) window.cancelAnimationFrame(rafId.current);
      rafId.current = window.requestAnimationFrame(() => {
        rafId.current = null;
        push(patch);
      });
    },
    [push],
  );

  useEffect(() => () => {
    if (rafId.current !== null) window.cancelAnimationFrame(rafId.current);
  }, []);

  // Esc снимает выделение, стрелки двигают логотип на 1 px (Shift — на 10).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelected(null);
        return;
      }
      const nudge: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
      };
      const step = nudge[e.key];
      if (!step || !selected || !isLogo(selected)) return;
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

  /* ---------------- зоны и перетаскивание ---------------- */

  /** Часть текста тянется вместе со всей колонкой. */
  const dragKind = (kind: Kind): Kind => (isPart(kind) ? "text" : kind);

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

  /** Свободное перемещение логотипа: доли холста 1280×720. */
  const moveLogoFree = (kind: "brand" | "client", x: number, y: number) => {
    const key = kind === "brand" ? "brandLogo" : "clientLogo";
    const cur = overrides[key];
    pushFrame({
      [key]: { ...cur, zone: "auto", pos: { x: clampNum(x / SLIDE_W, 0, 1), y: clampNum(y / SLIDE_H, 0, 1) } },
    } as Partial<SlideLayoutOverrides>);
  };

  const apply = (kind: Kind, zoneId: string) => {
    if (kind === "photo") push({ photoZone: zoneId as SlideLayoutOverrides["photoZone"] });
    else if (kind === "text") push({ textZone: zoneId as SlideLayoutOverrides["textZone"] });
    else if (kind === "price") push({ priceZone: zoneId as SlideLayoutOverrides["priceZone"] });
    else if (kind === "brand") push({ brandLogo: { ...overrides.brandLogo, zone: zoneId as never } });
    else push({ clientLogo: { ...overrides.clientLogo, zone: zoneId as never } });
  };

  const toCanvas = (e: { clientX: number; clientY: number }) => {
    const h = hostRef.current;
    if (!h) return { x: 0, y: 0 };
    const r = h.getBoundingClientRect();
    return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
  };

  const startDrag = (kind: Kind, rect: Rect) => (e: ReactPointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const p = toCanvas(e);
    grab.current = { dx: p.x - rect.x, dy: p.y - rect.y };
    moved.current = false;
    stepStarted.current = false;
    // Повторный клик по уже выбранному тексту — сразу в набор текста.
    if (isPart(kind) && selected === kind) onTextEdit?.(kind);
    setSelected(kind);
    setDragging(kind);
    setZone(currentZone(dragKind(kind)));
    setGhost(rect);
  };

  /** Соседние блоки для магнитных направляющих. */
  const neighbors = (kind: Kind): Rect[] =>
    [fit.layout.textBox, fit.layout.photoBox, fit.layout.priceBox].filter(
      (r): r is Rect => !!r && !(kind === "text" && r === fit.layout.textBox),
    );

  const onMove = (kind: Kind, rect: Rect) => (e: ReactPointerEvent) => {
    if (dragging !== kind) return;
    const p = toCanvas(e);
    if (Math.abs(p.x - rect.x - grab.current.dx) + Math.abs(p.y - rect.y - grab.current.dy) < 2 && !moved.current) {
      return;
    }
    moved.current = true;
    const nx = p.x - grab.current.dx;
    const ny = p.y - grab.current.dy;
    if (isLogo(kind)) {
      const snapped = snapRect({ x: nx, y: ny, w: rect.w, h: rect.h }, neighbors(kind));
      setGhost({ x: snapped.x, y: snapped.y, w: rect.w, h: rect.h });
      setGuides(snapped.guides);
      moveLogoFree(kind, snapped.x, snapped.y);
      return;
    }
    setGhost({ x: nx, y: ny, w: rect.w, h: rect.h });
    const dk = dragKind(kind);
    const z = nearestZone(zonesFor(dk), p);
    if (z.id !== zone) {
      setZone(z.id);
      // Живое превью: слайд пересобирается сразу, ещё до отпускания.
      apply(dk, z.id);
    }
  };

  const endDrag = (kind: Kind) => () => {
    if (dragging !== kind) return;
    setDragging(null);
    setZone(null);
    setGhost(null);
    setGuides([]);
    stepStarted.current = false;
  };

  /* ---------------- масштабирование ---------------- */

  const scaleOf = (kind: Kind): number => {
    if (kind === "photo") return overrides.photoScale ?? 0.5;
    if (kind === "text") return overrides.textWidth ?? 1;
    if (kind === "price") return overrides.priceScale ?? 1;
    if (kind === "title") return overrides.titleScale ?? 1;
    if (kind === "subtitle") return overrides.subtitleScale ?? 1;
    if (kind === "body") return overrides.bodyScale ?? 1;
    return (kind === "brand" ? overrides.brandLogo : overrides.clientLogo).scale ?? 1;
  };

  const applyScale = (kind: Kind, value: number): boolean => {
    const [min, max] = LIMITS[kind] ?? [0.5, 2];
    const v = clampNum(value, min, max);
    if (kind === "photo") pushFrame({ photoScale: v });
    else if (kind === "text") pushFrame({ textWidth: v, stretchX: false });
    else if (kind === "price") pushFrame({ priceScale: v });
    else if (kind === "title") pushFrame({ titleScale: v });
    else if (kind === "subtitle") pushFrame({ subtitleScale: v });
    else if (kind === "body") pushFrame({ bodyScale: v });
    else {
      const key = kind === "brand" ? "brandLogo" : "clientLogo";
      const cur = overrides[key];
      pushFrame({ [key]: { ...cur, scale: v } } as Partial<SlideLayoutOverrides>);
    }
    return v !== value;
  };

  /**
   * Масштабирование от маркера рамки (как в Canva): считаем смещение курсора
   * относительно точки захвата, а не абсолютную позицию — блок не «прыгает».
   * Углы — пропорционально, боковые маркеры — по одной оси, Shift —
   * принудительно пропорционально, Alt — от центра.
   */
  const startHandleResize = (kind: Kind, handle: string, rect: Rect) =>
    (e: ReactPointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const start = toCanvas(e);
      const startScale = scaleOf(kind);
      const w0 = Math.max(24, rect.w);
      const h0 = Math.max(24, rect.h);
      const sx = handle.includes("w") ? -1 : handle.includes("e") ? 1 : 0;
      const sy = handle.includes("n") ? -1 : handle.includes("s") ? 1 : 0;
      stepStarted.current = false;
      setSelected(kind);

      const move = (ev: PointerEvent) => {
        const p = toCanvas(ev);
        const mult = ev.altKey ? 2 : 1;
        const dw = sx * (p.x - start.x) * mult;
        const dh = sy * (p.y - start.y) * mult;
        const kx = sx ? (w0 + dw) / w0 : 0;
        const ky = sy ? (h0 + dh) / h0 : 0;
        const both = (sx && sy) || ev.shiftKey;
        const k = both ? (sx && sy ? Math.max(kx, ky) : sx ? kx : ky) : sx ? kx : ky;
        if (!Number.isFinite(k) || k <= 0) return;
        const limit = applyScale(kind, startScale * k);
        setSizeHint({
          text: `${Math.round(w0 * (sx ? k : 1))} × ${Math.round(h0 * (sy || both ? k : 1))}`,
          limit,
        });
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        setSizeHint(null);
        stepStarted.current = false;
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    };

  /** Двойной клик по маркеру — сброс размера блока в авто. */
  const resetSize = (kind: Kind) => {
    if (kind === "photo") onLayout({ photoScale: null });
    else if (kind === "text") onLayout({ textWidth: null });
    else if (kind === "price") onLayout({ priceScale: null });
    else if (kind === "title") onLayout({ titleScale: null });
    else if (kind === "subtitle") onLayout({ subtitleScale: null });
    else if (kind === "body") onLayout({ bodyScale: null });
    else {
      const key = kind === "brand" ? "brandLogo" : "clientLogo";
      onLayout({ [key]: { ...overrides[key], scale: null } } as Partial<SlideLayoutOverrides>);
    }
  };

  /* ---------------- объекты слайда ---------------- */

  const items: { kind: Kind; rect: Rect | null; label: string }[] = [
    { kind: "photo", rect: fit.layout.photoBox, label: BLOCK_LABELS.photo },
    { kind: "text", rect: fit.layout.textBox, label: BLOCK_LABELS.text },
    { kind: "price", rect: fit.layout.priceBox, label: BLOCK_LABELS.price },
    { kind: "title", rect: dom.title ?? null, label: BLOCK_LABELS.title },
    { kind: "subtitle", rect: dom.subtitle ?? null, label: BLOCK_LABELS.subtitle },
    { kind: "body", rect: dom.body ?? null, label: BLOCK_LABELS.body },
    { kind: "brand", rect: dom.brandLogo ?? null, label: BLOCK_LABELS.brand },
    { kind: "client", rect: dom.clientLogo ?? null, label: BLOCK_LABELS.client },
  ];

  const px = (v: number) => v * scale;
  const target = dragging ? zonesFor(dragKind(dragging)).find((z) => z.id === zone) : null;
  const selectedItem = selected ? items.find((it) => it.kind === selected && it.rect) : null;
  const selRect = selectedItem?.rect ?? null;

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
      ref={setRef}
      className="absolute inset-0 print:hidden"
      style={{ width: px(SLIDE_W), height: px(SLIDE_H) }}
      onPointerDown={() => setSelected(null)}
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

      {/* Рамка выделения, маркеры и панель управления — у выбранного блока. */}
      {selRect && !dragging && (
        <>
          <div
            className="pointer-events-none absolute rounded-md border-2 border-primary shadow-[0_0_0_3px_hsl(var(--primary)/0.15)]"
            style={{ left: px(selRect.x), top: px(selRect.y), width: px(selRect.w), height: px(selRect.h) }}
          >
            <span className="absolute -top-5 left-0 rounded bg-primary px-1.5 text-[10px] font-medium text-primary-foreground">
              {BLOCK_LABELS[selected as Kind]}
            </span>
            {HANDLES.map((h) => (
              <span
                key={h.key}
                onPointerDown={startHandleResize(selected as Kind, h.key, selRect)}
                onDoubleClick={(e) => { e.stopPropagation(); resetSize(selected as Kind); }}
                className={`pointer-events-auto absolute h-3 w-3 rounded-full border border-background transition-colors ${
                  sizeHint?.limit ? "bg-amber-500" : "bg-primary"
                } ${h.style}`}
                style={{ cursor: h.cursor, touchAction: "none" }}
                aria-hidden
              />
            ))}
            {sizeHint && (
              <span
                className={`absolute -bottom-7 right-0 rounded px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground ${
                  sizeHint.limit ? "bg-amber-500 text-black" : "bg-primary"
                }`}
              >
                {sizeHint.text}
              </span>
            )}
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
            tabIndex={-1}
            aria-label={it.label}
            onPointerDown={startDrag(it.kind, it.rect)}
            onPointerMove={onMove(it.kind, it.rect)}
            onPointerUp={endDrag(it.kind)}
            onPointerCancel={endDrag(it.kind)}
            className={`group absolute cursor-grab rounded-md border border-transparent hover:border-primary/70 hover:bg-primary/5 ${
              selected === it.kind ? "bg-primary/5" : ""
            } ${dragging === it.kind ? "opacity-40" : ""}`}
            style={{
              left: px(it.rect.x),
              top: px(it.rect.y),
              width: px(it.rect.w),
              height: px(it.rect.h),
              touchAction: "none",
              // Части текста и логотипы лежат выше колонки — их проще поймать.
              zIndex: isPart(it.kind) || isLogo(it.kind) ? 2 : 1,
            }}
          >
            <span className="pointer-events-none absolute left-1 top-1 rounded bg-background/85 px-1 text-[10px] font-medium text-foreground opacity-0 transition group-hover:opacity-100">
              {it.label}
            </span>
          </div>
        ) : null,
      )}
    </div>
  );
}
