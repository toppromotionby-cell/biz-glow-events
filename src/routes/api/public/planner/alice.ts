// Вебхук навыка Алисы («Диалоги Яндекса») для планера.
// Доступ: привязка аккаунта Яндекса одноразовым кодом из админки.
import { createFileRoute } from "@tanstack/react-router";
import { aliceResponse, aliceUserId, aliceUtterance, type AliceRequest } from "@/lib/calendar/alice.server";
import { admin, getPrefs } from "@/lib/calendar/store.server";
import { runAssistant } from "@/lib/calendar/assistant.server";
import { mirrorAssistantToTelegram } from "@/lib/calendar/agent.server";
import { listUnspoken, markSpoken, speechText } from "@/lib/calendar/outbox.server";

const HINTS = ["Что сегодня", "Что на завтра", "Что просрочено", "Что нового"];

export const Route = createFileRoute("/api/public/planner/alice")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => null)) as AliceRequest | null;
        if (!body?.session) return aliceResponse({ text: "Не понял запрос.", endSession: true });

        const userId = aliceUserId(body);
        const utterance = aliceUtterance(body);

        try {
          const db = await admin();
          const prefs = await getPrefs(db);

          // Если навык указан в настройках — принимаем только его запросы.
          if (prefs.alice_skill_id && body.session.skill_id && body.session.skill_id !== prefs.alice_skill_id) {
            return aliceResponse({ text: "Навык не настроен.", endSession: true });
          }
          if (!userId) return aliceResponse({ text: "Не могу определить пользователя.", endSession: true });

          // Привязка аккаунта одноразовым кодом.
          const linked = prefs.alice_user_ids.includes(userId);
          if (!linked) {
            const code = (prefs.alice_link_code ?? "").trim();
            const said = utterance.replace(/\D+/g, "");
            if (code && said && said === code.replace(/\D+/g, "")) {
              await db
                .from("assistant_prefs")
                .update({ alice_user_ids: [...prefs.alice_user_ids, userId], alice_link_code: null })
                .eq("id", 1);
              return aliceResponse({
                text: "Готово, аккаунт привязан. Теперь можно диктовать задачи и спрашивать план.",
                buttons: HINTS,
              });
            }
            return aliceResponse({
              text: "Это личный планер. Продиктуйте код привязки из админки, например: один два три четыре.",
            });
          }

          // Приветствие: сначала зачитываем пропущенные сообщения бота.
          if (body.session.new && !utterance) {
            const unread = await listUnspoken(db, 3);
            if (unread.length) {
              await markSpoken(db, unread.map((r) => r.id));
              const list = unread.map((r, i) => `${i + 1}. ${speechText(r.text)}`).join(" ");
              return aliceResponse({
                text: `Пока вас не было: ${list} Что записать или подсказать?`,
                buttons: HINTS,
              });
            }
            return aliceResponse({ text: "Планер на связи. Что записать или подсказать?", buttons: HINTS });
          }

          const result = await runAssistant(db, { text: utterance, source: "alice" });
          if (prefs.alice_mirror_tg) {
            await mirrorAssistantToTelegram(db, result, utterance);
          }
          return aliceResponse({ text: result.text, tts: result.speech, buttons: HINTS });
        } catch (e) {
          console.error("[alice-webhook] failed", e);
          return aliceResponse({ text: "Что-то пошло не так, попробуйте ещё раз." });
        }
      },
    },
  },
});
