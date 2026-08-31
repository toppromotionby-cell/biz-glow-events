// Вебхук бота-помощника. Защита: секрет из ключа подключения, сравнение timing-safe.
import { createFileRoute } from "@tanstack/react-router";
import { createHash, timingSafeEqual } from "crypto";

export function assistantWebhookSecret(apiKey: string): string {
  return createHash("sha256").update(`assistant-webhook:${apiKey}`).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export const Route = createFileRoute("/api/public/assistant/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { assistantTgKey } = await import("@/lib/assistant/transport.server");
        const key = assistantTgKey();
        if (!key) return new Response("Bot not configured", { status: 503 });

        const expected = assistantWebhookSecret(key);
        const actual = request.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
        if (!safeEqual(actual, expected)) return new Response("Unauthorized", { status: 401 });

        let update: { update_id?: number } | null = null;
        try {
          update = (await request.json()) as { update_id?: number };
        } catch {
          return Response.json({ ok: true, ignored: "bad json" });
        }
        if (typeof update?.update_id !== "number") return Response.json({ ok: true, ignored: true });

        const { claimUpdate } = await import("@/lib/assistant/store.server");
        if (!(await claimUpdate(update.update_id))) return Response.json({ ok: true, duplicate: true });

        try {
          const { handleUpdate } = await import("@/lib/assistant/agent.server");
          await handleUpdate(update as never);
        } catch (e) {
          // Telegram не должен ретраить: ошибку логируем и отвечаем 200.
          console.error("[assistant-webhook] handler failed", e instanceof Error ? e.stack : e);
        }
        return Response.json({ ok: true });
      },
    },
  },
});
