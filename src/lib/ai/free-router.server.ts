// Маршрутизатор бесплатных нейросетей.
// Помощник сначала пробует бесплатные источники (их free-tier ключи), и только
// если все недоступны — падает обратно на платный шлюз Lovable AI.
// Ключи читаются внутри обработчика (Worker внедряет env на запрос).

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface FreeChatOptions {
  messages: ChatMessage[];
  /** Максимум символов ответа (мягко, через промпт и обрезку). */
  maxTokens?: number;
  temperature?: number;
  /** Разрешить платный шлюз, если бесплатные не ответили. Управляется настройкой. */
  allowPaidFallback?: boolean;
  signal?: AbortSignal;
}

export interface FreeChatResult {
  text: string;
  provider: string;
  model: string;
  free: boolean;
  attempts: { provider: string; ok: boolean; error?: string }[];
}

interface ProviderDef {
  id: string;
  label: string;
  envKey: string;
  baseUrl: string;
  model: string;
  /** Бесплатный лимит — для панели статуса. */
  limit: string;
  free: true;
}

/**
 * Порядок важен: сверху — самые быстрые и щедрые бесплатные лимиты.
 * Все провайдеры совместимы с OpenAI chat/completions.
 */
export const FREE_PROVIDERS: ProviderDef[] = [
  {
    id: "groq",
    label: "Groq (Llama 3.3 70B)",
    envKey: "GROQ_API_KEY",
    baseUrl: "https://api.groq.com/openai/v1/chat/completions",
    model: "llama-3.3-70b-versatile",
    limit: "~14 400 запросов/сутки бесплатно",
    free: true,
  },
  {
    id: "gemini",
    label: "Google AI Studio (Gemini Flash)",
    envKey: "GEMINI_API_KEY",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    model: "gemini-2.0-flash",
    limit: "1 500 запросов/сутки бесплатно",
    free: true,
  },
  {
    id: "openrouter",
    label: "OpenRouter (free-модели)",
    envKey: "OPENROUTER_API_KEY",
    baseUrl: "https://openrouter.ai/api/v1/chat/completions",
    model: "meta-llama/llama-3.3-70b-instruct:free",
    limit: "50–1000 запросов/сутки на free-моделях",
    free: true,
  },
  {
    id: "mistral",
    label: "Mistral (La Plateforme free)",
    envKey: "MISTRAL_API_KEY",
    baseUrl: "https://api.mistral.ai/v1/chat/completions",
    model: "mistral-small-latest",
    limit: "1 запрос/сек, 500 тыс. токенов/мин",
    free: true,
  },
  {
    id: "github",
    label: "GitHub Models",
    envKey: "GITHUB_MODELS_TOKEN",
    baseUrl: "https://models.inference.ai.azure.com/chat/completions",
    model: "gpt-4o-mini",
    limit: "бесплатно для аккаунтов GitHub (низкий rate limit)",
    free: true,
  },
];

/** Счётчики за время жизни воркера — для панели статуса. */
const stats = new Map<string, { ok: number; fail: number; lastError?: string; lastAt?: string }>();

function note(provider: string, ok: boolean, error?: string) {
  const s = stats.get(provider) ?? { ok: 0, fail: 0 };
  if (ok) s.ok += 1;
  else {
    s.fail += 1;
    if (error) s.lastError = error.slice(0, 200);
  }
  s.lastAt = new Date().toISOString();
  stats.set(provider, s);
}

export function providerStats() {
  return FREE_PROVIDERS.map((p) => ({
    id: p.id,
    label: p.label,
    model: p.model,
    limit: p.limit,
    configured: !!process.env[p.envKey],
    envKey: p.envKey,
    ...(stats.get(p.id) ?? { ok: 0, fail: 0 }),
  }));
}

async function callOpenAiCompatible(
  p: ProviderDef,
  key: string,
  opts: FreeChatOptions,
): Promise<string> {
  const res = await fetch(p.baseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      ...(p.id === "openrouter"
        ? { "HTTP-Referer": "https://event-hub.by", "X-Title": "event-hub.by assistant" }
        : {}),
    },
    body: JSON.stringify({
      model: p.model,
      messages: opts.messages,
      temperature: opts.temperature ?? 0.4,
      max_tokens: opts.maxTokens ?? 1200,
      stream: false,
    }),
    ...(opts.signal ? { signal: opts.signal } : {}),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${p.id} ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = json.choices?.[0]?.message?.content?.trim() ?? "";
  if (!text) throw new Error(`${p.id}: пустой ответ`);
  return text;
}

/** Платный шлюз Lovable AI — только как последний резерв. */
async function callLovableGateway(opts: FreeChatOptions): Promise<string> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("LOVABLE_API_KEY отсутствует");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: "google/gemini-3.7-flash",
      messages: opts.messages,
      temperature: opts.temperature ?? 0.4,
    }),
    ...(opts.signal ? { signal: opts.signal } : {}),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`gateway ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return json.choices?.[0]?.message?.content?.trim() ?? "";
}

/**
 * Основной вызов: перебирает бесплатные провайдеры по порядку.
 * Возвращает первый успешный ответ. Если все упали — платный шлюз (если разрешён).
 */
export async function freeChat(opts: FreeChatOptions): Promise<FreeChatResult> {
  const attempts: FreeChatResult["attempts"] = [];
  for (const p of FREE_PROVIDERS) {
    const key = process.env[p.envKey];
    if (!key) continue;
    try {
      const text = await callOpenAiCompatible(p, key, opts);
      note(p.id, true);
      attempts.push({ provider: p.id, ok: true });
      return { text, provider: p.id, model: p.model, free: true, attempts };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      note(p.id, false, msg);
      attempts.push({ provider: p.id, ok: false, error: msg });
      console.error("[free-router]", msg);
    }
  }

  if (opts.allowPaidFallback === false) {
    throw new Error(
      "Бесплатные нейросети недоступны, а платный резерв отключён. Проверьте ключи в разделе «ИИ-провайдеры».",
    );
  }

  const text = await callLovableGateway(opts);
  attempts.push({ provider: "lovable-gateway", ok: true });
  return { text, provider: "lovable-gateway", model: "google/gemini-3.7-flash", free: false, attempts };
}

/**
 * Консенсус: спрашивает несколько бесплатных провайдеров и возвращает все ответы.
 * Используется самообучением — из разных мнений собирается один выверенный промпт.
 */
export async function freeConsensus(
  messages: ChatMessage[],
  limit = 3,
): Promise<{ provider: string; text: string }[]> {
  const available = FREE_PROVIDERS.filter((p) => !!process.env[p.envKey]).slice(0, limit);
  const results = await Promise.allSettled(
    available.map(async (p) => ({
      provider: p.id,
      text: await callOpenAiCompatible(p, process.env[p.envKey] as string, { messages }),
    })),
  );
  const out = results
    .filter((r): r is PromiseFulfilledResult<{ provider: string; text: string }> => r.status === "fulfilled")
    .map((r) => r.value);
  if (out.length) return out;
  // Ни один бесплатный не ответил — одно мнение от резерва.
  const text = await callLovableGateway({ messages });
  return text ? [{ provider: "lovable-gateway", text }] : [];
}
