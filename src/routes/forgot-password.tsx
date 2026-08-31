import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authErrorMessage } from "@/lib/auth-errors";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Восстановление пароля — event-hub.by" },
      { name: "description", content: "Восстановите доступ к личному кабинету event-hub.by: мы отправим ссылку для сброса пароля на ваш email." },
      { property: "og:title", content: "Восстановление пароля — event-hub.by" },
      { property: "og:description", content: "Получите письмо со ссылкой для сброса пароля и снова войдите в аккаунт." },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  component: ForgotPasswordPage,
});

const schema = z.object({ email: z.string().email("Введите корректный email") });
type Form = z.infer<typeof schema>;

function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema) });

  const onSubmit = async ({ email }: Form) => {
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) { toast.error(authErrorMessage(error)); return; }
    setSent(true);
    toast.success("Письмо отправлено");
  };

  return (
    <div className="page-shell section-y max-w-md">
      <div className="glass-strong rounded-2xl p-8">
        <h1 className="text-3xl font-display font-bold mb-2">Восстановление пароля</h1>
        <p className="text-sm text-muted-foreground mb-6">Введите email — мы вышлем ссылку для сброса пароля. Ссылка действует 60 минут и срабатывает один раз.</p>
        {sent ? (
          <div className="space-y-4">
            <p className="text-sm">Если такой email зарегистрирован, на него отправлена ссылка для восстановления пароля. Проверьте почту, в том числе папку «Спам».</p>
            <p className="text-xs text-muted-foreground">Письмо не пришло за 5 минут? Проверьте адрес и отправьте запрос ещё раз или напишите нам через раздел «Контакты».</p>
            <Button variant="outline" className="w-full" onClick={() => setSent(false)}>Отправить ещё раз</Button>
            <Button asChild variant="outline" className="w-full"><Link to="/login">Вернуться ко входу</Link></Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" placeholder="name@company.by" {...register("email")} />
              <p className="text-xs text-muted-foreground">Тот адрес, на который вы оформляли заявку или регистрировались.</p>
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-gradient-primary glow-primary">
              {loading ? "Отправляем..." : "Отправить ссылку"}
            </Button>
            <p className="text-sm text-center text-muted-foreground">
              Вспомнили пароль? <Link to="/login" className="text-accent">Войти</Link> · Нет аккаунта?{" "}
              <Link to="/register" className="text-accent">Регистрация</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
