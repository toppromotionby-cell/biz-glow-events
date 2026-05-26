import { Heart } from "lucide-react";
import { toast } from "sonner";
import { toggleWishlist, useWishlist } from "@/lib/wishlist";
import type { CartEntityType } from "@/lib/cart";
import { useRequireAuth } from "@/hooks/use-require-auth";

export function WishlistButton({
  entity_type, id, slug, title, price, image, compact = false,
}: {
  entity_type: CartEntityType;
  id: string;
  slug: string;
  title: string;
  price: number;
  image?: string | null;
  compact?: boolean;
}) {
  const { has } = useWishlist();
  const requireAuth = useRequireAuth();
  const active = has(id, entity_type);
  const onClick = requireAuth(() => {
    const added = toggleWishlist({ entity_type, id, slug, title, price, image });
    toast.success(added ? `«${title}» в избранном` : `«${title}» удалено из избранного`);
  }, "Войдите, чтобы сохранить позицию в избранное.");

  if (compact) {
    return (
      <button
        type="button"
        aria-pressed={active}
        aria-label={active ? `Удалить «${title}» из избранного` : `Добавить «${title}» в избранное`}
        onClick={onClick}
        className={`inline-flex h-9 w-9 items-center justify-center rounded-md border transition ${
          active
            ? "border-primary/60 bg-primary/10 text-primary"
            : "border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
        }`}
      >
        <Heart className={`h-4 w-4 ${active ? "fill-primary text-primary" : ""}`} aria-hidden="true" />
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={active ? `Удалить «${title}» из избранного` : `Добавить «${title}» в избранное`}
      onClick={onClick}
      className={`mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md border px-5 py-2 text-sm font-medium transition ${
        active
          ? "border-primary/60 bg-primary/10 text-foreground"
          : "border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
      }`}
    >
      <Heart className={`h-4 w-4 ${active ? "fill-primary text-primary" : ""}`} aria-hidden="true" />
      {active ? "В избранном" : "В избранное"}
    </button>
  );
}
