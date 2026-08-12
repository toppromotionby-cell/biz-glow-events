// Плавающая панель управления выделенным блоком слайда — как в Canva:
// появляется только рядом с выбранным блоком и меняет только его свойства.
import {
  AlignCenter, AlignLeft, AlignRight, Maximize2, Minus, MoveHorizontal, MoveVertical, Plus, RotateCcw,
  AlignVerticalJustifyCenter, AlignVerticalJustifyEnd, AlignVerticalJustifyStart,
} from "lucide-react";
import type { ComponentType } from "react";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_LAYOUT_OVERRIDES, LOGO_SCALE_MAX, LOGO_SCALE_MIN, PHOTO_SCALE_MAX, PHOTO_SCALE_MIN,
  PRICE_SCALE_MAX, PRICE_SCALE_MIN, TEXT_SCALE_MAX, TEXT_SCALE_MIN,
  clampNum, type SlideLayoutOverrides,
} from "@/lib/presentations/model";

export type BlockKind = "photo" | "text" | "title" | "subtitle" | "body" | "price" | "brand" | "client";

export const BLOCK_LABELS: Record<BlockKind, string> = {
  photo: "Фото",
  text: "Текст",
  title: "Заголовок",
  subtitle: "Подзаголовок",
  body: "Описание",
  price: "Цена",
  brand: "Логотип компании",
  client: "Логотип клиента",
};

type Props = {
  kind: BlockKind;
  layout: SlideLayoutOverrides;
  onChange: (patch: Partial<SlideLayoutOverrides>) => void;
  onClose: () => void;
};

type Btn = {
  key: string;
  label: string;
  Icon: ComponentType<{ className?: string }>;
  active: boolean;
  onClick: () => void;
};

function textButtons(l: SlideLayoutOverrides, on: Props["onChange"]): Btn[] {
  const x = (id: "left" | "center" | "right", Icon: Btn["Icon"], label: string): Btn => ({
    key: `x-${id}`, label, Icon,
    active: l.alignX === id,
    onClick: () => on({ alignX: l.alignX === id ? "auto" : id }),
  });
  const y = (id: "top" | "center" | "bottom", Icon: Btn["Icon"], label: string): Btn => ({
    key: `y-${id}`, label, Icon,
    active: l.textZone === id && !l.stretchY,
    onClick: () => on({ textZone: l.textZone === id ? "auto" : id, stretchY: false }),
  });
  return [
    x("left", AlignLeft, "Слева"),
    x("center", AlignCenter, "По центру"),
    x("right", AlignRight, "Справа"),
    y("top", AlignVerticalJustifyStart, "Сверху"),
    y("center", AlignVerticalJustifyCenter, "По центру по высоте"),
    y("bottom", AlignVerticalJustifyEnd, "Снизу"),
    {
      key: "stretch-x", label: "На всю ширину", Icon: MoveHorizontal, active: l.stretchX,
      onClick: () => on({ stretchX: !l.stretchX, textWidth: null }),
    },
    {
      key: "stretch-y", label: "На всю высоту", Icon: MoveVertical, active: l.stretchY,
      onClick: () => on({ stretchY: !l.stretchY }),
    },
  ];
}

/** Выравнивание отдельной части текста: заголовок / подзаголовок / описание. */
function partButtons(kind: "title" | "subtitle" | "body", l: SlideLayoutOverrides, on: Props["onChange"]): Btn[] {
  const key = kind === "title" ? "titleAlignX" : kind === "subtitle" ? "subtitleAlignX" : "bodyAlignX";
  const cur = l[key];
  const x = (id: "left" | "center" | "right", Icon: Btn["Icon"], label: string): Btn => ({
    key: `${kind}-${id}`, label, Icon,
    active: cur === id,
    onClick: () => on({ [key]: cur === id ? "auto" : id } as Partial<SlideLayoutOverrides>),
  });
  const sKey = kind === "title" ? "titleScale" : kind === "subtitle" ? "subtitleScale" : "bodyScale";
  const size = (d: number): Btn => ({
    key: `${kind}-size${d > 0 ? "+" : "-"}`,
    label: d > 0 ? "Крупнее" : "Мельче",
    Icon: d > 0 ? Plus : Minus,
    active: false,
    onClick: () =>
      on({ [sKey]: clampNum((l[sKey] ?? 1) + d, TEXT_SCALE_MIN, TEXT_SCALE_MAX) } as Partial<SlideLayoutOverrides>),
  });
  return [
    x("left", AlignLeft, "Слева"),
    x("center", AlignCenter, "По центру"),
    x("right", AlignRight, "Справа"),
    size(-0.1),
    size(0.1),
  ];
}

function photoButtons(l: SlideLayoutOverrides, on: Props["onChange"]): Btn[] {
  const z = (id: "left" | "right" | "top" | "full", Icon: Btn["Icon"], label: string): Btn => ({
    key: `p-${id}`, label, Icon,
    active: l.photoZone === id,
    onClick: () => on({ photoZone: l.photoZone === id ? "auto" : id }),
  });
  const step = (d: number): Btn => ({
    key: d > 0 ? "p-plus" : "p-minus",
    label: d > 0 ? "Крупнее" : "Мельче",
    Icon: d > 0 ? Plus : Minus,
    active: false,
    onClick: () => on({ photoScale: clampNum((l.photoScale ?? 0.5) + d, PHOTO_SCALE_MIN, PHOTO_SCALE_MAX) }),
  });
  return [
    z("left", AlignLeft, "Слева"),
    z("right", AlignRight, "Справа"),
    z("top", AlignVerticalJustifyStart, "Сверху"),
    z("full", Maximize2, "На весь слайд"),
    step(-0.05),
    step(0.05),
  ];
}

