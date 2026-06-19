import { Link } from "@tanstack/react-router";
import { ShoppingCart } from "lucide-react";

const CATALOG_LINKS = [
  { to: "/zones" as const, label: "Зоны" },
  { to: "/equipment" as const, label: "Оборудование" },
  { to: "/services" as const, label: "Услуги" },
  { to: "/production" as const, label: "Производство" },
];

export function EmptyCart() {
  return (
    <div className="glass rounded-xl p-8 text-center space-y-4">
      <ShoppingCart className="h-10 w-10 mx-auto text-muted-foreground" aria-hidden="true" />
      <p className="text-muted-foreground">Перейдите в каталог и нажмите «В корзину».</p>
      <div className="mt-4 flex justify-center gap-3 flex-wrap">
        {CATALOG_LINKS.map((s) => (
          <Link
            key={s.to}
            to={s.to}
            className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 px-4 py-2 text-sm font-medium hover:bg-primary/10 transition"
          >
            {s.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
