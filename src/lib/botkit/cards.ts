// Карточки решений: единый вид и единые кнопки для всех ботов портала.
// Клиентобезопасный модуль без обращений к БД — используется в тестах и в админке.
import { BUTTON_LABELS, stripFakeButtons } from "@/lib/botkit/format";

export { BUTTON_LABELS, stripFakeButtons };

export interface CardButton {
  text: string;
  data: string;
}

export interface AssistantPlanStep {
  label: string;
  action: string;
  args?: Record<string, unknown>;
}

export interface AssistantCard {
  id: string;
  title: string;
  summary: string | null;
  steps: AssistantPlanStep[];
  risk?: string | null;
  questions?: string[];
}

export const CARD_APPROVE = "✅ Утвердить";
export const CARD_EDIT = "✏️ Редактировать";
export const CARD_DROP = "🗑 Удалить";

/** Реальная клавиатура карточки решения — всегда привязана к номеру плана. */
export function cardButtons(planId: string): CardButton[][] {
  return [
    [
      { text: CARD_APPROVE, data: `ap:ok:${planId}` },
      { text: CARD_EDIT, data: `ap:edit:${planId}` },
      { text: CARD_DROP, data: `ap:no:${planId}` },
    ],
  ];
}

/** Текст карточки плана/разбора. Кнопки сюда не пишем — их ставит транспорт. */
export function renderCard(card: AssistantCard): string {
  const out = [`🗂 <b>${card.title}</b>`];
  if (card.summary) out.push("", stripFakeButtons(card.summary));
  if (card.steps.length) {
    out.push("", "<b>Шаги</b>");
    out.push(...card.steps.slice(0, 7).map((s, i) => `• ${i + 1}. ${s.label}`));
  }
  if (card.questions?.length) {
    out.push("", "<b>Уточнить</b>");
    out.push(...card.questions.slice(0, 3).map((q) => `• ${q}`));
  }
  if (card.risk) out.push("", `⚠️ ${card.risk}`);
  out.push("", "Решение — кнопками ниже.");
  return out.join("\n");
}

/** Итоговый вид карточки после решения: кнопки убираем, статус фиксируем в тексте. */
export function renderDecided(body: string, verdict: "approved" | "rejected" | "editing", result?: string): string {
  const mark =
    verdict === "approved" ? "✅ <b>Утверждено</b>" : verdict === "rejected" ? "🗑 <b>Удалено</b>" : "✏️ <b>На правках</b>";
  return [body.trim(), "", mark, result ? result.trim() : ""].filter(Boolean).join("\n");
}
