// Самообучение помощника: если задача незнакома, он идёт в интернет и к
// бесплатным нейросетям, сверяет ответы и сам пишет себе роль (промпт).
// Роли живут в общей памяти ботов (assistant_memory, scope='shared').
import { freeChat, freeConsensus } from "@/lib/ai/free-router.server";
import { research, contextBlock } from "@/lib/assistant/research.server";

export interface SelfRole {
  key: string;
  title: string;
  prompt: string;
  sources: string[];
  providers: string[];
  updatedAt: string;
}

type Db = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

const ROLE_PREFIX = "role:";

function slug(topic: string) {
  return topic
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/gi, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

/** Уже выученная роль по теме (или null). */
export async function findRole(db: Db, topic: string): Promise<SelfRole | null> {
  const key = ROLE_PREFIX + slug(topic);
  const { data } = await db
    .from("assistant_memory")
    .select("key, value, created_at")
    .eq("kind", "rule")
    .eq("key", key)
    .eq("active", true)
    .maybeSingle();
  if (!data) return null;
  try {
    return JSON.parse(data.value) as SelfRole;
  } catch {
    return {
      key,
      title: topic,
      prompt: data.value,
      sources: [],
      providers: [],
      updatedAt: data.created_at as string,
    };
  }
}

/**
 * Учит новую роль: поиск в интернете → мнения нескольких бесплатных моделей →
 * сведение в один выверенный системный промпт → сохранение в общую память.
 */
export async function learnRole(db: Db, topic: string, context?: string): Promise<SelfRole> {
  const hits = await research(`${topic} лучшие практики промпт инструкция`, 5);
  const opinions = await freeConsensus([
    {
      role: "system",
      content:
        "Ты методолог ИИ-ассистентов. Кратко и по делу формулируешь рабочие инструкции (системные промпты) на русском языке.",
    },
    {
      role: "user",
      content: [
        `Задача, которой ассистент ещё не обучен: «${topic}».`,
        context ? `Контекст компании: ${context}` : "",
        contextBlock(hits),
        "Предложи системный промпт-роль: кто он, какие шаги делает, что уточняет, каких ошибок избегает, в каком формате отвечает. До 250 слов.",
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
  ]);

  const merged = await freeChat({
    messages: [
      {
        role: "system",
        content:
          "Ты сводишь несколько черновиков инструкции в один идеальный системный промпт на русском. Без воды, маркированными пунктами, до 250 слов. Верни только текст промпта.",
      },
      {
        role: "user",
        content:
          `Тема роли: ${topic}\n\nЧерновики:\n` +
          opinions.map((o, i) => `--- Вариант ${i + 1} (${o.provider}) ---\n${o.text}`).join("\n\n"),
      },
    ],
    temperature: 0.3,
  });

  const role: SelfRole = {
    key: ROLE_PREFIX + slug(topic),
    title: topic,
    prompt: merged.text.trim(),
    sources: hits.map((h) => h.url).slice(0, 5),
    providers: [...new Set([...opinions.map((o) => o.provider), merged.provider])],
    updatedAt: new Date().toISOString(),
  };

  await db.from("assistant_memory").upsert(
    {
      kind: "rule",
      key: role.key,
      value: JSON.stringify(role),
      source: "self-learning",
      bot: "assistant",
      scope: "shared",
      weight: 5,
      active: true,
    },
    { onConflict: "kind,key" },
  );

  return role;
}

/**
 * Главная точка входа: берём готовую роль или учим новую.
 * `refresh` — принудительно дообучить (когда роли не хватает).
 */
export async function ensureRole(
  db: Db,
  topic: string,
  opts?: { context?: string; refresh?: boolean },
): Promise<SelfRole> {
  if (!opts?.refresh) {
    const existing = await findRole(db, topic);
    if (existing?.prompt) return existing;
  }
  return learnRole(db, topic, opts?.context);
}

/** Список выученных ролей — для админки. */
export async function listRoles(db: Db): Promise<SelfRole[]> {
  const { data } = await db
    .from("assistant_memory")
    .select("key, value, created_at")
    .eq("kind", "rule")
    .like("key", `${ROLE_PREFIX}%`)
    .order("created_at", { ascending: false })
    .limit(100);
  return (data ?? []).flatMap((r) => {
    try {
      return [JSON.parse(r.value) as SelfRole];
    } catch {
      return [];
    }
  });
}
