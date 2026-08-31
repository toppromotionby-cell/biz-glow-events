// Разбор скриншотов и PDF для любого бота портала (админка, планер). Только сервер.
import { actionsPrompt } from "@/lib/assistant/actions";
import type { AssistantPlanStep } from "@/lib/botkit/cards";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.7-flash";

export const VISION_MIME = /^image\/(png|jpe?g|webp|gif|heic|heif)$/i;
export const VISION_MAX_BYTES = 12 * 1024 * 1024;

export interface Attachment {
  fileId: string;
  mime: string;
  base64: string;
  bytes: number;
  filename?: string;
}

export interface VisionResult {
  title: string;
  summary: string;
  risk?: string | null;
  questions: string[];
  steps: AssistantPlanStep[];
}

const SCHEMA_HINT = `Ответь ТОЛЬКО json-объектом:
{
  "title": "короткий заголовок разбора (до 80 символов)",
  "summary": "что видно на экране, вероятная причина и что предлагаешь — 2-5 строк, Telegram-HTML",
  "risk": "чем рискуем, если сделать (или null)",
  "questions": ["уточняющий вопрос, если данных не хватает"],
  "steps": [ { "label": "человеческое описание шага", "action": "kb_add", "args": { "subject": "...", "fact": "..." } } ]
}
Подписи кнопок («Утвердить», «Правки», «Отменить») в тексте не пиши — их ставит система.`;

/** Сообщения для мультимодальной модели. Отдельная функция — чтобы покрывать тестом. */
export function visionMessages(opts: {
  system: string;
  attachments: Attachment[];
  question: string;
  context?: string;
  actions?: string;
}): unknown[] {
  const content: unknown[] = [
    {
      type: "text",
      text: [
        opts.question || "Разбери скриншот: что не так и что сделать.",
        opts.context ? `\nКонтекст портала:\n${opts.context}` : "",
        `\n${opts.actions ?? actionsPrompt()}`,
        `\n${SCHEMA_HINT}`,
      ]
        .filter(Boolean)
        .join("\n"),
    },
  ];
  for (const a of opts.attachments.slice(0, 4)) {
    if (a.mime === "application/pdf") {
      content.push({
        type: "file",
        file: { filename: a.filename ?? "document.pdf", file_data: `data:application/pdf;base64,${a.base64}` },
      });
    } else {
      content.push({ type: "image_url", image_url: { url: `data:${a.mime};base64,${a.base64}` } });
    }
  }
  return [
    { role: "system", content: opts.system },
    { role: "user", content },
  ];
}

/** Пригодность вложения для разбора. */
export function acceptsAttachment(mime: string, bytes: number): { ok: boolean; reason?: string } {
  if (bytes > VISION_MAX_BYTES) return { ok: false, reason: "Файл больше 12 МБ — пришлите скриншот полегче." };
  if (VISION_MIME.test(mime) || mime === "application/pdf") return { ok: true };
  return { ok: false, reason: "Я разбираю картинки (PNG, JPG, WEBP) и PDF. Пришлите скриншот." };
}

function parse(raw: string): VisionResult | null {
  const clean = raw.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
  try {
    const j = JSON.parse(clean) as Partial<VisionResult>;
    if (!j || typeof j !== "object") return null;
    return {
      title: (j.title || "Разбор скриншота").toString().slice(0, 160),
      summary: (j.summary || "").toString(),
      risk: j.risk ? String(j.risk) : null,
      questions: Array.isArray(j.questions) ? j.questions.map(String).slice(0, 3) : [],
      steps: Array.isArray(j.steps)
        ? j.steps
            .filter((s) => s && typeof s === "object")
            .map((s) => ({
              label: String((s as AssistantPlanStep).label ?? "Шаг"),
              action: String((s as AssistantPlanStep).action ?? "manual"),
              args: ((s as AssistantPlanStep).args ?? {}) as Record<string, unknown>,
            }))
            .slice(0, 7)
        : [],
    };
  } catch {
    return null;
  }
}

export type VisionOutcome =
  | { ok: true; result: VisionResult }
  | { ok: false; message: string };

/** Запрос к модели с картинкой. Ошибки шлюза переводим на человеческий язык. */
export async function analyzeAttachments(opts: {
  system: string;
  attachments: Attachment[];
  question: string;
  context?: string;
  actions?: string;
}): Promise<VisionOutcome> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return { ok: false, message: "⚠️ ИИ не подключён: нет ключа шлюза." };
  try {
    const res = await fetch(GATEWAY, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        response_format: { type: "json_object" },
        messages: visionMessages(opts),
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`[botkit-vision] ${res.status}: ${body.slice(0, 300)}`);
      if (res.status === 429) return { ok: false, message: "⏳ Слишком много запросов подряд. Попробуйте через минуту." };
      if (res.status === 402) return { ok: false, message: "💳 Закончились кредиты ИИ. Нужно пополнить баланс." };
      if (res.status === 403) return { ok: false, message: "🚫 Доступ к ИИ заблокирован настройками рабочего пространства." };
      return { ok: false, message: "⚠️ Не удалось разобрать изображение. Попробуйте ещё раз." };
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const parsed = parse(json.choices?.[0]?.message?.content ?? "");
    if (!parsed) return { ok: false, message: "⚠️ Модель вернула неразборчивый ответ. Пришлите скриншот ещё раз." };
    return { ok: true, result: parsed };
  } catch (e) {
    console.error("[botkit-vision] failed", e instanceof Error ? e.message : e);
    return { ok: false, message: "⚠️ Не получилось обратиться к ИИ. Попробуйте ещё раз." };
  }
}
