import { createFileRoute, useNavigate } from "@tanstack/react-router";
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

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Сброс пароля — event-hub.by" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: ResetPasswordPage,
});

const schema = z.object({ password: z.string().min(8, "Минимум 8 символов") });
type Form = z.infer<typeof schema>;

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema) });

  const onSubmit = async ({ password }: Form) => {
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { toast.error(authErrorMessage(error)); return; }
    toast.success("Пароль обновлён");
    navigate({ to: "/profile" });
  };

  return (
    <div className="page-shell section-y max-w-md">
      <h1 className="text-3xl font-display font-bold gradient-text mb-6">Новый пароль</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 glass rounded-xl p-6">
        <div>
          <Label htmlFor="password">Новый пароль</Label>
          <Input id="password" type="password" {...register("password")} />
          {errors.password && <p className="text-xs text-destructive mt-1">{errors.password.message}</p>}
        </div>
        <Button type="submit" className="w-full bg-gradient-primary glow-primary" disabled={loading}>
          {loading ? "Сохраняю..." : "Обновить пароль"}
        </Button>
      </form>
    </div>
  );
}
