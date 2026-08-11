// Полноэкранный просмотр презентации: слайд 16:9, стрелки, Esc, счётчик.
import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SlideCanvas, SLIDE_W, SLIDE_H, type SlideBranding } from "@/components/admin/presentations/SlideCanvas";
import type { CompanyProfile } from "@/lib/documents/company-profile";
import type { PresentationSlide, PresentationTemplate } from "@/lib/presentations/model";

export function PresentationFullscreen({
  open,
  slides,
  startId,
  company,
  template,
  presentationTitle,
  branding,
  onClose,
}: {
  open: boolean;
  slides: PresentationSlide[];
  startId?: string | null;
  company: CompanyProfile | null;
  template: PresentationTemplate;
  presentationTitle: string;
  branding?: SlideBranding;
  onClose: () => void;
}) {
  const visible = slides.filter((s) => s.is_visible);
  const [index, setIndex] = useState(0);
  const [size, setSize] = useState({ w: 1280, h: 720 });

  useEffect(() => {
    if (!open) return;
    const start = visible.findIndex((s) => s.id === startId);
    setIndex(start >= 0 ? start : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, startId]);

  const measure = useCallback(() => {
    const w = Math.min(window.innerWidth - 48, ((window.innerHeight - 120) * SLIDE_W) / SLIDE_H);
    setSize({ w: Math.max(320, w), h: (Math.max(320, w) * SLIDE_H) / SLIDE_W });
  }, []);

  useEffect(() => {
    if (!open) return;
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [open, measure]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        setIndex((i) => Math.min(i + 1, Math.max(visible.length - 1, 0)));
      }
      if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        setIndex((i) => Math.max(i - 1, 0));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, visible.length]);

  if (!open) return null;

  const slide = visible[index] ?? null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Просмотр презентации"
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-4 bg-black/95 p-4"
    >
      <Button
        variant="ghost"
        size="icon"
        aria-label="Закрыть просмотр"
        className="absolute right-4 top-4 text-white hover:bg-white/10 hover:text-white"
        onClick={onClose}
      >
        <X className="h-5 w-5" />
      </Button>

      {slide ? (
        <div style={{ width: size.w }}>
          <SlideCanvas
            slide={slide}
            company={company}
            template={template}
            presentationTitle={presentationTitle}
            width={size.w}
            index={index}
            total={visible.length}
          {...(branding ?? {})}
              />
        </div>
      ) : (
        <p className="text-white/70">Нет видимых слайдов для показа</p>
      )}

      <div className="flex items-center gap-3 text-sm text-white/80">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Предыдущий слайд"
          disabled={index === 0}
          className="text-white hover:bg-white/10 hover:text-white disabled:opacity-30"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <span className="tabular-nums">
          {visible.length ? index + 1 : 0} / {visible.length}
        </span>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Следующий слайд"
          disabled={index >= visible.length - 1}
          className="text-white hover:bg-white/10 hover:text-white disabled:opacity-30"
          onClick={() => setIndex((i) => Math.min(visible.length - 1, i + 1))}
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
