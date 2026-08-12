// Левая колонка редактора презентаций: вертикальный рельс разделов и
// выдвижная панель с содержимым выбранного раздела — как в Canva.
import type { ComponentType, ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export type EditorSection = {
  id: string;
  label: string;
  Icon: ComponentType<{ className?: string }>;
  /** Точка-индикатор на кнопке раздела (например, расхождения с КП). */
  dot?: boolean;
  content: ReactNode;
};

export function EditorSidebar({
  sections,
  active,
  onChange,
}: {
  sections: EditorSection[];
  /** null — панель свёрнута, виден только рельс. */
  active: string | null;
  onChange: (id: string | null) => void;
}) {
  const current = sections.find((s) => s.id === active) ?? null;

  return (
    <div className="flex h-full min-h-0">
      <nav
        className="flex w-[72px] shrink-0 flex-col gap-1 border-r border-border/60 bg-muted/30 p-2"
        aria-label="Разделы редактора"
      >
        {sections.map((s) => {
          const on = s.id === active;
          return (
            <button
              key={s.id}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? null : s.id)}
              className={`relative flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-[10px] font-medium transition ${
                on ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <s.Icon className="h-5 w-5" />
              <span className="leading-tight">{s.label}</span>
              {s.dot && <span className="absolute right-2 top-1.5 h-1.5 w-1.5 rounded-full bg-amber-500" />}
            </button>
          );
        })}
      </nav>

      {current && (
        <div className="flex w-[290px] shrink-0 flex-col border-r border-border/60 bg-background">
          <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
            <span className="text-sm font-medium">{current.label}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label="Свернуть панель"
              onClick={() => onChange(null)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">{current.content}</div>
        </div>
      )}
    </div>
  );
}
