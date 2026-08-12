// Выравнивание блоков слайда: по горизонтали, по вертикали и растягивание
// по ширине/высоте. Значения — часть «умных зон» (content.layout), поэтому
// превью, PDF и PPTX перестраиваются автоматически и одинаково.
import {
  AlignCenter, AlignLeft, AlignRight, MoveHorizontal, MoveVertical,
  AlignVerticalJustifyCenter, AlignVerticalJustifyEnd, AlignVerticalJustifyStart, RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type {
  SlideLayoutOverrides, TextAlignX, TextZone,
} from "@/lib/presentations/model";

type Props = {
  layout: SlideLayoutOverrides;
  onChange: (patch: Partial<SlideLayoutOverrides>) => void;
};

const X_OPTIONS: { id: Exclude<TextAlignX, "auto">; label: string; Icon: typeof AlignLeft }[] = [
  { id: "left", label: "Слева", Icon: AlignLeft },
  { id: "center", label: "По центру", Icon: AlignCenter },
  { id: "right", label: "Справа", Icon: AlignRight },
];

const Y_OPTIONS: { id: Exclude<TextZone, "auto">; label: string; Icon: typeof AlignLeft }[] = [
  { id: "top", label: "Сверху", Icon: AlignVerticalJustifyStart },
  { id: "center", label: "По центру", Icon: AlignVerticalJustifyCenter },
  { id: "bottom", label: "Снизу", Icon: AlignVerticalJustifyEnd },
];

export function SlideAlignControls({ layout, onChange }: Props) {
  const touched =
    layout.alignX !== "auto" || layout.textZone !== "auto" || layout.stretchX || layout.stretchY;

  return (
    <div className="space-y-3 rounded-lg border border-border/60 p-3">
      <div className="flex items-center justify-between">
        <Label>Выравнивание блоков</Label>
        {touched && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              onChange({ alignX: "auto", textZone: "auto", stretchX: false, stretchY: false, textWidth: null })
            }
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />Авто
          </Button>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="text-xs text-muted-foreground">По ширине</div>
        <div className="flex gap-1.5">
          {X_OPTIONS.map(({ id, label, Icon }) => (
            <Button
              key={id}
              type="button"
              size="sm"
              variant={layout.alignX === id ? "default" : "outline"}
              className="flex-1"
              aria-label={label}
              title={label}
              onClick={() => onChange({ alignX: layout.alignX === id ? "auto" : id })}
            >
              <Icon className="h-4 w-4" />
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="text-xs text-muted-foreground">По высоте</div>
        <div className="flex gap-1.5">
          {Y_OPTIONS.map(({ id, label, Icon }) => (
            <Button
              key={id}
              type="button"
              size="sm"
              variant={layout.textZone === id && !layout.stretchY ? "default" : "outline"}
              className="flex-1"
              aria-label={label}
              title={label}
              disabled={layout.stretchY}
              onClick={() => onChange({ textZone: layout.textZone === id ? "auto" : id })}
            >
              <Icon className="h-4 w-4" />
            </Button>
          ))}
        </div>
      </div>

      <div className="flex gap-1.5">
        <Button
          type="button"
          size="sm"
          variant={layout.stretchX ? "default" : "outline"}
          className="flex-1"
          onClick={() => onChange({ stretchX: !layout.stretchX, textWidth: null })}
        >
          <MoveHorizontal className="mr-1.5 h-4 w-4" />На всю ширину
        </Button>
        <Button
          type="button"
          size="sm"
          variant={layout.stretchY ? "default" : "outline"}
          className="flex-1"
          onClick={() => onChange({ stretchY: !layout.stretchY })}
        >
          <MoveVertical className="mr-1.5 h-4 w-4" />На всю высоту
        </Button>
      </div>
    </div>
  );
}
