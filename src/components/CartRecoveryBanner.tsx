// Баннер восстановления корзины: если в корзине есть товары и пользователь не на /cart,
// показываем плашку с напоминанием. Закрытие — на сессию.
import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShoppingCart, X } from "lucide-react";
import { useCart } from "@/lib/cart";

const DISMISS_KEY = "eh_cart_recovery_dismissed_v1";

export function CartRecoveryBanner() {
  const { count, total } = useCart();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (count === 0) { setShow(false); return; }
    if (path === "/cart") { setShow(false); return; }
    if (sessionStorage.getItem(DISMISS_KEY)) return;
    const t = window.setTimeout(() => setShow(true), 6000);
    return () => window.clearTimeout(t);
  }, [count, path]);

  if (!show || count === 0 || path === "/cart") return null;

  const dismiss = () => {
    setShow(false);
    try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch {}
  };

  return (
    <div className="fixed bottom-4 left-1/2 z-50 w-[min(92vw,520px)] -translate-x-1/2 rounded-xl border border-border/60 bg-background/95 p-4 shadow-2xl backdrop-blur-md md:bottom-6">
      <button
        type="button"
        aria-label="Закрыть"
        onClick={dismiss}
        className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-center gap-3 pr-6">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gradient-primary text-primary-foreground">
          <ShoppingCart className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Вы не оформили заявку</p>
          <p className="truncate text-xs text-muted-foreground">
            В корзине {count} {count === 1 ? "позиция" : "позиций"} на сумму {Math.round(total).toLocaleString("ru-RU")} BYN
          </p>
        </div>
        <Link
          to="/cart"
          onClick={dismiss}
          className="rounded-md bg-gradient-primary px-3 py-2 text-xs font-medium text-primary-foreground glow-primary"
        >
          Завершить
        </Link>
      </div>
    </div>
  );
}
