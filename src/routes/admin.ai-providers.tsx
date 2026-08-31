// Панель бесплатных нейросетей и ролей самообучения помощника.
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CircleSlash, GraduationCap, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { aiProvidersStatus, aiRolesList, aiLearnRole } from "@/lib/ai/ai.functions";

export const Route = createFileRoute("/admin/ai-providers")({ component: Page });

function Page() {
  const qc = useQueryClient();
  const [topic, setTopic] = useState("");
  const [ctx, setCtx] = useState("");

  const providers = useQuery({ queryKey: ["ai", "providers"], queryFn: () => aiProvidersStatus() });
  const roles = useQuery({ queryKey: ["ai", "roles"], queryFn: () => aiRolesList() });

  const learn = useMutation({
    mutationFn: () => aiLearnRole({ data: { topic: topic.trim(), ...(ctx.trim() ? { context: ctx.trim() } : {}) } }),
    onSuccess: () => {
      toast.success("Роль выучена и сохранена в общей памяти ботов");
      setTopic("");
      setCtx("");
      void qc.invalidateQueries({ queryKey: ["ai"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="ИИ-провайдеры и роли"
        subtitle="Помощник работает на бесплатных нейросетях по очереди; платный резерв включается только если все недоступны."
      />

      <section className="glass rounded-2xl p-4">
        <h2 className="mb-3 text-sm font-semibold">Источники в порядке приоритета</h2>
        {providers.isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <ul className="space-y-2">
            {(providers.data?.providers ?? []).map((p, i) => (
              <li key={p.id} className="flex flex-col gap-1 rounded-xl border border-border/60 p-3 sm:flex-row sm:items-center sm:gap-3">
                <span className="w-6 text-xs text-muted-foreground">#{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.model} · {p.limit} · ключ <code>{p.envKey}</code>
                  </p>
                  {p.lastError && <p className="mt-1 text-xs text-destructive">Последняя ошибка: {p.lastError}</p>}
                </div>
                <span className="text-xs text-muted-foreground">✅ {p.ok} · ⚠️ {p.fail}</span>
                <Badge variant={p.configured ? "default" : "secondary"} className="w-fit font-normal">
                  {p.configured ? <CheckCircle2 className="mr-1 h-3 w-3" /> : <CircleSlash className="mr-1 h-3 w-3" />}
                  {p.configured ? "Подключён" : "Нет ключа"}
                </Badge>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Чтобы подключить источник, добавьте соответствующий ключ в секреты проекта — он бесплатный и выдаётся в
          личном кабинете сервиса.
        </p>
      </section>

      <section className="glass rounded-2xl p-4">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold">
          <GraduationCap className="h-4 w-4" /> Самообучение: новая роль
        </h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Помощник найдёт материалы в интернете, спросит несколько бесплатных моделей, сведёт ответы в один промпт и
          запомнит его для обоих ботов.
        </p>
        <div className="space-y-3 sm:max-w-xl">
          <div className="space-y-1.5">
            <Label htmlFor="topic">Тема / задача</Label>
            <Input id="topic" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Например: подготовка сметы на свадьбу" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ctx">Контекст (необязательно)</Label>
            <Textarea id="ctx" value={ctx} onChange={(e) => setCtx(e.target.value)} rows={3} />
          </div>
          <Button disabled={learn.isPending || topic.trim().length < 3} onClick={() => learn.mutate()} className="bg-gradient-primary">
            {learn.isPending ? "Учимся..." : "Выучить роль"}
          </Button>
        </div>
      </section>

      <section className="glass rounded-2xl p-4">
        <h2 className="mb-3 text-sm font-semibold">Выученные роли</h2>
        {roles.isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (roles.data?.roles ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Пока пусто — обучите первую роль выше.</p>
        ) : (
          <ul className="space-y-2">
            {(roles.data?.roles ?? []).map((r) => (
              <li key={r.key} className="rounded-xl border border-border/60 p-3">
                <p className="text-sm font-medium">{r.title}</p>
                <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{r.prompt}</p>
                {r.providers?.length > 0 && (
                  <p className="mt-2 text-[11px] text-muted-foreground">Источники моделей: {r.providers.join(", ")}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
