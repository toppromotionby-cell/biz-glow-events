import { toast } from "sonner";
import { ShoppingCart, Check } from "lucide-react";
import { addToCart, removeFromCart, useCart, type CartEntityType } from "@/lib/cart";
import { trackAddToCart } from "@/lib/analytics";
import { useAuth } from "@/hooks/use-auth";

export function AddToCartButton({
  entity_type, id, slug, title, price, image,
}: {
  entity_type: CartEntityType;
  id: string;
  slug: string;
  title: string;
  price: number;
  image?: string | null;
}) {
  const { isAuthenticated } = useAuth();
  const { items } = useCart();
  if (!isAuthenticated) return null;
  const inCart = items.some((c) => c.id === id && c.entity_type === entity_type);
  return (
    <button
      type="button"
      aria-pressed={inCart}
      aria-label={inCart ? `Убрать «${title}» из корзины` : `Добавить «${title}» в корзину`}
      onClick={() => {
        if (inCart) {
          removeFromCart(id, entity_type);
          toast.success(`«${title}» убрано из корзины`);
        } else {
          addToCart({ entity_type, id, slug, title, price, image, qty: 1 });
          trackAddToCart({ item_id: id, item_name: title, item_category: entity_type, price, quantity: 1 });
          toast.success(`«${title}» добавлено в корзину`);
        }
      }}
      className={`mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md border px-5 py-2.5 text-sm font-medium transition ${
        inCart
          ? "border-primary/60 bg-primary/10 text-foreground"
          : "border-primary/40 text-foreground hover:bg-primary/10"
      }`}
    >
      {inCart ? <Check className="h-4 w-4 text-primary" aria-hidden="true" /> : <ShoppingCart className="h-4 w-4" aria-hidden="true" />}
      {inCart ? "В корзине" : "В корзину"}
    </button>
  );
}
