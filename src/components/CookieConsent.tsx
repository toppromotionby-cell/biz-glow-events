// CookieConsent — простой баннер, выбор сохраняется в localStorage.
// Compliance: трекинг-скрипты (GTM/Метрика) должны проверять этот флаг перед загрузкой.
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const KEY = "eh_cookie_consent";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem(KEY)) setVisible(true);
  }, []);

  if (!visible) return null;

  const decide = (v: "accept" | "reject") => {
    localStorage.setItem(KEY, v);
    try { window.dispatchEvent(new CustomEvent("eh:consent-change", { detail: v })); } catch {}
    setVisible(false);
  };


  return (
    <div
      className="fixed inset-x-0 z-50 px-3 animate-in fade-in slide-in-from-bottom-2"
      style={{ bottom: "calc(0.5rem + env(safe-area-inset-bottom) + var(--mobile-bar-h, 0px))" }}
      role="region"
      aria-label="Согласие на использование cookies"
    >
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2 rounded-xl glass-strong px-4 py-2.5 shadow-elegant">
        <p className="text-xs text-foreground/85">
          Используем cookies для аналитики.{" "}
          <a href="/privacy" className="text-accent underline">Политика конфиденциальности</a>.
        </p>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" variant="ghost" onClick={() => decide("reject")}>Отклонить</Button>
          <Button size="sm" onClick={() => decide("accept")} className="bg-gradient-primary">Принять</Button>
        </div>
      </div>
    </div>
  );
}
