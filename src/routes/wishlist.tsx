import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useWishlist, removeFromWishlist, clearWishlist } from "@/lib/wishlist";
import { addToCart } from "@/lib/cart";

export const Route = createFileRoute("/wishlist")({
  head: () => ({
    meta: [
      { title: "Избранное — event-hub.by" },
      { name: "description", content: "Сохранённые позиции каталога event-hub.by." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: WishlistPage,
});

const fmt = new Intl.NumberFormat("ru-BY", { style: "currency", currency: "BYN", maximumFractionDigits: 0 });

const SLUG_BASE: Record<string, string> = {
  zones: "/zones",
  tech_equipment: "/equipment",
  services: "/services",
  production_items: "/production",
  attractions: "/attractions",
};

function WishlistPage() {
  const { items, count } = useWishlist();

  function moveAllToCart() {
    if (items.length === 0) return;
    let added = 0;
    items.forEach(i => {
      const res = addToCart({
        id: i.id, entity_type: i.entity_type, slug: i.slug,
        title: i.title, price: i.price, image: i.image, qty: 1,
      });
      if (res.added) added += 1;
    });
    toast.success(added > 0 ? `Добавлено в корзину: ${added}` : "Все позиции уже в корзине");
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-display font-bold gradient-text">Избранное</h1>
          <p className="mt-2 text-muted-foreground">
            {count > 0 ? `Сохранено позиций: ${count}` : "Пока ничего не сохранено."}
          </p>
        </div>
        {count > 0 && (
          <div className="flex gap-2">
            <button onClick={moveAllToCart} className="rounded-md bg-gradient-primary px-4 py-2 text-sm font-medium text-primary-foreground glow-primary">
              Перенести всё в корзину
            </button>
            <button onClick={clearWishlist} className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground">
              Очистить
            </button>
          </div>
        )}
      </header>

      {items.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center">
          <Heart className="h-10 w-10 mx-auto text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 text-muted-foreground">Откройте каталог и добавьте интересные позиции в избранное.</p>
          <div className="mt-6 flex justify-center gap-3 flex-wrap">
            <Link to="/zones" className="rounded-md border border-primary/40 px-4 py-2 text-sm hover:bg-primary/10">Зоны</Link>
            <Link to="/equipment" className="rounded-md border border-primary/40 px-4 py-2 text-sm hover:bg-primary/10">Оборудование</Link>
            <Link to="/services" className="rounded-md border border-primary/40 px-4 py-2 text-sm hover:bg-primary/10">Услуги</Link>
            <Link to="/production" className="rounded-md border border-primary/40 px-4 py-2 text-sm hover:bg-primary/10">Производство</Link>
          </div>
        </div>
      ) : (
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(i => {
            const href = `${SLUG_BASE[i.entity_type] ?? "/"}/${i.slug}`;
            return (
              <li key={`${i.entity_type}:${i.id}`} className="glass rounded-xl overflow-hidden flex flex-col">
                <Link to={href} className="block aspect-[16/10] bg-surface">
                  {i.image ? (
                    <img src={i.image} alt={i.title} loading="lazy" className="h-full w-full object-cover" />
                  ) : null}
                </Link>
                <div className="p-4 flex-1 flex flex-col">
                  <Link to={href} className="font-medium hover:text-primary line-clamp-2">{i.title}</Link>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {i.price > 0 ? `от ${fmt.format(i.price)}` : "По запросу"}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => {
                        const res = addToCart({ id: i.id, entity_type: i.entity_type, slug: i.slug, title: i.title, price: i.price, image: i.image, qty: 1 });
                        toast[res.added ? "success" : "info"](res.added ? `«${i.title}» добавлено в корзину` : "Уже в корзине — количество можно изменить там");
                      }}
                      className="flex-1 rounded-md bg-gradient-primary px-3 py-2 text-xs font-medium text-primary-foreground glow-primary"
                    >
                      В корзину
                    </button>
                    <button
                      onClick={() => removeFromWishlist(i.id, i.entity_type)}
                      aria-label={`Удалить «${i.title}»`}
                      className="rounded-md border border-border px-2 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
