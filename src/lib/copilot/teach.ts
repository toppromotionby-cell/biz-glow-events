// Ручное обучение ИИ-управленца: типы и чистые помощники (клиентобезопасный модуль).

/** Кандидат в базу знаний, полученный из загруженного документа. */
export interface TeachCandidate {
  id: string;
  subject: string;
  fact: string;
  tags: string[];
  confidence: number;
}

export interface TeachPreview {
  title: string;
  summary: string;
  filename: string;
  candidates: TeachCandidate[];
}

export const TEACH_MAX_BYTES = 12 * 1024 * 1024;

/** Что умеем разбирать: PDF, картинки (скан/скриншот) и текстовые форматы. */
export const TEACH_TEXT_MIME =
  /^(text\/(plain|markdown|csv|html)|application\/(json|xml|rtf)|application\/vnd\.openxmlformats.*)$/i;
export const TEACH_IMAGE_MIME = /^image\/(png|jpe?g|webp|heic|heif)$/i;

export function acceptsTeachFile(
  mime: string,
  bytes: number,
  filename = "",
): { ok: boolean; reason?: string; kind?: "pdf" | "image" | "text" } {
  if (bytes <= 0) return { ok: false, reason: "Файл пустой." };
  if (bytes > TEACH_MAX_BYTES) return { ok: false, reason: "Файл больше 12 МБ — загрузите версию полегче." };
  if (mime === "application/pdf") return { ok: true, kind: "pdf" };
  if (TEACH_IMAGE_MIME.test(mime)) return { ok: true, kind: "image" };
  if (TEACH_TEXT_MIME.test(mime) || /\.(txt|md|csv|json|html?|xml)$/i.test(filename)) return { ok: true, kind: "text" };
  return { ok: false, reason: "Поддерживаю PDF, картинки (PNG, JPG, WEBP) и текстовые файлы (TXT, MD, CSV, JSON)." };
}

function clean(value: unknown, max: number): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/** Разбор ответа модели в список фактов. Мусор и пустые строки отбрасываем. */
export function parseTeachJson(raw: string, filename: string): TeachPreview | null {
  const text = raw.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (!json || typeof json !== "object") return null;

  const rawFacts = Array.isArray(json["facts"]) ? (json["facts"] as unknown[]) : [];
  const seen = new Set<string>();
  const candidates: TeachCandidate[] = [];
  for (const item of rawFacts) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const subject = clean(row["subject"], 200);
    const fact = clean(row["fact"], 4000);
    if (!subject || fact.length < 8) continue;
    const key = `${subject.toLowerCase()}|${fact.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const conf = Number(row["confidence"]);
    candidates.push({
      id: `c${candidates.length + 1}`,
      subject,
      fact,
      tags: Array.isArray(row["tags"]) ? (row["tags"] as unknown[]).map((t) => clean(t, 40)).filter(Boolean).slice(0, 6) : [],
      confidence: Number.isFinite(conf) ? Math.min(Math.max(conf, 0.1), 1) : 0.7,
    });
    if (candidates.length >= 40) break;
  }
  if (!candidates.length) return null;

  return {
    title: clean(json["title"], 160) || `Обучение по «${filename}»`,
    summary: clean(json["summary"], 1200) || "Модель выделила факты из документа.",
    filename,
    candidates,
  };
}
