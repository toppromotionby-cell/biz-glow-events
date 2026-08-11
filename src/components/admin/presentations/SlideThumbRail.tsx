// Лента миниатюр слайдов: выбор, перетаскивание, действия с клавиатуры.
import { useState } from "react";
import { ChevronDown, ChevronUp, Copy, EyeOff, GripVertical, Trash2 } from "lucide-react";
import { SlideCanvas } from "@/components/admin/presentations/SlideCanvas";
import type { CompanyProfile } from "@/lib/documents/company-profile";
import {
  SLIDE_TYPE_LABELS, type PresentationSlide, type PresentationTemplate,
} from "@/lib/presentations/model";

export function SlideThumbRail({
  slides,
  selected,
  company,
  template,
  presentationTitle,
  horizontal,
  onSelect,
  onMove,
  onReorder,
  onDuplicate,
  onDelete,
}: {
  slides: PresentationSlide[];
  selected: string | null;
  company: CompanyProfile | null;
  template: PresentationTemplate;
  presentationTitle: string;
  horizontal?: boolean;
  onSelect: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onReorder: (fromId: string, toId: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const onKeyDown = (e: React.KeyboardEvent, s: PresentationSlide) => {
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      const i = slides.findIndex((x) => x.id === s.id);
      const next = slides[Math.min(i + 1, slides.length - 1)];
      if (next) onSelect(next.id);
    }
    if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      const i = slides.findIndex((x) => x.id === s.id);
      const prev = slides[Math.max(i - 1, 0)];
      if (prev) onSelect(prev.id);
    }
    if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault();
      onMove(s.id, e.key === "ArrowUp" ? -1 : 1);
    }
  };

  return (
    <div
      className={
        horizontal
          ? "flex gap-2 overflow-x-auto pb-2"
          : "max-h-[64vh] space-y-2 overflow-y-auto pr-1"
      }
      role="listbox"
      aria-label="Слайды презентации"
    >
      {slides.map((s, i) => {
        const isSelected = s.id === selected;
        return (
          <div
            key={s.id}
            draggable
            onDragStart={() => setDragId(s.id)}
            onDragEnd={() => { setDragId(null); setOverId(null); }}
            onDragOver={(e) => { e.preventDefault(); setOverId(s.id); }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragId && dragId !== s.id) onReorder(dragId, s.id);
              setDragId(null);
              setOverId(null);
            }}
            className={`group relative shrink-0 rounded-xl border p-1 transition-colors ${
              horizontal ? "w-[180px]" : ""
            } ${isSelected ? "border-primary ring-1 ring-primary/40" : "border-border/60 hover:border-primary/50"} ${
              overId === s.id && dragId && dragId !== s.id ? "ring-2 ring-primary" : ""
            } ${s.is_visible ? "" : "opacity-60"}`}
          >
            <button
              type="button"
              role="option"
              aria-selected={isSelected}
              aria-label={`Слайд ${i + 1}: ${s.title || SLIDE_TYPE_LABELS[s.type]}`}
              className="block w-full rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => onSelect(s.id)}
              onKeyDown={(e) => onKeyDown(e, s)}
            >
              <SlideCanvas
                slide={s}
                company={company}
                template={template}
                presentationTitle={presentationTitle}
                width={horizontal ? 168 : 176}
                index={i}
                total={slides.length}
              {...(branding ?? {})}
              />
            </button>

            <div className="mt-1 flex items-center justify-between gap-1 px-1 pb-0.5 text-[11px] text-muted-foreground">
              <span className="flex min-w-0 items-center gap-1">
                <GripVertical className="h-3 w-3 shrink-0 cursor-grab opacity-50" aria-hidden />
                <span className="truncate">{i + 1}. {SLIDE_TYPE_LABELS[s.type]}</span>
                {!s.is_visible && <EyeOff className="h-3 w-3 shrink-0" aria-label="Скрыт" />}
              </span>
              <span className="flex shrink-0 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                <button
                  type="button"
                  aria-label="Переместить выше"
                  disabled={i === 0}
                  className="rounded p-0.5 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => onMove(s.id, -1)}
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Переместить ниже"
                  disabled={i === slides.length - 1}
                  className="rounded p-0.5 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => onMove(s.id, 1)}
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Дублировать слайд"
                  className="rounded p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => onDuplicate(s.id)}
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Удалить слайд"
                  className="rounded p-0.5 text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => onDelete(s.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
