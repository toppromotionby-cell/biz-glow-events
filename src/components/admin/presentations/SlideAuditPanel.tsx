// Панель «Проверка»: единый список замечаний по шрифтам, вмещаемости текста
// и раскладке блоков. Клик по строке открывает нужный слайд.
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { auditPresentation, type AuditIssue } from "@/lib/presentations/audit";
import type { PresentationSlide } from "@/lib/presentations/model";

const BLOCK_LABEL: Record<AuditIssue["block"], string> = {
  title: "Заголовок",
  text: "Текст",
  photo: "Фото",
  price: "Цена",
  layout: "Раскладка",
};

export function SlideAuditPanel(props: {
  slides: PresentationSlide[];
  onSelectSlide: (id: string) => void;
}) {
  const report = auditPresentation(props.slides);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Проверка шрифтов, вмещаемости текста и раскладки на всех видимых слайдах.
        </p>
      </div>

      <div className="flex items-center gap-3 text-xs">
        <span className="inline-flex items-center gap-1 text-destructive">
          <XCircle className="h-3.5 w-3.5" aria-hidden /> {report.errors} ошибок
        </span>
        <span className="inline-flex items-center gap-1 text-amber-600">
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> {report.warns} замечаний
        </span>
      </div>

      {report.issues.length === 0 ? (
        <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/40 p-3 text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />
          Все слайды в порядке: текст помещается, шрифты ровные.
        </div>
      ) : (
        <ul className="space-y-1.5">
          {report.issues.map((issue, i) => (
            <li key={`${issue.slideId}-${i}`}>
              <Button
                variant="ghost"
                className="h-auto w-full justify-start whitespace-normal rounded-md border border-border/60 px-2.5 py-2 text-left"
                onClick={() => props.onSelectSlide(issue.slideId)}
              >
                <span className="flex items-start gap-2">
                  {issue.level === "error" ? (
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
                  ) : (
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden />
                  )}
                  <span className="min-w-0">
                    <span className="block text-xs text-muted-foreground">
                      Слайд {issue.slideIndex + 1} · {BLOCK_LABEL[issue.block]} · {issue.slideTitle}
                    </span>
                    <span className="block text-sm">{issue.message}</span>
                  </span>
                </span>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
