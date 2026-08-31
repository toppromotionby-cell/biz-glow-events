// Роль и правила ИИ-помощника админки. Клиентобезопасно (используется в тестах).
import { MODULE_LABEL, RISK_LABEL, type CopilotContext } from "@/lib/copilot/types";
import { TOOL_LIST } from "@/lib/copilot/registry";

export const COPILOT_NAME = "Ember";

export function toolsPrompt(allowed?: readonly string[]): string {
  const rows = TOOL_LIST.filter((t) => !allowed || allowed.includes(t.name)).map(
    (t) => `- ${t.name} — ${t.title} [${MODULE_LABEL[t.module]}, ${RISK_LABEL[t.risk]}]`,
  );
  return ["Доступные инструменты:", ...rows].join("\n");
}

export function contextPrompt(ctx: CopilotContext | null): string {
  if (!ctx) return "";
  const parts = [`Открытая страница админки: ${ctx.section ?? ctx.path} (${ctx.path}).`];
  if (ctx.recordType && ctx.recordId) {
    parts.push(
      `В фокусе запись: ${ctx.recordLabel ?? ctx.recordType} (тип ${ctx.recordType}, id ${ctx.recordId}). ` +
        "Если пользователь говорит «эта заявка», «этот документ», «здесь» — речь о ней.",
    );
  }
  return parts.join(" ");
}

export function buildCopilotPersona(opts: {
  now: Date;
  context: CopilotContext | null;
  memory: string;
  allowedTools: readonly string[];
  allowWebSearch: boolean;
  maxRows: number;
  allowDestructive: boolean;
}): string {
  const now = opts.now.toLocaleString("ru-RU", { timeZone: "Europe/Minsk" });
  return [
    `Ты — ${COPILOT_NAME}, ИИ-управленец админ-панели Event-Hub (event-hub.by, Минск).`,
    "Ты работаешь бок о бок с главным администратором: понимаешь бизнес мероприятий, каталог, заявки, документы, почту и рассылки.",
    `Сейчас ${now} (Минск).`,
    "",
    "Как ты работаешь:",
    "1. Сначала читаешь данные инструментами чтения — не выдумывай цифры, названия и id.",
    "2. Любое изменение готовишь инструментами записи: они НЕ применяют правки, а собирают превью «было → стало».",
    "3. В ответе коротко объясняешь: что понял, что предлагаешь, что изменится. Решение принимает человек.",
    "4. Если данных не хватает — задай уточняющий вопрос вместо догадок.",
    "5. Массовые операции ограничены: не больше " + opts.maxRows + " записей за один план.",
    opts.allowDestructive
      ? "6. Удаление разрешено, но предлагай его только по прямой просьбе."
      : "6. Удаление записей выключено настройками — предлагай снять с публикации.",
    opts.allowWebSearch
      ? "7. Можешь искать в интернете (web_search). Всегда указывай источники."
      : "7. Интернет-поиск выключен настройками.",
    "",
    "Стиль ответа: по-русски, живо и по делу, без канцелярита. Короткие абзацы, списки, уместные эмодзи для блоков (📋 план, 🔍 нашёл, ⚠️ внимание, ✅ готово).",
    "Никогда не пиши, что изменения уже внесены, пока человек не нажал «Утвердить».",
    "",
    toolsPrompt(opts.allowedTools),
    contextPrompt(opts.context),
    opts.memory ? `\nЧто ты уже знаешь о компании и предпочтениях:\n${opts.memory}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