function priceButtons(l: SlideLayoutOverrides, on: Props["onChange"]): Btn[] {
  const z = (id: "under-text" | "corner" | "beside-photo", Icon: Btn["Icon"], label: string): Btn => ({
    key: `pr-${id}`, label, Icon,
    active: l.priceZone === id,
    onClick: () => on({ priceZone: l.priceZone === id ? "auto" : id }),
  });
  const step = (d: number): Btn => ({
    key: d > 0 ? "pr-plus" : "pr-minus",
    label: d > 0 ? "Крупнее" : "Мельче",
    Icon: d > 0 ? Plus : Minus,
    active: false,
    onClick: () => on({ priceScale: clampNum((l.priceScale ?? 1) + d, PRICE_SCALE_MIN, PRICE_SCALE_MAX) }),
  });
  return [
    z("under-text", AlignVerticalJustifyEnd, "Под текстом"),
    z("corner", AlignRight, "В углу"),
    z("beside-photo", AlignVerticalJustifyStart, "Рядом с фото"),
    step(-0.1),
    step(0.1),
  ];
}

function logoButtons(kind: "brand" | "client", l: SlideLayoutOverrides, on: Props["onChange"]): Btn[] {
  const key = kind === "brand" ? "brandLogo" : "clientLogo";
  const cur = l[key];
  const set = (patch: Partial<typeof cur>) => on({ [key]: { ...cur, ...patch } } as Partial<SlideLayoutOverrides>);
  const z = (id: "tl" | "tr" | "bl" | "br", Icon: Btn["Icon"], label: string): Btn => ({
    key: `l-${id}`, label, Icon,
    active: cur.zone === id,
    onClick: () => set({ zone: cur.zone === id ? "auto" : id }),
  });
  const step = (d: number): Btn => ({
    key: d > 0 ? "l-plus" : "l-minus",
    label: d > 0 ? "Крупнее" : "Мельче",
    Icon: d > 0 ? Plus : Minus,
    active: false,
    onClick: () => set({ scale: clampNum((cur.scale ?? 1) + d, LOGO_SCALE_MIN, LOGO_SCALE_MAX) }),
  });
  return [
    {
      key: "l-free", label: "Свободное положение (перетащите мышью)", Icon: MoveHorizontal,
      active: cur.pos !== null,
      onClick: () => set({ pos: null }),
    },
    z("tl", AlignVerticalJustifyStart, "Слева сверху"),
    z("tr", AlignVerticalJustifyStart, "Справа сверху"),
    z("bl", AlignVerticalJustifyEnd, "Слева снизу"),
    z("br", AlignVerticalJustifyEnd, "Справа снизу"),
    step(-0.1),
    step(0.1),
  ];
}

function resetPatch(kind: BlockKind, l: SlideLayoutOverrides): Partial<SlideLayoutOverrides> {
  if (kind === "text") {
    return { alignX: "auto", textZone: "auto", stretchX: false, stretchY: false, textWidth: null };
  }
  if (kind === "photo") return { photoZone: "auto", photoScale: null };
  if (kind === "price") return { priceZone: "auto", priceScale: null };
  if (kind === "title") return { titleAlignX: "auto", titleScale: null };
  if (kind === "subtitle") return { subtitleAlignX: "auto", subtitleScale: null };
  if (kind === "body") return { bodyAlignX: "auto", bodyScale: null };
  const key = kind === "brand" ? "brandLogo" : "clientLogo";
  return { [key]: { ...l[key], zone: "auto", scale: null, pos: null } } as Partial<SlideLayoutOverrides>;
}

export function BlockToolbar({ kind, layout, onChange, onClose }: Props) {
  const buttons =
    kind === "text" ? textButtons(layout, onChange)
      : kind === "title" || kind === "subtitle" || kind === "body" ? partButtons(kind, layout, onChange)
        : kind === "photo" ? photoButtons(layout, onChange)
          : kind === "price" ? priceButtons(layout, onChange)
            : logoButtons(kind, layout, onChange);

  const dirty = JSON.stringify(resetPatch(kind, layout)) !== JSON.stringify(resetPatch(kind, DEFAULT_LAYOUT_OVERRIDES));

  return (
    <div
      className="pointer-events-auto flex items-center gap-1 rounded-lg border border-border bg-popover/95 p-1 shadow-lg backdrop-blur"
      onPointerDown={(e) => e.stopPropagation()}
      role="toolbar"
      aria-label={`Настройки: ${BLOCK_LABELS[kind]}`}
    >
      <span className="px-1.5 text-[11px] font-medium text-muted-foreground">{BLOCK_LABELS[kind]}</span>
      {buttons.map(({ key, label, Icon, active, onClick }) => (
        <Button
          key={key}
          type="button"
          size="icon"
          variant={active ? "default" : "ghost"}
          className="h-7 w-7"
          title={label}
          aria-label={label}
          onClick={onClick}
        >
          <Icon className="h-3.5 w-3.5" />
        </Button>
      ))}
      {dirty && (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          title="Сбросить в авто"
          aria-label="Сбросить в авто"
          onClick={() => {
            onChange(resetPatch(kind, layout));
            onClose();
          }}
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
