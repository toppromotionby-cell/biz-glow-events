// Интернет-поиск помощника: бесплатные источники (DuckDuckGo, Wikipedia) + выжимка моделью.
import { webSearch, type ResearchHit } from "@/lib/calendar/research.server";

export type { ResearchHit };

/** Поиск по русской Википедии — надёжный бесплатный источник фактов. */
export async function wikiSearch(query: string, limit = 3): Promise<ResearchHit[]> {
  const q = query.trim();
  if (!q) return [];
  try {
    const url =
      `https://ru.wikipedia.org/w/api.php?action=query&list=search&format=json&origin=*` +
      `&srsearch=${encodeURIComponent(q)}&srlimit=${limit}`;
    const res = await fetch(url, { headers: { "User-Agent": "EventHubAssistant/1.0" } });
    if (!res.ok) return [];
    const json = (await res.json()) as { query?: { search?: { title: string; snippet: string }[] } };
    return (json.query?.search ?? []).map((s) => ({
      title: s.title,
      url: `https://ru.wikipedia.org/wiki/${encodeURIComponent(s.title.replace(/ /g, "_"))}`,
      snippet: s.snippet.replace(/<[^>]+>/g, "").slice(0, 240),
    }));
  } catch (e) {
    console.error("[assistant-research] wiki failed", e instanceof Error ? e.message : e);
    return [];
  }
}

/** Каскад источников: сначала веб, затем Википедия как страховка. */
export async function research(query: string, limit = 5): Promise<ResearchHit[]> {
  const hits = await webSearch(query, limit);
  if (hits.length >= 2) return hits;
  const wiki = await wikiSearch(query, limit - hits.length);
  const seen = new Set(hits.map((h) => h.url));
  return [...hits, ...wiki.filter((w) => !seen.has(w.url))];
}

export function sourcesBlock(hits: ResearchHit[]): string {
  if (!hits.length) return "";
  return (
    "\n\n<b>Источники</b>\n" +
    hits.map((h, i) => `${i + 1}. <a href="${h.url}">${h.title.replace(/</g, "&lt;")}</a>`).join("\n")
  );
}

export function contextBlock(hits: ResearchHit[]): string {
  if (!hits.length) return "";
  return [
    "Результаты интернет-поиска (проверяй, не выдумывай сверх этого):",
    ...hits.map((h, i) => `${i + 1}. ${h.title} — ${h.url}\n   ${h.snippet}`),
  ].join("\n");
}
