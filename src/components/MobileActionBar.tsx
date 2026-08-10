// Мобильная панель быстрых действий: звонок, Telegram, корзина.
// Показывается только на мобильных и скрыта в админке и на чекауте.
import { useRouterState } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Phone, Send, ShoppingCart } from "lucide-react";
import { CONTACT } from "@/lib/contacts";
import { useCart } from "@/lib/cart";
import { trackSocialClick } from "@/lib/analytics";

const HIDDEN_PREFIXES = ["/admin", "/cart", "/checkout", "/auth"];

export function MobileActionBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { count } = useCart();
  if (HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;

  const cls =
    "flex h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-foreground/90 transition active:bg-primary/10";

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 md:hidden glass-strong border-t border-border/60"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <nav className="flex items-stretch" aria-label="Быстрые действия">
        <a href={`tel:${CONTACT.phoneTel}`} className={cls} aria-label={`Позвонить ${CONTACT.phoneDisplay}`}>
          <Phone className="h-5 w-5 text-primary" aria-hidden="true" />
          Позвонить
        </a>
        <a
          href={CONTACT.telegramUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cls}
          aria-label="Написать в Telegram"
          onClick={() => trackSocialClick("telegram", "mobile_bar", CONTACT.telegramUrl)}
        >
          <Send className="h-5 w-5 text-primary" aria-hidden="true" />
          Telegram
        </a>
        <Link to="/cart" className={cls} aria-label={`Корзина${count > 0 ? `, позиций: ${count}` : ""}`}>
          <span className="relative">
            <ShoppingCart className="h-5 w-5 text-primary" aria-hidden="true" />
            {count > 0 && (
              <span className="absolute -right-2 -top-1.5 min-w-4 rounded-full bg-primary px-1 text-[10px] leading-4 text-primary-foreground">
                {count}
              </span>
            )}
          </span>
          Корзина
        </Link>
      </nav>
    </div>
  );
}
