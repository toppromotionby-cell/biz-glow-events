import { useState } from "react";
import { toast } from "sonner";
import { lovable } from "@/integrations/lovable/index";
import { useSectionEnabled } from "@/lib/site-sections";
import { isEmbeddedOAuthContext, openOAuthInNewTab } from "@/lib/oauth-redirect";

export function AppleButton({ label = "Продолжить с Apple" }: { label?: string }) {
  const enabled = useSectionEnabled("auth.apple");
  const [loading, setLoading] = useState(false);
  if (!enabled) return null;
  return (
    <button
      type="button"
      disabled={loading}
      onClick={async () => {
        if (isEmbeddedOAuthContext()) {
          if (!openOAuthInNewTab("apple")) {
            toast.error("Разрешите всплывающие окна для входа через Apple");
          }
          return;
        }

        setLoading(true);
        try {
          console.log("[AppleButton] starting OAuth", { origin: window.location.origin });
          const res = await lovable.auth.signInWithOAuth("apple", {
            redirect_uri: window.location.origin,
          });
          console.log("[AppleButton] result", res);
          if (res.error) {
            setLoading(false);
            toast.error(res.error.message ?? "Не удалось войти через Apple");
            return;
          }
          if (res.redirected) return;
        } catch (e) {
          console.error("[AppleButton] exception", e);
          setLoading(false);
          toast.error(e instanceof Error ? e.message : "Ошибка входа через Apple");
          return;
        }
        window.location.href = "/profile";
      }}
      className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-border bg-background/60 px-4 py-2.5 text-sm font-medium hover:bg-primary/10 hover:border-primary/40 transition disabled:opacity-60"
      aria-label={label}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M16.365 1.43c0 1.14-.464 2.27-1.224 3.08-.83.88-2.17 1.55-3.27 1.46-.13-1.13.45-2.3 1.18-3.07.82-.87 2.21-1.5 3.31-1.47zM20.5 17.27c-.55 1.27-.82 1.84-1.53 2.96-.99 1.56-2.39 3.5-4.13 3.51-1.55.02-1.95-1-4.05-.99-2.1.01-2.54 1.01-4.09.99-1.74-.02-3.07-1.77-4.06-3.33-2.77-4.36-3.06-9.47-1.35-12.19 1.21-1.93 3.13-3.06 4.93-3.06 1.84 0 3 1.01 4.52 1.01 1.48 0 2.38-1.01 4.51-1.01 1.61 0 3.31.88 4.52 2.4-3.97 2.18-3.32 7.85.73 9.71z"/>
      </svg>
      {loading ? "Открываем Apple..." : label}
    </button>
  );
}
