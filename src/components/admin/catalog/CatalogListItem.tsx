import { AlertTriangle, Copy, Pencil } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { StorageImg } from "@/components/StorageMedia";
import { StatusPill } from "@/components/admin/StatusPill";
import { draftIssues, type Row } from "./shared";

export function CatalogListItem({
  item,
  handle,
  active,
  checked,
  onPreview,
  onToggleCheck,
  onEdit,
  onDuplicate,
}: {
  item: Row;
  handle: React.ReactNode;
  active: boolean;
  checked: boolean;
  onPreview: () => void;
  onToggleCheck: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
}) {
  const issues = draftIssues(item);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onPreview}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPreview(); } }}
      className={`group relative w-full text-left p-3 rounded-lg text-sm transition cursor-pointer flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${active ? "bg-gradient-primary text-primary-foreground" : "hover:bg-muted/40"}`}
    >
      {handle}
      <span onClick={(e) => { e.stopPropagation(); onToggleCheck(); }} className="shrink-0">
        <Checkbox checked={checked} aria-label={`Выбрать ${item.title}`} />
      </span>
      {item.photo_urls?.[0] ? (
        <StorageImg path={item.photo_urls[0]} className="h-10 w-10 rounded object-cover shrink-0" fallbackClassName="h-10 w-10 rounded shrink-0" />
      ) : (
        <div className="h-10 w-10 rounded bg-muted/40 shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <div className="font-medium truncate flex items-center gap-1.5">
          <span className="truncate">{item.title}</span>
          {issues.length > 0 && (
            <span title={`Черновик: ${issues.join(", ")}`} className="shrink-0 text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5" />
            </span>
          )}
        </div>
        <div className="text-xs opacity-70 flex items-center gap-2">
          <span className="truncate">{item.slug}</span>
          <StatusPill tone={item.published ? "success" : "muted"}>{item.published ? "опубл." : "черн."}</StatusPill>
        </div>
      </div>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
          title="Дублировать"
          aria-label="Дублировать"
          className="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-background/30"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          title="Редактировать"
          aria-label="Редактировать"
          className="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-background/30"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
