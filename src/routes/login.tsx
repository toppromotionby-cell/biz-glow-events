import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { authErrorMessage } from "@/lib/auth-errors";
import { safeRedirect } from "@/lib/auth-redirect";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  // ?redirect=/path — куда вернуть пользователя после входа (только внутренние пути).
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => {
    const r = safeRedirect(search.redirect);
    return r ? { redirect: r } : {};
  },
  head: () => ({
    meta: [
      { title: "Вход — event-hub.by" },
      { name: "description", content: "Войдите в личный кабинет event-hub.by, чтобы видеть цены, оформлять заявки и отслеживать статус заказов на оборудование и услуги." },
      { property: "og:title", content: "Вход в личный кабинет — event-hub.by" },
      { property: "og:description", content: "Доступ к ценам, заявкам и истории заказов event-hub.by." },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
});

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function LoginPage() {
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors } } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: z.infer<typeof schema>) => {
    setLoading(true);
    setFormError(null);
    const { data: signIn, error } = await supabase.auth.signInWithPassword(data);
    if (error) {
      setLoading(false);
      const msg = authErrorMessage(error);
      setFormError(msg);
      toast.error(msg);
      return;
    }
    toast.success("Добро пожаловать!");

    // Если есть ?redirect=... — туда. Иначе проверяем роль: персонал → /admin, остальные → /profile.
    let target = "/profile";
    if (redirect) {
      target = redirect;
    } else if (signIn.user) {
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", signIn.user.id);
      const staffRoles = ["admin", "manager", "accountant", "content_editor"];
      if (rolesError) console.error("[login] не удалось прочитать роли", rolesError.message);
      if ((roles ?? []).some((r) => staffRoles.includes(r.role))) {
        target = "/admin";
      }
    }
    setLoading(false);
    navigate({ to: target });
  };

  return (
    <div className="page-shell section-y max-w-md">
      <div className="glass-strong rounded-2xl p-8">
        <h1 className="text-3xl font-display font-bold mb-2">Вход</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Вход по email и паролю. Нет аккаунта?{" "}
          <Link to="/register" search={redirect ? { redirect } : {}} className="text-accent hover:underline">
            Зарегистрируйтесь за минуту
          </Link>
          .
        </p>
        {formError && (
          <p role="alert" className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {formError}
          </p>
        )}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" {...register("email")} autoComplete="email" />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Пароль</Label>
              <Link to="/forgot-password" className="text-xs text-accent hover:underline">Забыли пароль?</Link>
            </div>
            <Input type="password" {...register("password")} autoComplete="current-password" />
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-gradient-primary glow-primary">
            {loading ? "Входим..." : "Войти"}
          </Button>
        </form>
        <p className="text-sm text-center mt-6 text-muted-foreground">
          Личный кабинет создаётся автоматически после первого заказа — доступ придёт на вашу почту.
        </p>
      </div>
    </div>
  );
}
