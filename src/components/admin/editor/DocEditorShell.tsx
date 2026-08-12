// Единый шелл редактора документов (КП и КП промо) — та же схема, что и в
// редакторе презентаций: шапка, левый рельс разделов, лист по центру,
// панель свойств справа и строка статуса снизу.
import { useState, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { FullscreenLayer } from "@/components/FullscreenLayer";
import { EditorSidebar, type EditorSection } from "@/components/admin/editor/EditorSidebar";
import { DocCanvasStage } from "@/components/admin/editor/DocCanvasStage";
import { DocEditorFooter } from "@/components/admin/editor/DocEditorFooter";

export type { EditorSection };

export function DocEditorShell({
  title,
  subtitle,
  actions,
  sections,
  defaultSection = null,
  sheet,
  rightPanel,
  footerLeft,
  hint,
  children,
}: {
  /** Название документа (обычно инлайн-инпут). */
  title: ReactNode;
  /** Строка под названием: номер, статус, состояние сохранения. */
  subtitle?: ReactNode;
  /** Кнопки справа в шапке. */
  actions?: ReactNode;
  sections: EditorSection[];
  defaultSection?: string | null;
  /** Содержимое листа: получает натуральную ширину A4 и доступную высоту. */
  sheet: (ctx: { width: number; height: number; scale: number }) => ReactNode;
  rightPanel?: ReactNode;
  footerLeft?: ReactNode;
  hint?: string;
  /** Диалоги и прочее вне разметки. */
  children?: ReactNode;
}) {
  const [active, setActive] = useState<string | null>(defaultSection);
  const [zoom, setZoom] = useState(1);

  const current = sections.find((s) => s.id === active) ?? null;

  return (
    <FullscreenLayer className="flex flex-col bg-background" label="Редактор документа">
      <div className="flex h-full min-h-0 flex-col bg-background">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <Button variant="ghost" size="icon" aria-label="К документам" asChild>
              <Link to="/admin/documents"><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
            <div className="min-w-0">
              {title}
              {subtitle && (
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">{subtitle}</div>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        </header>

        <div className="flex min-h-0 flex-1">
          <div className="hidden min-h-0 md:flex">
            <EditorSidebar sections={sections} active={active} onChange={setActive} />
          </div>

          <div className="flex min-w-0 flex-1 flex-col">
            <DocCanvasStage zoom={zoom}>{sheet}</DocCanvasStage>
            <DocEditorFooter zoom={zoom} onZoom={setZoom} hint={hint} left={footerLeft} />
          </div>

          {rightPanel && (
            <aside className="hidden w-[320px] shrink-0 flex-col overflow-y-auto border-l border-border/60 p-4 xl:flex">
              {rightPanel}
            </aside>
          )}
        </div>

        {/* На узких экранах разделы показываем снизу отдельной полосой */}
        <div className="border-t border-border/60 md:hidden">
          <div className="flex gap-1 overflow-x-auto p-2">
            {sections.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setActive(s.id === active ? null : s.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium ${
                  s.id === active ? "bg-primary/10 text-primary" : "text-muted-foreground"
                }`}
              >
                <s.Icon className="h-4 w-4" />{s.label}
              </button>
            ))}
          </div>
          {current && (
            <div className="max-h-[45vh] overflow-y-auto border-t border-border/60 p-3">{current.content}</div>
          )}
        </div>
      </div>
      {children}
    </FullscreenLayer>
  );
}
