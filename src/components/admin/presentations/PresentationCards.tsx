// Плиточное представление списка презентаций.
import { Copy, MoreHorizontal, Pencil, Presentation as PresentationIcon, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/admin/StatusPill";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { fmtDate } from "@/lib/formatters";
import { STATUS_LABELS, TEMPLATE_LABELS, type PresentationListRow } from "@/lib/presentations/model";

const COVER: Record<string, string> = {
  light: "bg-gradient-to-br from-muted to-background text-foreground",
  dark: "bg-gradient-to-br from-slate-900 to-slate-700 text-white",
  accent: "bg-gradient-to-br from-primary to-slate-900 text-primary-foreground",
};

const TONE: Record<string, "muted" | "info" | "success"> = {
  draft: "muted",
  ready: "success",
  archived: "info",
};

export function PresentationCards({
  rows,
  onOpen,
  onRename,
  onDuplicate,
  onDelete,
}: {
  rows: PresentationListRow[];
  onOpen: (r: PresentationListRow) => void;
  onRename: (r: PresentationListRow) => void;
  onDuplicate: (r: PresentationListRow) => void;
  onDelete: (r: PresentationListRow) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map((r) => (
        <article key={r.id} className="glass flex flex-col overflow-hidden rounded-xl border border-border/50">
          <button
            type="button"
            onClick={() => onOpen(r)}
            aria-label={`Открыть презентацию ${r.title}`}
            className={`flex aspect-video w-full flex-col justify-end gap-1 p-4 text-left ${COVER[r.template] ?? COVER.light}`}
          >
            <PresentationIcon className="h-5 w-5 opacity-70" aria-hidden />
            <span className="line-clamp-2 text-base font-semibold">{r.title}</span>
            <span className="text-xs opacity-80">{TEMPLATE_LABELS[r.template]}</span>
          </button>

          <div className="flex items-start justify-between gap-2 p-3">
            <div className="min-w-0 space-y-1 text-xs text-muted-foreground">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill tone={TONE[r.status] ?? "muted"}>{STATUS_LABELS[r.status]}</StatusPill>
                <span className="tabular-nums">{r.slides_count} слайдов</span>
              </div>
              <p className="truncate">{r.company_name ?? "Компания не выбрана"}</p>
              <p>Обновлена {fmtDate(r.updated_at)}</p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={`Действия: ${r.title}`}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onOpen(r)}>Открыть</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onRename(r)}>
                  <Pencil className="mr-2 h-4 w-4" />Переименовать
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDuplicate(r)}>
                  <Copy className="mr-2 h-4 w-4" />Дублировать
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={() => onDelete(r)}>
                  <Trash2 className="mr-2 h-4 w-4" />Удалить
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </article>
      ))}
    </div>
  );
}
