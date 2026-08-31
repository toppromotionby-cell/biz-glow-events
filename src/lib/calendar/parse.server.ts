// Разбор реплики (текст или голос) в структуру записи календаря через Lovable AI.
import { guessKind, detectImportance, guessDirection, type CalDirection } from "@/lib/calendar/model";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.7-flash";

export interface ParsedIntent {
  kind: "task" | "meeting";
  title: string;
  direction_key: string | null;
  starts_at: string | null; // ISO
  ends_at: string | null;
  due_at: string | null;
  all_day: boolean;
  importance: "normal" | "hard";
  location: string | null;
  participants: string[];
  notes: string | null;
  confidence: number; // 0..1
  question: string | null; // уточняющий вопрос, если чего-то не хватает
}

export class AiBlockedError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function aiChat(messages: unknown[]): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new AiBlockedError("LOVABLE_API_KEY не настроен", 401);
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, messages }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`[planner-ai] ${res.status}: ${body}`);
    if (res.status === 402 || res.status === 403 || res.status === 429) {
      throw new AiBlockedError(body.slice(0, 300) || `AI недоступен (${res.status})`, res.status);
    }
    throw new Error(`AI ${res.status}: ${body.slice(0, 300)}`);
  }
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return json.choices?.[0]?.message?.content ?? "";
}

function extractJson(text: string): Record<string, unknown> | null {
  const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

/** Расшифровка голосового сообщения (мультимодальный вход). */
export async function transcribeVoice(base64: string, mime: string): Promise<string> {
  const content = await aiChat([
    {
      role: "user",
      content: [
        { type: "text", text: "Расшифруй эту аудиозапись на русском. Верни только текст, без комментариев." },
        { type: "input_audio", input_audio: { data: base64, format: mime.includes("mp") ? "mp3" : "ogg" } },
      ],
    },
  ]);
  return content.trim();
}

function systemPrompt(nowIso: string, tz: string, directions: CalDirection[], style: string | null): string {
  const dirs = directions.map((d) => `${d.key} — ${d.title} (${d.keywords.join(", ")})`).join("\n");
  return `Ты — планировщик-ассистент владельца бизнеса. Разбираешь реплику в структуру записи календаря.
Текущее время: ${nowIso}. Часовой пояс пользователя: ${tz}.
Направления:
${dirs}

Верни ТОЛЬКО JSON:
{"kind":"task|meeting","title":"кратко","direction_key":"ключ или null","starts_at":"ISO8601 с офсетом или null","ends_at":"ISO или null","due_at":"ISO или null","all_day":false,"importance":"normal|hard","location":null,"participants":[],"notes":null,"confidence":0.0,"question":null}

Правила:
- Встреча — есть собеседник/место/время. Задача — действие, которое надо сделать к сроку.
- «жёсткая», «нельзя перенести», «обязательно» → importance = "hard".
- Относительные даты («завтра в 15», «в пятницу») считай от текущего времени в поясе пользователя.
- Для встречи без длительности ставь ends_at = начало + 1 час.
- Если время или направление непонятны, поставь низкий confidence и задай ОДИН короткий уточняющий вопрос в поле question.
- Ничего не выдумывай: неизвестное — null.${style ? `\n- Стиль ответа пользователя: ${style}` : ""}`;
}

export async function parseIntent(
  text: string,
  opts: { tz: string; directions: CalDirection[]; style?: string | null },
): Promise<ParsedIntent> {
  const raw = await aiChat([
    { role: "system", content: systemPrompt(new Date().toISOString(), opts.tz, opts.directions, opts.style ?? null) },
    { role: "user", content: text },
  ]);
  const parsed = extractJson(raw);
  const fallbackDir = guessDirection(text, opts.directions);
  if (!parsed) {
    return {
      kind: guessKind(text),
      title: text.slice(0, 120),
      direction_key: fallbackDir?.key ?? null,
      starts_at: null,
      ends_at: null,
      due_at: null,
      all_day: false,
      importance: detectImportance(text),
      location: null,
      participants: [],
      notes: null,
      confidence: 0.3,
      question: "Не разобрал время. На когда поставить?",
    };
  }
  const kind = parsed.kind === "meeting" || parsed.kind === "task" ? (parsed.kind as "task" | "meeting") : guessKind(text);
  const dirKey =
    typeof parsed.direction_key === "string" && opts.directions.some((d) => d.key === parsed.direction_key)
      ? (parsed.direction_key as string)
      : fallbackDir?.key ?? null;
  const iso = (v: unknown): string | null => {
    if (typeof v !== "string" || !v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  };
  const importance =
    parsed.importance === "hard" || detectImportance(text) === "hard" ? "hard" : "normal";
  return {
    kind,
    title: typeof parsed.title === "string" && parsed.title.trim() ? parsed.title.trim().slice(0, 160) : text.slice(0, 120),
    direction_key: dirKey,
    starts_at: iso(parsed.starts_at),
    ends_at: iso(parsed.ends_at),
    due_at: iso(parsed.due_at),
    all_day: parsed.all_day === true,
    importance,
    location: typeof parsed.location === "string" ? parsed.location : null,
    participants: Array.isArray(parsed.participants) ? parsed.participants.filter((p): p is string => typeof p === "string") : [],
    notes: typeof parsed.notes === "string" ? parsed.notes : null,
    confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.6,
    question: typeof parsed.question === "string" && parsed.question.trim() ? parsed.question.trim() : null,
  };
}

/** Разбиение крупной задачи на шаги (по запросу пользователя). */
export async function splitTaskIntoSteps(title: string, notes: string | null): Promise<string[]> {
  const raw = await aiChat([
    {
      role: "system",
      content:
        "Ты — личный ассистент. Разбей задачу на 3–7 конкретных выполнимых шагов в правильном порядке. " +
        "Верни ТОЛЬКО JSON-массив строк, без комментариев и без нумерации внутри строк.",
    },
    { role: "user", content: `Задача: ${title}${notes ? `\nДетали: ${notes}` : ""}` },
  ]);
  const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const pick = (text: string): string[] => {
    try {
      const arr = JSON.parse(text) as unknown;
      if (Array.isArray(arr)) {
        return arr.filter((s): s is string => typeof s === "string").map((s) => s.trim()).filter(Boolean).slice(0, 10);
      }
    } catch { /* не JSON */ }
    return [];
  };
  const direct = pick(cleaned);
  if (direct.length) return direct;
  const m = cleaned.match(/\[[\s\S]*\]/);
  return m ? pick(m[0]) : [];
}

/** Короткий совет по приоритетам дня в стиле пользователя. */
export async function adviseDay(summary: string, style: string | null): Promise<string> {
  try {
    const out = await aiChat([
      {
        role: "system",
        content: `Ты — личный ассистент. Дай максимум 3 коротких пункта: с чего начать день и на что обратить внимание. Без воды и эмодзи-спама.${style ? ` Стиль общения пользователя: ${style}` : ""}`,
      },
      { role: "user", content: summary },
    ]);
    return out.trim();
  } catch {
    return "";
  }
}
