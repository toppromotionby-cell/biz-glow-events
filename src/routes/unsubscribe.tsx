import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/unsubscribe")({
  head: () => ({ meta: [{ title: "Отписка от рассылки — event-hub.by" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: UnsubscribePage,
});

type State =
  | { kind: "loading" }
  | { kind: "valid"; email: string }
  | { kind: "already" }
  | { kind: "error"; message: string }
  | { kind: "success" };

function UnsubscribePage() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [submitting, setSubmitting] = useState(false);
  const token = typeof window !== "undefined" ? new URL(window.location.href).searchParams.get("token") ?? "" : "";

  useEffect(() => {
    if (!token) {
      setState({ kind: "error", message: "Ссылка повреждена: отсутствует токен." });
      return;
    }
    fetch(`/email/unsubscribe?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (r.ok && data.valid) setState({ kind: "valid", email: data.email ?? "" });
        else if (data.already_unsubscribed) setState({ kind: "already" });
        else setState({ kind: "error", message: data.error ?? "Ссылка недействительна или истекла." });
      })
      .catch(() => setState({ kind: "error", message: "Сетевая ошибка. Попробуйте позже." }));
  }, [token]);

  async function confirm() {
    setSubmitting(true);
    try {
      const r = await fetch("/email/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (r.ok) setState({ kind: "success" });
      else {
        const data = await r.json().catch(() => ({}));
        setState({ kind: "error", message: data.error ?? "Не удалось отписаться." });
      }
    } catch {
      setState({ kind: "error", message: "Сетевая ошибка." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-shell section-y max-w-md">
      <div className="glass rounded-2xl p-8 text-center">
        <h1 className="text-2xl font-display font-bold gradient-text mb-4">Отписка от рассылки</h1>
        {state.kind === "loading" && <p className="text-muted-foreground">Проверяем ссылку…</p>}
        {state.kind === "valid" && (
          <>
            <p className="text-muted-foreground mb-6">
              Подтвердите отписку{state.email ? ` для ${state.email}` : ""}. Вы перестанете получать письма от event-hub.by.
            </p>
            <button
              onClick={confirm}
              disabled={submitting}
              className="rounded-md bg-gradient-primary px-6 py-2.5 text-sm font-medium text-primary-foreground glow-primary disabled:opacity-60"
            >
              {submitting ? "Отписываем…" : "Подтвердить отписку"}
            </button>
          </>
        )}
        {state.kind === "already" && <p className="text-muted-foreground">Этот адрес уже отписан от рассылки.</p>}
        {state.kind === "success" && (
          <p className="text-success">Готово — вы успешно отписались. Спасибо, что были с нами.</p>
        )}
        {state.kind === "error" && <p className="text-destructive">{state.message}</p>}
      </div>
    </div>
  );
}
