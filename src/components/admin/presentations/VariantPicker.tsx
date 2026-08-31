// Выбор варианта оформления слайда мини-схемами: маленькое SVG показывает,
// куда встанут фото и текст. Схема строится из того же плана (variant-layout),
// который применяют превью и PDF — картинка не расходится с результатом.
import { SLIDE_VARIANTS, type SlideType } from "@/lib/presentations/model";
import { variantPlan } from "@/lib/presentations/variant-layout";
import { cn } from "@/lib/utils";

const W = 48;
const H = 27;

/** Мини-схема варианта: серые прямоугольники фото и линии текста. */
function VariantThumb({ type, variant }: { type: SlideType; variant: string }) {
  const p = variantPlan(type, variant);
  const photo = p.photoZone;
  const px = 3;

  const photoRect =
    photo === "full" ? { x: 0, y: 0, w: W, h: H }
    : photo === "left" ? { x: 0, y: 0, w: 17, h: H }
    : photo === "right" ? { x: W - 17, y: 0, w: 17, h: H }
    : photo === "top" ? { x: 0, y: 0, w: W, h: 11 }
    : null;

  const textX = photo === "left" ? 20 : px;
  const textRight = photo === "right" ? W - 20 : W - px;
  const textW = Math.max(10, textRight - textX);
  const textTop = photo === "top" ? 14 : 7;

  const lines = p.checklist ? 4 : 3;
  const lineW = (i: number) => (i === 0 ? textW * 0.8 : textW * (p.columns === 2 ? 0.44 : 0.62));

  const anchorX = (w: number) =>
    p.alignX === "center" ? textX + (textW - w) / 2 : p.alignX === "right" ? textRight - w : textX;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-[27px] w-[48px] rounded-[3px] bg-muted/40">
      {photoRect && (
        <rect {...photoRect} fill="currentColor" opacity={photo === "full" ? 0.35 : 0.25} />
      )}
      {/* Заголовок */}
      <rect
        x={anchorX(textW * 0.7)}
        y={textTop}
        width={textW * 0.7}
        height={p.titleBoost > 1.2 ? 5 : 3.4}
        rx={1}
        fill="currentColor"
        opacity={0.85}
      />
      {/* Строки текста / колонки / чек-лист */}
      {Array.from({ length: lines }).map((_, i) => {
        const y = textTop + (p.titleBoost > 1.2 ? 8 : 6) + i * 3.4;
        if (y > H - 3) return null;
        if (p.columns === 2) {
          return (
            <g key={i}>
              <rect x={textX} y={y} width={textW * 0.44} height={1.6} rx={0.8} fill="currentColor" opacity={0.5} />
              <rect x={textX + textW * 0.56} y={y} width={textW * 0.44} height={1.6} rx={0.8} fill="currentColor" opacity={0.5} />
            </g>
          );
        }
        const w = lineW(i);
        return (
          <g key={i}>
            {p.checklist && (
              <rect x={anchorX(w) - 2.6} y={y} width={1.6} height={1.6} rx={0.8} fill="currentColor" opacity={0.8} />
            )}
            <rect x={anchorX(w)} y={y} width={w} height={1.6} rx={0.8} fill="currentColor" opacity={0.5} />
          </g>
        );
      })}
      {p.band && <rect x={px} y={3} width={W - px * 2} height={2} rx={1} fill="currentColor" opacity={0.9} />}
      {p.priceAccent && (
        <rect x={W - 16} y={H - 8} width={13} height={5} rx={1.5} fill="currentColor" opacity={0.9} />
      )}
    </svg>
  );
}

export function VariantPicker({
  type,
  value,
  onChange,
}: {
  type: SlideType;
  value: string;
  onChange: (variant: string) => void;
}) {
  const list = SLIDE_VARIANTS[type] ?? [];
  return (
    <div className="grid-tiles">
      {list.map((v) => {
        const active = v.id === value;
        return (
          <button
            key={v.id}
            type="button"
            title={v.hint}
            onClick={() => onChange(v.id)}
            aria-pressed={active}
            className={cn(
              "flex min-w-0 flex-col items-center gap-1 rounded-lg border p-1.5 text-[10px] transition",
              active
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border/60 text-muted-foreground hover:border-primary/40 hover:bg-primary/5",
            )}
          >
            <span className={active ? "text-primary" : "text-muted-foreground"}>
              <VariantThumb type={type} variant={v.id} />
            </span>
            <span className="w-full truncate text-center leading-tight">{v.label}</span>
          </button>
        );
      })}
    </div>
  );
}
