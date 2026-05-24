// Баннер восстановления корзины + автонотификация в Telegram через 1 час бездействия.
import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ShoppingCart, X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { notifyAbandonedCart } from "@/lib/cart-recovery.functions";

const DISMISS_KEY = "eh_cart_recovery_dismissed_v1";
const NOTIFIED_KEY = "eh_cart_abandoned_notified_v1";
const INACTIVITY_MS = 60 * 60 * 1000; // 1 час

function hashCart(items: { title: string; qty: number }[]): string {
  const s = items
    .map((i) => `${i.title}|${i.qty}`)
    .sort()
    .join("::");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

export function CartRecoveryBanner() {
  const { items, count, total } = useCart();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useAuth();
  const notify = useServerFn(notifyAbandonedCart);
  const [show, setShow] = useState(false);
  const timerRef = useRef<number | null>(null);

  // Баннер: показываем через 6с
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (count === 0) { setShow(false); return; }
    if (path === "/cart" || path === "/order/success") { setShow(false); return; }
    if (sessionStorage.getItem(DISMISS_KEY)) return;
    const t = window.setTimeout(() => setShow(true), 6000);
    return () => window.clearTimeout(t);
  }, [count, path]);

  // Нотификация админу через 1ч бездействия
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (timerRef.current) { window.clearTimeout(timerRef.current); timerRef.current = null; }
    if (count === 0 || path === "/cart" || path === "/order/success") return;

    const cart_hash = hashCart(items.map((i) => ({ title: i.title, qty: i.qty })));
    let notified: Record<string, number> = {};
    try { notified = JSON.parse(localStorage.getItem(NOTIFIED_KEY) ?? "{}"); } catch {}
    // Если для этого хеша уже отправляли за последние 24ч — пропускаем.
    const last = notified[cart_hash];
    if (last && Date.now() - last < 24 * 60 * 60 * 1000) return;

    timerRef.current = window.setTimeout(async () => {
      try {
        let profile: { full_name?: string; email?: string; phone?: string } | null = null;
        if (user) {
          const { data } = await supabase
            .from("profiles")
            .select("full_name,email,phone")
            .eq("id", user.id)
            .maybeSingle();
          profile = data;
        }
        await notify({ data: {
          cart_hash,
          client_name: profile?.full_name ?? null,
          client_email: profile?.email ?? user?.email ?? null,
          client_phone: profile?.phone ?? null,
          user_id: user?.id ?? null,
          items: items.map((i) => ({ title: i.title, qty: i.qty, price: i.price })),
          total,
          page_url: typeof window !== "undefined" ? window.location.href : null,
        }});
        notified[cart_hash] = Date.now();
        try { localStorage.setItem(NOTIFIED_KEY, JSON.stringify(notified)); } catch {}
      } catch (e) {
        // тихо — не мешаем UX
        console.warn("[abandoned-cart] notify failed", e);
      }
    }, INACTIVITY_MS);

    return () => {
      if (timerRef.current) { window.clearTimeout(timerRef.current); timerRef.current = null; }
    };
  }, [items, count, total, path, user, notify]);

  if (!show || count === 0 || path === "/cart") return null;

  const dismiss = () => {
    setShow(false);
    try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch {}
  };

  return (
    <div className="fixed bottom-4 left-1/2 z-50 w-[min(92vw,520px)] -translate-x-1/2 rounded-xl border border-border/60 bg-background/95 p-4 shadow-2xl backdrop-blur-md md:bottom-6">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Закрыть"
        className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-colors hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <X className="h-4 w-4" strokeWidth={2.5} />
      </button>
      <div className="flex items-center gap-3 pr-12">
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
