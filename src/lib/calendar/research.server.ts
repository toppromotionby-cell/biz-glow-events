// Внешний поиск для режима планирования. Работает ТОЛЬКО по явной просьбе владельца
// («поищи в интернете», «найди примеры»). Ничего не сохраняет в календарь.

export interface ResearchHit {
  title: string;
  url: string;
  snippet: string;
}

const ENDPOINT = "https://duckduckgo.com/html/";

function decode(s: string): string {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function realUrl(href: string): string {
  const m = /uddg=([^&]+)/.exec(href);
  if (m && m[1]) {
    try {
      return decodeURIComponent(m[1]);
    } catch {
      /* ignore */
    }
  }
  return href.startsWith("http") ? href : `https://duckduckgo.com${href}`;
}

/** Короткая выжимка по запросу: до `limit` ссылок. Никогда не бросает. */
export async function webSearch(query: string, limit = 5): Promise<ResearchHit[]> {
  const q = query.trim();
  if (!q) return [];
  try {
    const res = await fetch(`${ENDPOINT}?q=${encodeURIComponent(q)}&kl=ru-ru`, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PlannerAssistant/1.0)",
        "Accept-Language": "ru,en;q=0.8",
      },
    });
    if (!res.ok) {
      console.error(`[planner-research] search ${res.status}`);
      return [];
    }
    const html = await res.text();
    const hits: ResearchHit[] = [];
    const re = /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>([\s\S]*?)(?=<a[^>]+class="[^"]*result__a|<\/body>)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) && hits.length < limit) {
      const url = realUrl(m[1] ?? "");
      const title = decode(m[2] ?? "");
      const tail = m[3] ?? "";
      const sn = /class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/.exec(tail);
      if (!title || !url) continue;
      hits.push({ title, url, snippet: decode(sn?.[1] ?? "").slice(0, 240) });
    }
    return hits;
  } catch (e) {
    console.error("[planner-research] failed", e);
    return [];
  }
}

/** Признак того, что владелец действительно просит поискать снаружи. */
export function wantsWeb(text: string): boolean {
  return /(поищи|погугли|найди в интернете|поиск в интернете|посмотри в интернете|источник|как у других|примеры из интернета)/i.test(text);
}

export function researchBlock(hits: ResearchHit[]): string {
  if (!hits.length) return "";
  return hits.map((h, i) => `${i + 1}. ${h.title} — ${h.url}\n   ${h.snippet}`).join("\n");
}
