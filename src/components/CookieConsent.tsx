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
    setVisible(false);
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-50 glass-strong rounded-2xl p-5 shadow-elegant animate-in fade-in slide-in-from-bottom-4">
      <p className="text-sm text-foreground/90 mb-3">
        Мы используем cookies для аналитики и улучшения сайта. Подробнее в{" "}
        <a href="/privacy" className="text-accent underline">политике конфиденциальности</a>.
      </p>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => decide("reject")}>Отклонить</Button>
        <Button size="sm" onClick={() => decide("accept")} className="bg-gradient-primary glow-primary">
          Принять
        </Button>
      </div>
    </div>
  );
}
