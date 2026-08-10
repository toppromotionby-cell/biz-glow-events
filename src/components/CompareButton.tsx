// Кнопка «Сравнить» для карточек и модалок каталога.
import { GitCompare } from "lucide-react";
import { toast } from "sonner";
import { toggleCompare, useCompare, COMPARE_LIMIT, type CompareItem } from "@/lib/compare";

export function CompareButton({
  item,
  variant = "icon",
  className = "",
}: {
  item: CompareItem;
  variant?: "icon" | "full";
  className?: string;
}) {
  const { has } = useCompare();
  const active = has(item.slug, item.entity_type);

  const onClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const res = toggleCompare(item);
    if (res.limitReached) {
      toast.error(`Можно сравнивать не более ${COMPARE_LIMIT} позиций`);
      return;
    }
    toast.success(res.added ? "Добавлено к сравнению" : "Убрано из сравнения");
  };

  if (variant === "full") {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className={`inline-flex items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition ${
          active
            ? "border-primary bg-primary/20 text-foreground"
            : "border-primary/40 bg-primary/5 text-muted-foreground hover:bg-primary/10 hover:text-foreground"
        } ${className}`}
      >
        <GitCompare className="h-4 w-4 text-primary" aria-hidden="true" />
        {active ? "В сравнении" : "Сравнить"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={active ? `Убрать из сравнения: ${item.title}` : `Сравнить: ${item.title}`}
      title={active ? "Убрать из сравнения" : "Сравнить"}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-md border transition ${
        active
          ? "border-primary bg-primary/20 text-foreground"
          : "border-primary/30 bg-background/70 text-muted-foreground hover:border-primary/60 hover:text-foreground"
      } ${className}`}
    >
      <GitCompare className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}
