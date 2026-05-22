import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({
    meta: [
      { title: "Вход — event-hub.by" },
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
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: z.infer<typeof schema>) => {
    setLoading(true);
    const { data: signIn, error } = await supabase.auth.signInWithPassword(data);
    if (error) { setLoading(false); toast.error(error.message); return; }
    toast.success("Добро пожаловать!");

    // Если есть ?redirect=... — туда. Иначе проверяем роль: персонал → /admin, остальные → /profile.
    const params = new URLSearchParams(window.location.search);
    const redirect = params.get("redirect");
    let target = "/profile";
    if (redirect && redirect.startsWith("/")) {
      target = redirect;
    } else if (signIn.user) {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", signIn.user.id);
      const staffRoles = ["admin", "manager", "marketer", "content_editor"];
      if ((roles ?? []).some((r: any) => staffRoles.includes(r.role))) {
        target = "/admin";
      }
    }
    setLoading(false);
    navigate({ to: target });
  };

  return (
    <div className="container mx-auto px-4 py-16 max-w-md">
      <div className="glass-strong rounded-2xl p-8">
        <h1 className="text-3xl font-display font-bold mb-6">Вход</h1>
        <GoogleButton />
        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" />
          или через email
          <div className="h-px flex-1 bg-border" />
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" {...register("email")} autoComplete="email" />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Пароль</Label>
            <Input type="password" {...register("password")} autoComplete="current-password" />
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-gradient-primary glow-primary">
            {loading ? "Входим..." : "Войти"}
          </Button>
        </form>
        <p className="text-sm text-center mt-6 text-muted-foreground">
          Нет аккаунта? <Link to="/register" className="text-accent">Зарегистрироваться</Link>
        </p>
      </div>
    </div>
  );
}
