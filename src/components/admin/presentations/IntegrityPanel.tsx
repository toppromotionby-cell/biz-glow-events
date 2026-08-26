// Панель «Целостность»: проверка структуры презентации, кнопка «Исправить
// макет» и экранный отчёт о том, какие правила сработали при починке.
import { AlertTriangle, CheckCircle2, Info, Wrench, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { IntegrityIssue, IntegrityReport, RepairAction } from "@/lib/presentations/integrity";

const LEVEL_ICON = {
  error: <XCircle className="h-3.5 w-3.5 text-destructive" aria-hidden />,
  warn: <AlertTriangle className="h-3.5 w-3.5 text-amber-600" aria-hidden />,
  info: <Info className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />,
} as const;

export function IntegrityPanel(props: {
  report: IntegrityReport;
  actions: RepairAction[] | null;
  repairing?: boolean;
  debug: boolean;
  onDebug: (v: boolean) => void;
  onRepair: () => void;
  onSelectSlide: (id: string) => void;
}) {
  const { report } = props;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Проверка при сохранении: дубликаты, пустые зоны, выход блоков за границы и
        расхождения превью с PDF.
      </p>

      <div className="flex items-center justify-between rounded-lg border border-border/60 p-2.5">
        <div className="min-w-0">
          <p className="text-sm font-medium">Режим «Отладка»</p>
          <p className="text-xs text-muted-foreground">Слой-схема зон, пустые места и конфликты</p>
        </div>
        <Switch checked={props.debug} onCheckedChange={props.onDebug} aria-label="Режим отладки" />
      </div>

      <div className="flex items-center gap-3 text-xs">
        <span className="inline-flex items-center gap-1 text-destructive">
          <XCircle className="h-3.5 w-3.5" aria-hidden /> {report.errors} ошибок
        </span>
        <span className="inline-flex items-center gap-1 text-amber-600">
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> {report.warns} замечаний
        </span>
      </div>

      <Button
        size="sm"
        className="w-full"
        disabled={!report.fixable || props.repairing}
        onClick={props.onRepair}
      >
        <Wrench className="mr-1.5 h-4 w-4" />
        Исправить макет{report.fixable ? ` (${report.fixable})` : ""}
      </Button>

      {report.issues.length === 0 ? (
        <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/40 p-3 text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />
          Проблем не найдено
        </div>
      ) : (
        <ul className="space-y-1.5">
          {report.issues.map((i: IntegrityIssue, n) => (
            <li key={`${i.slideId}-${i.code}-${n}`}>
              <button
                type="button"
                className="flex w-full items-start gap-2 rounded-md border border-border/60 p-2 text-left text-xs hover:border-primary/60"
                onClick={() => props.onSelectSlide(i.slideId)}
              >
                {LEVEL_ICON[i.level]}
                <span className="min-w-0">
                  <span className="block font-medium">
                    {i.slideIndex + 1}. {i.slideTitle}
                  </span>
                  <span className="block text-muted-foreground">{i.message}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {props.actions && (
        <div className="space-y-1.5 rounded-lg border border-border/60 p-2.5">
          <p className="text-xs font-medium">Отчёт о починке</p>
          {props.actions.length === 0 ? (
            <p className="text-xs text-muted-foreground">Чинить было нечего.</p>
          ) : (
            <ul className="space-y-1 text-xs text-muted-foreground">
              {props.actions.map((a, i) => (
                <li key={i}>
                  <span className="font-medium text-foreground">{a.slideTitle}</span> — {a.detail}
                  <span className="ml-1 opacity-60">[{a.rule}]</span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[11px] text-muted-foreground">Отчёт записан в журнал администратора.</p>
        </div>
      )}
    </div>
  );
}
