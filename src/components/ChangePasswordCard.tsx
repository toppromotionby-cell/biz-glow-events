import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z.object({
  password: z.string().min(8, "Минимум 8 символов"),
  confirm: z.string().min(8, "Минимум 8 символов"),
}).refine((v) => v.password === v.confirm, { message: "Пароли не совпадают", path: ["confirm"] });
type Form = z.infer<typeof schema>;

export function ChangePasswordCard() {
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema) });

  const onSubmit = async ({ password }: Form) => {
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    reset();
    toast.success("Пароль обновлён");
  };

  return (
    <div className="glass rounded-xl p-5">
      <h3 className="font-semibold mb-3">Смена пароля</h3>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="new-password" className="text-xs">Новый пароль</Label>
          <Input id="new-password" type="password" autoComplete="new-password" {...register("password")} />
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm-password" className="text-xs">Повторите пароль</Label>
          <Input id="confirm-password" type="password" autoComplete="new-password" {...register("confirm")} />
          {errors.confirm && <p className="text-xs text-destructive">{errors.confirm.message}</p>}
        </div>
        <Button type="submit" size="sm" disabled={loading} className="w-full">
          {loading ? "Сохраняем..." : "Обновить пароль"}
        </Button>
      </form>
    </div>
  );
}
