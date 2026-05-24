import { Scale } from "lucide-react";
import { toast } from "sonner";
import { toggleCompare, useCompare, COMPARE_MAX } from "@/lib/compare";
import type { CartEntityType } from "@/lib/cart";
import { useAuth } from "@/hooks/use-auth";

export function CompareButton({
  entity_type, id, slug, title, price, image,
}: {
  entity_type: CartEntityType;
  id: string;
  slug: string;
  title: string;
  price: number;
  image?: string | null;
}) {
  const { has } = useCompare();
  const active = has(id, entity_type);
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={active ? `Убрать «${title}» из сравнения` : `Добавить «${title}» в сравнение`}
      onClick={() => {
        const r = toggleCompare({ entity_type, id, slug, title, price, image });
        if (r === "added") toast.success(`«${title}» в сравнении`);
        else if (r === "removed") toast.success(`«${title}» убрано из сравнения`);
        else if (r === "limit") toast.error(`Максимум ${COMPARE_MAX} позиции`);
        else toast.error("Можно сравнивать только позиции одного типа");
      }}
      className={`mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md border px-5 py-2 text-sm font-medium transition ${
        active
          ? "border-primary/60 bg-primary/10 text-foreground"
          : "border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
      }`}
    >
      <Scale className={`h-4 w-4 ${active ? "text-primary" : ""}`} aria-hidden="true" />
      {active ? "В сравнении" : "Сравнить"}
    </button>
  );
}
