// AI-помощник корпоративных документов: черновик или переписывание текста.
// Модель возвращает структуру блоков, совместимую с редактором.
import { normalizeBlocks, PW_DOC_TYPE_LABELS, type PwBlock, type PwDocType } from "@/lib/paperwork/model";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.7-flash";

export type AiDraftResult = {
  ok: boolean;
  title: string;
  blocks: PwBlock[];
  error?: string;
};

const SYSTEM = `Ты — помощник делопроизводителя белорусской компании.
Составляй официальные документы на русском языке: строгий деловой стиль, без воды и эмодзи.
Возвращай ТОЛЬКО JSON без markdown-обёртки, по схеме:
{"title":"строка","blocks":[
  {"type":"heading","text":"...","align":"center"},
  {"type":"recipient","text":"Кому\\nДолжность","align":"right"},
  {"type":"paragraph","text":"...","align":"justify","indent":true},
  {"type":"list","items":["..."],"ordered":true},
  {"type":"table","header":["..."],"rows":[["..."]]},
  {"type":"signature","signerTitle":"Директор","signerName":"{{ФИО директора}}","withStamp":true}
]}
Для подстановок используй переменные в двойных фигурных скобках: {{Компания}}, {{Дата}}, {{Получатель}}, {{ФИО директора}}.
Не выдумывай реквизиты, суммы и даты — вместо них ставь переменные.`;

function extractJson(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

export async function draftDocument(input: {
  prompt: string;
  docType: PwDocType;
  companyName: string;
  mode: "create" | "rewrite";
  currentText: string;
}): Promise<AiDraftResult> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return { ok: false, title: "", blocks: [], error: "AI недоступен: не настроен ключ." };

  const parts = [
    `Тип документа: ${PW_DOC_TYPE_LABELS[input.docType] ?? "Документ"}.`,
    input.companyName ? `Компания-отправитель: ${input.companyName}.` : "",
    input.mode === "rewrite" && input.currentText
      ? `Перепиши и улучши существующий текст, сохранив смысл:\n"""${input.currentText.slice(0, 6000)}"""`
      : "",
    `Задача: ${input.prompt}`,
  ].filter(Boolean);

  let res: Response;
  try {
    res = await fetch(GATEWAY, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: parts.join("\n") },
        ],
      }),
    });
  } catch (e) {
    return { ok: false, title: "", blocks: [], error: `Сеть недоступна: ${(e as Error).message}` };
  }

  if (!res.ok) {
    const body = await res.text();
    console.error(`[paperwork-ai] gateway ${res.status}: ${body}`);
    if (res.status === 429) return { ok: false, title: "", blocks: [], error: "Слишком много запросов к AI, попробуйте через минуту." };
    if (res.status === 402) return { ok: false, title: "", blocks: [], error: "Закончились AI-кредиты рабочего пространства." };
    if (res.status === 403) return { ok: false, title: "", blocks: [], error: "AI отключён политикой рабочего пространства." };
    return { ok: false, title: "", blocks: [], error: `AI вернул ошибку ${res.status}.` };
  }

  const payload = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = payload.choices?.[0]?.message?.content ?? "";
  const parsed = extractJson(content) as { title?: unknown; blocks?: unknown } | null;
  if (!parsed || !Array.isArray(parsed.blocks)) {
    return { ok: false, title: "", blocks: [], error: "Не удалось разобрать ответ AI — попробуйте уточнить запрос." };
  }

  const blocks = normalizeBlocks(parsed.blocks).filter(
    (b) => b.text.trim() || b.items.length || b.rows.length || b.header.length || b.signerTitle || b.type === "spacer",
  );
  if (!blocks.length) return { ok: false, title: "", blocks: [], error: "AI вернул пустой документ." };

  return { ok: true, title: typeof parsed.title === "string" ? parsed.title.slice(0, 200) : "", blocks };
}
