// Откладывает монтирование некритичных глобальных виджетов до простоя браузера.
// Это убирает их из initial JS-работы (LCP/TTI), сохраняя поведение.
import { lazy, Suspense, useEffect, useState } from "react";
import { Toggleable } from "@/lib/site-sections";

const EffectsLayer = lazy(() => import("@/components/EffectsLayer").then((m) => ({ default: m.EffectsLayer })));
const FloatingContacts = lazy(() => import("@/components/FloatingContacts").then((m) => ({ default: m.FloatingContacts })));
const CartSync = lazy(() => import("@/components/CartSync").then((m) => ({ default: m.CartSync })));
const ScriptInjector = lazy(() => import("@/components/ScriptInjector").then((m) => ({ default: m.ScriptInjector })));
const CookieConsent = lazy(() => import("@/components/CookieConsent").then((m) => ({ default: m.CookieConsent })));
const ExitIntentModal = lazy(() => import("@/components/ExitIntentModal").then((m) => ({ default: m.ExitIntentModal })));

export function DeferredGlobals() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    const start = () => { if (!cancelled) setReady(true); };
    const ric: typeof window.requestIdleCallback | undefined = (window as unknown as { requestIdleCallback?: typeof window.requestIdleCallback }).requestIdleCallback;
    const handle = ric
      ? ric(start, { timeout: 2500 })
      : window.setTimeout(start, 1200);
    return () => {
      cancelled = true;
      if (ric && typeof handle === "number") {
        (window as unknown as { cancelIdleCallback?: (h: number) => void }).cancelIdleCallback?.(handle);
      } else if (typeof handle === "number") {
        clearTimeout(handle);
      }
    };
  }, []);

  if (!ready) return null;

  return (
    <Suspense fallback={null}>
      <EffectsLayer />
      <Toggleable sectionKey="global.cookies"><CookieConsent /></Toggleable>
      <FloatingContacts />
      <CartSync />
      <ScriptInjector />
      <Toggleable sectionKey="global.exit_intent"><ExitIntentModal /></Toggleable>
    </Suspense>
  );
}
