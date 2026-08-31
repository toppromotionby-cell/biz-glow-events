// Ручное обучение ИИ-управленца: разбор загруженного документа в факты базы знаний. Только сервер.
import { acceptsTeachFile, parseTeachJson, type TeachCandidate, type TeachPreview } from "@/lib/copilot/teach";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.7-flash";

const SYSTEM = [
  "Ты — методист базы знаний компании Event-Hub (аренда оборудования, зоны, услуги, документы, HR).",
  "Из присланного документа выдели только проверяемые факты, правила и регламенты, полезные для работы админки и ассистентов.",
  "Не выдумывай, не пересказывай воду, не дублируй один факт разными словами. Пиши по-русски, кратко и по делу.",
].join(" ");

const SCHEMA_HINT = `Ответь ТОЛЬКО json-объектом:
{
  "title": "о чём документ (до 120 символов)",
  "summary": "2-4 предложения: что это за документ и что из него стоит запомнить",
  "facts": [
    { "subject": "тема факта, 2-6 слов", "fact": "сам факт одним-двумя предложениями", "tags": ["ключевое-слово"], "confidence": 0.8 }
  ]
}
Не более 25 фактов. Если полезных фактов нет — верни "facts": [].`;

export interface TeachSource {
  filename: string;
  mime: string;
  bytes: number;
  /** base64 без префикса data: — для PDF и картинок. */
  base64?: string;
  /** Готовый текст — для txt/md/csv/json. */
  text?: string;
}

export type TeachOutcome = { ok: true; preview: TeachPreview } | { ok: false; message: string };

/** Сообщения для мультимодальной модели. Вынесено отдельно ради тестов. */
export function teachMessages(src: TeachSource, hint?: string): unknown[] {
  const content: unknown[] = [
    {
      type: "text",
      text: [
        `Документ: ${src.filename}.`,
        hint ? `Пожелание администратора: ${hint}` : "",
        src.text ? `\nСодержимое:\n${src.text.slice(0, 60_000)}` : "",
        `\n${SCHEMA_HINT}`,
      ]
        .filter(Boolean)
        .join("\n"),
    },
  ];
  if (src.base64) {
    if (src.mime === "application/pdf") {
      content.push({
        type: "file",
        file: { filename: src.filename, file_data: `data:application/pdf;base64,${src.base64}` },
      });
    } else {
      content.push({ type: "image_url", image_url: { url: `data:${src.mime};base64,${src.base64}` } });
    }
  }
  return [
    { role: "system", content: SYSTEM },
    { role: "user", content },
  ];
}

/** Разбор документа в кандидаты для базы знаний. Ошибки шлюза — человеческим языком. */
export async function teachPreviewFromSource(src: TeachSource, hint?: string): Promise<TeachOutcome> {
  const check = acceptsTeachFile(src.mime, src.bytes, src.filename);
  if (!check.ok) return { ok: false, message: check.reason ?? "Неподдерживаемый файл." };
  if (!src.base64 && !src.text?.trim()) return { ok: false, message: "Не удалось прочитать содержимое файла." };

  const key = process.env["LOVABLE_API_KEY"];
  if (!key) return { ok: false, message: "ИИ не подключён: нет ключа шлюза." };

  try {
    const res = await fetch(GATEWAY, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        response_format: { type: "json_object" },
        messages: teachMessages(src, hint),
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`[copilot-teach] ${res.status}: ${body.slice(0, 300)}`);
      if (res.status === 429) return { ok: false, message: "Слишком много запросов подряд. Повторите через минуту." };
      if (res.status === 402) return { ok: false, message: "Закончились кредиты ИИ — пополните баланс." };
      if (res.status === 403) return { ok: false, message: "Доступ к ИИ заблокирован настройками рабочего пространства." };
      return { ok: false, message: "Не удалось разобрать документ. Попробуйте ещё раз." };
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const preview = parseTeachJson(json.choices?.[0]?.message?.content ?? "", src.filename);
    if (!preview) return { ok: false, message: "Из документа не удалось выделить факты. Проверьте содержимое." };
    return { ok: true, preview };
  } catch (e) {
    console.error("[copilot-teach] failed", e instanceof Error ? e.message : e);
    return { ok: false, message: "Не получилось обратиться к ИИ. Попробуйте ещё раз." };
  }
}

/** Сохранение утверждённых фактов в общую базу знаний. */
export async function saveTeachCandidates(opts: {
  candidates: TeachCandidate[];
  filename: string;
  title: string;
  authorId: string;
}): Promise<{ saved: number; created: number }> {
  const { upsertFact } = await import("@/lib/knowledge/facts.server");
  let created = 0;
  let saved = 0;
  for (const c of opts.candidates) {
    if (!c.subject.trim() || !c.fact.trim()) continue;
    const r = await upsertFact({
      scope: "shared",
      subject: c.subject.trim().slice(0, 200),
      fact: c.fact.trim().slice(0, 4000),
      sourceKind: "manual",
      sourceUrl: null,
      authorId: opts.authorId,
      confidence: c.confidence,
      tags: [...new Set([...(c.tags ?? []), "обучение", opts.filename].map((t) => t.slice(0, 40)))].slice(0, 8),
      status: "active",
    });
    saved += 1;
    if (r.created) created += 1;
  }
  return { saved, created };
}
