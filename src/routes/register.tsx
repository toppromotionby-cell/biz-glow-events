import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { AppleButton } from "@/components/auth/AppleButton";
import { toast } from "sonner";

export const Route = createFileRoute("/register")({
  component: RegisterPage,
  head: () => ({
    meta: [
      { title: "Регистрация — event-hub.by" },
      { name: "description", content: "Создайте аккаунт, чтобы видеть цены и оформлять заявки." },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
});

const schema = z.object({
  full_name: z.string().trim().min(3, "Минимум 3 символа").max(100),
  company: z.string().trim().max(100).optional().or(z.literal("")),
  phone: z.string().regex(/^(\+7|375)\d{9,10}$/, "Формат: +375XXXXXXXXX или +7XXXXXXXXXX"),
  email: z.string().trim().email("Неверный email").max(255),
  password: z.string().min(8, "Минимум 8 символов").regex(/[^a-zA-Z0-9]/, "Нужен спецсимвол"),
  confirm: z.string(),
  consent_pd: z.literal(true, { errorMap: () => ({ message: "Необходимо согласие" }) }),
}).refine(d => d.password === d.confirm, { message: "Пароли не совпадают", path: ["confirm"] });

type FormData = z.infer<typeof schema>;

function RegisterPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/profile`,
        data: {
          full_name: data.full_name,
          company: data.company || null,
          phone: data.phone,
          consent_pd: data.consent_pd,
        },
      },
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Аккаунт создан! Проверьте почту для подтверждения.");
    navigate({ to: "/login" });
  };

  return (
    <div className="container mx-auto px-4 py-16 max-w-md">
      <div className="glass-strong rounded-2xl p-8">
        <h1 className="text-3xl font-display font-bold mb-2">Регистрация</h1>
        <p className="text-sm text-muted-foreground mb-6">Получите доступ к ценам и каталогу</p>
        <div className="space-y-2">
          <GoogleButton label="Зарегистрироваться через Google" />
          <AppleButton label="Зарегистрироваться через Apple" />
        </div>
        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" />
          или вручную
          <div className="h-px flex-1 bg-border" />
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Field label="ФИО *" error={errors.full_name?.message}>
            <Input {...register("full_name")} autoComplete="name" />
          </Field>
          <Field label="Компания" error={errors.company?.message}>
            <Input {...register("company")} autoComplete="organization" />
          </Field>
          <Field label="Телефон *" error={errors.phone?.message}>
            <Input {...register("phone")} placeholder="+375..." autoComplete="tel" />
          </Field>
          <Field label="Email *" error={errors.email?.message}>
            <Input type="email" {...register("email")} autoComplete="email" />
          </Field>
          <Field label="Пароль *" error={errors.password?.message}>
            <Input type="password" {...register("password")} autoComplete="new-password" />
          </Field>
          <Field label="Подтвердите пароль *" error={errors.confirm?.message}>
            <Input type="password" {...register("confirm")} autoComplete="new-password" />
          </Field>
          <div className="flex items-start gap-2">
            <Checkbox id="consent" checked={watch("consent_pd") ?? false} onCheckedChange={(v) => setValue("consent_pd", !!v as true, { shouldValidate: true })} />
            <Label htmlFor="consent" className="text-xs text-muted-foreground leading-snug">
              Согласен на обработку персональных данных в соответствии с{" "}
              <Link to="/privacy" className="text-accent underline">политикой</Link>
            </Label>
          </div>
          {errors.consent_pd && <p className="text-xs text-destructive">{errors.consent_pd.message}</p>}
          <Button type="submit" disabled={loading} className="w-full bg-gradient-primary glow-primary">
            {loading ? "Создаём..." : "Создать аккаунт"}
          </Button>
        </form>
        <p className="text-sm text-center mt-6 text-muted-foreground">
          Уже есть аккаунт? <Link to="/login" className="text-accent">Войти</Link>
        </p>
      </div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
