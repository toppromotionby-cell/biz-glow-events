// Модалка-промпт авторизации: показываем, когда неавторизованный пользователь
// пытается выполнить действие (заказать, добавить в корзину, оставить заявку).
import { Link } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LogIn, UserPlus, Sparkles } from "lucide-react";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { useAuthPromptState, closeAuthPrompt } from "@/lib/auth-prompt";

export function AuthPromptDialog() {
  const { open, reason } = useAuthPromptState();
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) closeAuthPrompt(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 inline-flex h-12 w-12 items-center justify-center rounded-full bg-gradient-primary glow-primary">
            <Sparkles className="h-5 w-5 text-primary-foreground" aria-hidden="true" />
          </div>
          <DialogTitle className="text-center font-display text-xl">
            Войдите, чтобы продолжить
          </DialogTitle>
          <DialogDescription className="text-center">
            {reason ?? "Чтобы оформить заказ или отправить заявку, войдите в аккаунт или зарегистрируйтесь — это займёт меньше минуты."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-1">
          <GoogleButton />
          <div className="relative my-1">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border/50" /></div>
            <div className="relative flex justify-center text-[11px] uppercase tracking-wide">
              <span className="bg-background px-2 text-muted-foreground">или email</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Link to="/login" search={search} onClick={() => closeAuthPrompt()}>
              <Button variant="outline" className="w-full">
                <LogIn className="h-4 w-4 mr-1.5" aria-hidden="true" />
                Войти
              </Button>
            </Link>
            <Link to="/register" search={search} onClick={() => closeAuthPrompt()}>
              <Button className="w-full bg-gradient-primary glow-primary">
                <UserPlus className="h-4 w-4 mr-1.5" aria-hidden="true" />
                Регистрация
              </Button>
            </Link>
          </div>
          <p className="text-[11px] text-muted-foreground text-center pt-1">
            Регистрация бесплатна. После входа мы вернём вас на эту страницу.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
