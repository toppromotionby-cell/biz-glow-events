// Планы ассистента: ассистент предлагает — владелец утверждает.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import type { PlanDTO } from "@/lib/calendar/plan-dto";
import { createAssistantPlan, decideAssistantPlan, listAssistantPlans } from "@/lib/calendar.functions";

const STATUS: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  pending: { label: "Ждёт утверждения", variant: "default" },
  editing: { label: "На правках", variant: "secondary" },
  approved: { label: "Выполнен", variant: "outline" },
  rejected: { label: "Отклонён", variant: "secondary" },
  expired: { label: "Истёк", variant: "secondary" },
  failed: { label: "Ошибка", variant: "destructive" },
};

export function PlansCard() {
  const qc = useQueryClient();
  const listFn = useServerFn(listAssistantPlans);
  const createFn = useServerFn(createAssistantPlan);
  const decideFn = useServerFn(decideAssistantPlan);
  const [request, setRequest] = useState("");

  const { data, isLoading } = useQuery({ queryKey: ["assistant-plans"], queryFn: () => listFn({}) });
  const invalidate = () => void qc.invalidateQueries({ queryKey: ["assistant-plans"] });

  const create = useMutation({
    mutationFn: () => createFn({ data: { request: request.trim() } }),
    onSuccess: () => {
      setRequest("");
      toast.success("План собран — проверьте и утвердите");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message || "Не удалось собрать план"),
  });

  const decide = useMutation({
    mutationFn: (v: { id: string; approve: boolean }) => decideFn({ data: v }),
    onSuccess: (res) => {
      toast.success(res.failed ? `Выполнено ${res.ok}, ошибок ${res.failed}` : "Готово");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message || "Не получилось"),
  });

  const plans: PlanDTO[] = data?.plans ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Планы ассистента</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Ассистент сначала собирает предложение и ждёт вашего решения — без утверждения в календаре ничего не меняется.
          В Telegram то же самое доступно по команде <code>/plan</code> или фразе «подумай, как…».
        </p>
        <div className="space-y-2">
          <Textarea
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            rows={3}
            placeholder="Например: подумай, как разложить подготовку к мероприятию 12 июня по дням"
          />
          <Button disabled={request.trim().length < 3 || create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? "Собираю…" : "Собрать план"}
          </Button>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Загрузка…</p>
        ) : plans.length === 0 ? (
          <p className="text-sm text-muted-foreground">Планов пока нет.</p>
        ) : (
          <div className="space-y-3">
            {plans.map((p) => {
              const st = STATUS[p.status] ?? STATUS.pending;
              return (
                <div key={p.id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{p.title}</div>
                      {p.summary ? <div className="text-sm text-muted-foreground whitespace-pre-line">{p.summary}</div> : null}
                    </div>
                    <Badge variant={st.variant}>{st.label}</Badge>
                  </div>
                  {p.steps.length ? (
                    <ol className="list-decimal pl-5 text-sm space-y-1">
                      {p.steps.map((s, i) => (
                        <li key={i}>{s.label || s.tool}</li>
                      ))}
                    </ol>
                  ) : null}
                  {p.questions.length ? (
                    <ul className="list-disc pl-5 text-sm text-muted-foreground">
                      {p.questions.map((q, i) => (
                        <li key={i}>{q}</li>
                      ))}
                    </ul>
                  ) : null}
                  {p.research.length ? (
                    <div className="text-sm space-y-1">
                      {p.research.map((h, i) => (
                        <a key={i} href={h.url} target="_blank" rel="noreferrer" className="block text-primary underline">
                          {h.title}
                        </a>
                      ))}
                    </div>
                  ) : null}
                  {p.result ? <div className="text-xs text-muted-foreground">{p.result}</div> : null}
                  {p.status === "pending" || p.status === "editing" ? (
                    <div className="flex gap-2">
                      <Button size="sm" disabled={decide.isPending} onClick={() => decide.mutate({ id: p.id, approve: true })}>
                        Утвердить
                      </Button>
                      <Button size="sm" variant="outline" disabled={decide.isPending} onClick={() => decide.mutate({ id: p.id, approve: false })}>
                        Отклонить
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
