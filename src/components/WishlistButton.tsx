import { Heart } from "lucide-react";
import { toast } from "sonner";
import { toggleWishlist, useWishlist } from "@/lib/wishlist";
import type { CartEntityType } from "@/lib/cart";
import { useAuth } from "@/hooks/use-auth";

export function WishlistButton({
  entity_type, id, slug, title, price, image,
}: {
  entity_type: CartEntityType;
  id: string;
  slug: string;
  title: string;
  price: number;
  image?: string | null;
}) {
  const { has } = useWishlist();
  const active = has(id, entity_type);
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={active ? `Удалить «${title}» из избранного` : `Добавить «${title}» в избранное`}
      onClick={() => {
        const added = toggleWishlist({ entity_type, id, slug, title, price, image });
        toast.success(added ? `«${title}» в избранном` : `«${title}» удалено из избранного`);
      }}
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
