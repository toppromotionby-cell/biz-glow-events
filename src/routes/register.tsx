import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { CheckCircle2, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PasswordField } from "@/components/auth/PasswordField";
import { authErrorMessage } from "@/lib/auth-errors";
import { passwordError } from "@/lib/password-policy";
import { safeRedirect } from "@/lib/auth-redirect";

export const Route = createFileRoute("/register")({
  component: RegisterPage,
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => {
    const r = safeRedirect(search.redirect);
    return r ? { redirect: r } : {};
  },
  head: () => ({
    meta: [
      { title: "Регистрация — event-hub.by" },
      {
        name: "description",
        content:
          "Создайте личный кабинет event-hub.by за минуту: отслеживание заявок, история заказов, доступ к закрытым разделам.",
      },
      { property: "og:title", content: "Регистрация на event-hub.by" },
      { property: "og:description", content: "Личный кабинет: заявки, заказы, документы и доступ к DJ-разделу." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
});

const schema = z
  .object({
    full_name: z.string().trim().min(2, "Укажите имя и фамилию").max(120),
    email: z.string().trim().email("Введите корректный email").max(255),
    phone: z.string().trim().min(6, "Укажите телефон для связи").max(40),
    password: z.string(),
    confirm: z.string(),
    consent: z.literal(true, { message: "Нужно согласие на обработку данных" }),
  })
  .superRefine((v, ctx) => {
    const err = passwordError(v.password, { email: v.email });
    if (err) ctx.addIssue({ code: "custom", message: err, path: ["password"] });
    if (v.password !== v.confirm) {
      ctx.addIssue({ code: "custom", message: "Пароли не совпадают", path: ["confirm"] });
    }
  });

type Form = z.infer<typeof schema>;

function RegisterPage() {
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { password: "", confirm: "" } });

  const email = watch("email");
  const password = watch("password") ?? "";
  const confirm = watch("confirm") ?? "";

  const target = redirect ?? "/profile";

  const onSubmit = async (data: Form) => {
    setLoading(true);
    setFormError(null);
    const { data: res, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          full_name: data.full_name,
          phone: data.phone,
          consent_pd: true,
        },
      },
    });
    setLoading(false);
    if (error) {
      const msg = authErrorMessage(error);
      setFormError(msg);
      toast.error(msg);
      return;
    }
    setDone(true);
    // Почта подтверждается автоматически — сессия приходит сразу.
    if (!res.session) {
      toast.message("Аккаунт создан", { description: "Войдите по своей почте и паролю." });
    }
  };

  return (
    <div className="page-shell section-y max-w-md">
      <div className="glass-strong rounded-2xl p-8">
        <h1 className="text-3xl font-display font-bold mb-2">Регистрация</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Личный кабинет: заявки, история заказов, документы и доступ к закрытым разделам.
        </p>

        {formError && (
          <p
            role="alert"
            className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {formError}
          </p>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="full_name">Имя и фамилия</Label>
            <Input id="full_name" placeholder="Например: Дмитрий Кузнецов" autoComplete="name" {...register("full_name")} />
            {errors.full_name && <p className="text-xs text-destructive">{errors.full_name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="name@company.by" autoComplete="email" {...register("email")} />
            <p className="text-xs text-muted-foreground">На эту почту придут письма о заявках и восстановление пароля.</p>
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Label htmlFor="phone">Телефон</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" aria-label="Зачем телефон">
                      <Info className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Нужен, чтобы менеджер быстро связался по заявке. Мы не рассылаем рекламу.</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Input id="phone" type="tel" placeholder="+375 29 000-00-00" autoComplete="tel" {...register("phone")} />
            {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
          </div>

          <PasswordField
            id="password"
            value={password}
            onChange={(v) => setValue("password", v, { shouldValidate: true })}
            email={email}
            error={errors.password?.message}
          />

          <div className="space-y-1.5">
            <Label htmlFor="confirm">Повторите пароль</Label>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setValue("confirm", e.target.value, { shouldValidate: true })}
            />
            {errors.confirm && <p className="text-xs text-destructive">{errors.confirm.message}</p>}
          </div>

          <label className="flex items-start gap-2 text-xs text-muted-foreground">
            <Checkbox
              checked={!!watch("consent")}
              onCheckedChange={(v) => setValue("consent", (v === true) as true, { shouldValidate: true })}
            />
            <span>
              Согласен на обработку персональных данных и с{" "}
              <Link to="/privacy" className="text-accent hover:underline">
                политикой конфиденциальности
              </Link>
              .
            </span>
          </label>
          {errors.consent && <p className="text-xs text-destructive">{errors.consent.message}</p>}

          <Button type="submit" disabled={loading} className="w-full bg-gradient-primary glow-primary">
            {loading ? "Создаём аккаунт..." : "Зарегистрироваться"}
          </Button>
        </form>

        <p className="text-sm text-center mt-6 text-muted-foreground">
          Уже есть аккаунт?{" "}
          <Link to="/login" search={redirect ? { redirect } : {}} className="text-accent hover:underline">
            Войти
          </Link>
        </p>
      </div>

      <Dialog open={done} onOpenChange={setDone}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" /> Аккаунт создан
            </DialogTitle>
            <DialogDescription>
              Кабинет уже работает — подтверждать почту не нужно. Приветственное письмо придёт на указанный адрес; если его
              нет во «Входящих», проверьте папку «Спам».
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              className="w-full bg-gradient-primary"
              onClick={() => {
                setDone(false);
                navigate({ to: target });
              }}
            >
              Продолжить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
