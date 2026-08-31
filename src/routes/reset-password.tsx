import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PasswordField } from "@/components/auth/PasswordField";
import { authErrorMessage } from "@/lib/auth-errors";
import { passwordError } from "@/lib/password-policy";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Новый пароль — event-hub.by" },
      { name: "description", content: "Придумайте новый надёжный пароль для личного кабинета event-hub.by." },
      { property: "og:title", content: "Новый пароль — event-hub.by" },
      { property: "og:description", content: "Завершите восстановление доступа к кабинету event-hub.by." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: ResetPasswordPage,
});

type LinkState = "checking" | "ready" | "invalid";

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [state, setState] = useState<LinkState>("checking");
  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // Ссылка из письма создаёт recovery-сессию. Без неё менять пароль нельзя.
  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      if (data.session?.user) {
        setEmail(data.session.user.email ?? null);
        setState("ready");
      } else {
        setState("invalid");
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!alive || !session?.user) return;
      setEmail(session.user.email ?? null);
      setState("ready");
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const policy = passwordError(password, { email });
    if (policy) {
      setError(policy);
      return;
    }
    if (password !== confirm) {
      setError("Пароли не совпадают");
      return;
    }
    setError(null);
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({
      password,
      data: { must_change_password: false },
    });
    setLoading(false);
    if (err) {
      const msg = authErrorMessage(err);
      setError(msg);
      toast.error(msg);
      return;
    }
    setDone(true);
  };

  if (state === "checking") {
    return (
      <div className="page-shell section-y max-w-md">
        <div className="glass-strong rounded-2xl p-8 flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Проверяем ссылку из письма...
        </div>
      </div>
    );
  }

  if (state === "invalid") {
    return (
      <div className="page-shell section-y max-w-md">
        <div className="glass-strong rounded-2xl p-8 space-y-4">
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" /> Ссылка недействительна
          </h1>
          <p className="text-sm text-muted-foreground">
            Ссылка для сброса пароля действует ограниченное время и только один раз. Запросите новую — письмо придёт в
            течение минуты.
          </p>
          <Button asChild className="w-full bg-gradient-primary">
            <Link to="/forgot-password">Запросить новую ссылку</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link to="/login">Вернуться ко входу</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell section-y max-w-md">
      <div className="glass-strong rounded-2xl p-8">
        <h1 className="text-3xl font-display font-bold mb-2">Новый пароль</h1>
        <p className="text-sm text-muted-foreground mb-6">
          {email ? `Меняем пароль для ${email}.` : "Придумайте новый пароль."} Он должен быть длинным и содержать
          заглавные, строчные буквы, цифры и спецсимвол.
        </p>
        {error && (
          <p role="alert" className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <PasswordField id="password" label="Новый пароль" value={password} onChange={setPassword} email={email} />
          <div className="space-y-1.5">
            <Label htmlFor="confirm">Повторите пароль</Label>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full bg-gradient-primary glow-primary" disabled={loading}>
            {loading ? "Сохраняем..." : "Обновить пароль"}
          </Button>
        </form>
      </div>

      <Dialog open={done} onOpenChange={setDone}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" /> Пароль обновлён
            </DialogTitle>
            <DialogDescription>
              Новый пароль сохранён. Используйте его при следующем входе — старый больше не работает.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              className="w-full bg-gradient-primary"
              onClick={() => {
                setDone(false);
                navigate({ to: "/profile" });
              }}
            >
              В личный кабинет
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
