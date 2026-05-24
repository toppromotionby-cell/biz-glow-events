// Exit-intent поп-ап с промокодом + захват email в рассылку.
// Триггеры: курсор покидает окно вверху (desktop) или скрытие вкладки (mobile).
// Показывается один раз за сессию и не показывается, если уже подписан.
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { X, Gift, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { subscribeNewsletter } from "@/lib/newsletter.functions";
import { toast } from "sonner";

const SHOWN_KEY = "exit_intent_shown_v1";
const SUBSCRIBED_KEY = "newsletter_subscribed_v1";
const PROMO_CODE = "WELCOME5";

export function ExitIntentModal() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [armed, setArmed] = useState(false);

  const m = useMutation({
    mutationFn: () => subscribeNewsletter({ data: { email, source: "exit_intent" } }),
    onSuccess: () => {
      try { localStorage.setItem(SUBSCRIBED_KEY, "1"); } catch {}
      toast.success(`Промокод ${PROMO_CODE} отправлен на email`);
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (sessionStorage.getItem(SHOWN_KEY)) return;
      if (localStorage.getItem(SUBSCRIBED_KEY)) return;
    } catch {}

    // arm после 8 секунд просмотра — слишком быстро = плохой UX
    const armTimer = setTimeout(() => setArmed(true), 8000);
    return () => clearTimeout(armTimer);
  }, []);

  useEffect(() => {
    if (!armed) return;

    function trigger() {
      try { sessionStorage.setItem(SHOWN_KEY, "1"); } catch {}
      setOpen(true);
    }

    function onMouseOut(e: MouseEvent) {
      if (e.relatedTarget) return;
      if (e.clientY > 0) return;
      trigger();
    }

    function onVisibility() {
      if (document.visibilityState === "hidden") {
        const isMobile = window.matchMedia("(max-width: 768px)").matches;
        if (isMobile) trigger();
      }
    }

    document.addEventListener("mouseout", onMouseOut);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("mouseout", onMouseOut);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [armed]);

  const valid = /.+@.+\..+/.test(email);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md p-0 overflow-hidden border-primary/30">
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Закрыть"
          className="absolute right-3 top-3 z-10 h-8 w-8 inline-flex items-center justify-center rounded-full bg-background/60 hover:bg-background"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="bg-gradient-primary px-6 py-5 text-primary-foreground">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider opacity-90">
            <Gift className="h-4 w-4" />
            <span>Подарок при первом заказе</span>
          </div>
          <DialogTitle className="mt-1 text-2xl font-display font-bold leading-tight">
            Скидка 5% и чек-лист подготовки мероприятия
          </DialogTitle>
        </div>
        <div className="px-6 py-5">
          <DialogDescription className="text-sm text-foreground/80">
            Оставьте email — пришлём промокод <span className="font-mono font-semibold text-primary">{PROMO_CODE}</span> и подробный чек-лист, как готовить event без сюрпризов.
          </DialogDescription>
          <form
            onSubmit={(e) => { e.preventDefault(); if (valid) m.mutate(); }}
            className="mt-4 flex flex-col gap-2"
          >
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ваш@email.by"
              required
              autoFocus
              className="w-full rounded-md bg-background/50 border border-border h-11 px-3 outline-none focus:border-primary"
            />
            <button
              type="submit"
              disabled={!valid || m.isPending}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-gradient-primary h-12 px-5 text-base font-medium text-primary-foreground glow-primary disabled:opacity-60 transition"
            >
              {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
              Получить промокод
            </button>
            <p className="text-[11px] text-muted-foreground text-center">
              Не более 1 письма в неделю. Отписаться можно в любой момент.
            </p>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
