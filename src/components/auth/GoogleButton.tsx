import { useState } from "react";
import { toast } from "sonner";
import { lovable } from "@/integrations/lovable/index";
import { useSectionEnabled } from "@/lib/site-sections";

export function GoogleButton({ label = "Продолжить с Google" }: { label?: string }) {
  const enabled = useSectionEnabled("auth.google");
  const [loading, setLoading] = useState(false);
  if (!enabled) return null;
  return (
    <button
      type="button"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        try {
          console.log("[GoogleButton] starting OAuth", { origin: window.location.origin });
          const res = await lovable.auth.signInWithOAuth("google", {
            redirect_uri: window.location.origin,
          });
          console.log("[GoogleButton] result", res);
          if (res.error) {
            setLoading(false);
            toast.error(res.error.message ?? "Не удалось войти через Google");
            return;
          }
          if (res.redirected) return;
        } catch (e) {
          console.error("[GoogleButton] exception", e);
          setLoading(false);
          toast.error(e instanceof Error ? e.message : "Ошибка входа через Google");
          return;
        }
        window.location.href = "/profile";
      }}
      className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-border bg-background/60 px-4 py-2.5 text-sm font-medium hover:bg-primary/10 hover:border-primary/40 transition disabled:opacity-60"
      aria-label={label}
    >
      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8a12 12 0 110-24c3 0 5.7 1.1 7.8 3l5.7-5.7A20 20 0 1024 44c11 0 20-8 20-20 0-1.3-.1-2.3-.4-3.5z"/>
        <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3 0 5.7 1.1 7.8 3l5.7-5.7A20 20 0 006.3 14.7z"/>
        <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3A12 12 0 0112.7 28l-6.5 5A20 20 0 0024 44z"/>
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3a12 12 0 01-4.1 5.5l6.3 5.3c-.4.4 6.5-4.7 6.5-14.8 0-1.3-.1-2.3-.4-3.5z"/>
      </svg>
      {loading ? "Открываем Google..." : label}
    </button>
  );
}
