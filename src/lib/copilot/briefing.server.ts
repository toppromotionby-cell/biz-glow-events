// Оперативная сводка по реальным данным: заявки, позиции, КП, кейсы, документы.
// Подмешивается в системный промпт помощника, чтобы планы были конкретными, а не абстрактными.
import { admin } from "@/lib/copilot/guard.server";

/* eslint-disable @typescript-eslint/no-explicit-any */
type LooseDb = { from: (table: string) => any };

const DAYS = 90;
const TTL_MS = 5 * 60 * 1000;

let cache: { at: number; text: string } | null = null;

const money = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? Math.round(n) : 0;
};

function countBy<T extends string>(rows: Record<string, unknown>[], key: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const k = String(r[key] ?? "—") as T;
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

const fmtCounts = (m: Record<string, number>, limit = 6) =>
  Object.entries(m)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ") || "нет данных";

/** Собирает текстовую сводку по фактическим данным за последние 90 дней. */
export async function buildBriefing(opts: { force?: boolean } = {}): Promise<string> {
  if (!opts.force && cache && Date.now() - cache.at < TTL_MS) return cache.text;

  const db = (await admin()) as unknown as LooseDb;
  const since = new Date(Date.now() - DAYS * 86400_000).toISOString();
  const lines: string[] = [];

  const safe = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await fn();
    } catch {
      return fallback;
    }
  };

  // Заявки
  const orders = await safe(async () => {
    const { data } = await db
      .from("orders")
      .select("order_number,status,total,paid,source,event_date,client_company,created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(400);
    return (data ?? []) as Record<string, unknown>[];
  }, []);

  if (orders.length) {
    const totals = orders.map((o) => money(o.total)).filter((n) => n > 0);
    const avg = totals.length ? Math.round(totals.reduce((a, b) => a + b, 0) / totals.length) : 0;
    const paid = orders.filter((o) => o.paid === true).length;
    lines.push(
      `Заявки за ${DAYS} дн.: ${orders.length}, оплачено ${paid}, средний чек ${avg} BYN.`,
      `Статусы заявок: ${fmtCounts(countBy(orders, "status"))}.`,
      `Источники: ${fmtCounts(countBy(orders, "source"), 5)}.`,
    );
    const upcoming = orders
      .filter((o) => typeof o.event_date === "string" && (o.event_date as string) >= new Date().toISOString().slice(0, 10))
      .sort((a, b) => String(a.event_date).localeCompare(String(b.event_date)))
      .slice(0, 5)
      .map((o) => `${o.event_date} — ${o.order_number} (${o.status}${o.client_company ? `, ${o.client_company}` : ""})`);
    if (upcoming.length) lines.push(`Ближайшие мероприятия: ${upcoming.join("; ")}.`);
  } else {
    lines.push(`Заявок за ${DAYS} дн. нет.`);
  }

  // Что чаще всего заказывают
  const items = await safe(async () => {
    const { data } = await db
      .from("order_items")
      .select("title,entity_type,qty,price,created_at")
      .gte("created_at", since)
      .limit(1000);
    return (data ?? []) as Record<string, unknown>[];
  }, []);
  if (items.length) {
    const agg = new Map<string, { n: number; sum: number }>();
    for (const it of items) {
      const t = String(it.title ?? "—");
      const cur = agg.get(t) ?? { n: 0, sum: 0 };
      cur.n += 1;
      cur.sum += money(it.price) * Number(it.qty ?? 1);
      agg.set(t, cur);
    }
    const top = [...agg.entries()]
      .sort((a, b) => b[1].n - a[1].n)
      .slice(0, 8)
      .map(([t, v]) => `${t} ×${v.n} (${Math.round(v.sum)} BYN)`);
    lines.push(`Топ позиций в заявках: ${top.join("; ")}.`);
  }

  // КП и конверсия
  const quotes = await safe(async () => {
    const { data } = await db
      .from("quotes")
      .select("quote_number,status,total,client_response,client_company,created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(300);
    return (data ?? []) as Record<string, unknown>[];
  }, []);
  if (quotes.length) {
    const accepted = quotes.filter((q) => String(q.client_response ?? "") === "accepted").length;
    const totals = quotes.map((q) => money(q.total)).filter((n) => n > 0);
    const avg = totals.length ? Math.round(totals.reduce((a, b) => a + b, 0) / totals.length) : 0;
    lines.push(
      `КП за ${DAYS} дн.: ${quotes.length}, принято клиентом ${accepted} (${Math.round((accepted / quotes.length) * 100)}%), средняя сумма ${avg} BYN.`,
      `Статусы КП: ${fmtCounts(countBy(quotes, "status"))}.`,
    );
  }

  // Каталог: пробелы
  for (const table of ["zones", "services", "tech_equipment", "production_items", "attractions"]) {
    const stat = await safe(async () => {
      const { data } = await db.from(table).select("title,published,seo_description,photo_urls,pricing").limit(500);
      return (data ?? []) as Record<string, unknown>[];
    }, []);
    if (!stat.length) continue;
    const unpub = stat.filter((r) => r.published === false).length;
    const noSeo = stat.filter((r) => !r.seo_description).length;
    const noPhoto = stat.filter((r) => !Array.isArray(r.photo_urls) || (r.photo_urls as unknown[]).length === 0).length;
    const noPrice = stat.filter((r) => !r.pricing || (Array.isArray(r.pricing) && !(r.pricing as unknown[]).length)).length;
    lines.push(
      `Каталог ${table}: всего ${stat.length}, скрыто ${unpub}, без SEO-описания ${noSeo}, без фото ${noPhoto}, без цены ${noPrice}.`,
    );
  }

  // Кейсы и документы
  const cases = await safe(async () => {
    const { data } = await db
      .from("cases")
      .select("title,event_type,guests_count,published,event_date")
      .order("event_date", { ascending: false })
      .limit(8);
    return (data ?? []) as Record<string, unknown>[];
  }, []);
  if (cases.length) {
    lines.push(
      `Свежие кейсы: ${cases
        .map((c) => `${c.title}${c.event_type ? ` (${c.event_type}` : ""}${c.guests_count ? `, ${c.guests_count} гостей)` : c.event_type ? ")" : ""}${c.published ? "" : " [черновик]"}`)
        .join("; ")}.`,
    );
  }

  const docs = await safe(async () => {
    const { data } = await db
      .from("paperwork_documents")
      .select("doc_type,title,status,doc_date")
      .order("created_at", { ascending: false })
      .limit(50);
    return (data ?? []) as Record<string, unknown>[];
  }, []);
  if (docs.length) lines.push(`Документы (последние ${docs.length}): ${fmtCounts(countBy(docs, "doc_type"), 8)}.`);

  const text = lines.join("\n");
  cache = { at: Date.now(), text };
  return text;
}

/** Сброс кэша сводки (используется после применения изменений). */
export function resetBriefingCache(): void {
  cache = null;
}
