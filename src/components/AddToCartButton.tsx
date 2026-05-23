import { useState } from "react";
import { toast } from "sonner";
import { addToCart, type CartEntityType } from "@/lib/cart";
import { trackAddToCart } from "@/lib/analytics";

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
  const [added, setAdded] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        addToCart({ entity_type, id, slug, title, price, image, qty: 1 });
        trackAddToCart({
          item_id: id,
          item_name: title,
          item_category: entity_type,
          price,
          quantity: 1,
        });
        setAdded(true);
        toast.success(`«${title}» добавлено в корзину`);
        setTimeout(() => setAdded(false), 1500);
      }}
      className="mt-2 inline-flex w-full justify-center rounded-md border border-primary/40 px-5 py-2.5 text-sm font-medium text-foreground hover:bg-primary/10 transition"
    >
      {added ? "Добавлено ✓" : "В корзину"}
    </button>
  );
}

