import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordField } from "@/components/auth/PasswordField";
import { authErrorMessage } from "@/lib/auth-errors";
import { passwordError } from "@/lib/password-policy";

export function ChangePasswordCard({ onSuccess, title = "Смена пароля" }: { onSuccess?: () => void; title?: string } = {}) {
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const policy = passwordError(password);
    if (policy) { setError(policy); return; }
    if (password !== confirm) { setError("Пароли не совпадают"); return; }
    setError(null);
    setLoading(true);
    // Снимаем флаг временного пароля тем же запросом.
    const { error: err } = await supabase.auth.updateUser({
      password,
      data: { must_change_password: false },
    });
    setLoading(false);
    if (err) { const msg = authErrorMessage(err); setError(msg); toast.error(msg); return; }
    setPassword("");
    setConfirm("");
    toast.success("Пароль обновлён");
    onSuccess?.();
  };

  return (
    <div className="glass rounded-xl p-5">
      <h3 className="font-semibold mb-3">{title}</h3>
      {error && (
        <p role="alert" className="mb-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}
      <form onSubmit={onSubmit} className="space-y-3" noValidate>
        <PasswordField id="new-password" label="Новый пароль" value={password} onChange={setPassword} />
        <div className="space-y-1.5">
          <Label htmlFor="confirm-password" className="text-xs">Повторите пароль</Label>
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        <Button type="submit" size="sm" disabled={loading} className="w-full">
          {loading ? "Сохраняем..." : "Обновить пароль"}
        </Button>
      </form>
    </div>
  );
}
