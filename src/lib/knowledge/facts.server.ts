// База знаний портала: единый репозиторий фактов. Только сервер.
import { admin } from "@/lib/assistant/store.server";

export type FactStatus = "active" | "pending" | "stale" | "rejected";

export interface Fact {
  id: string;
  scope: string;
  subject: string;
  fact: string;
  source_kind: string;
  source_table: string | null;
  source_id: string | null;
  source_url: string | null;
  author_id: string | null;
  confidence: number;
  valid_until: string | null;
  status: FactStatus;
  tags: string[];
  hits: number;
  created_at: string;
  updated_at: string;
}

export interface FactInput {
  scope?: string;
  subject: string;
  fact: string;
  sourceKind?: "dialog" | "admin" | "web" | "manual" | "system";
  sourceTable?: string | null;
  sourceId?: string | null;
  sourceUrl?: string | null;
  authorId?: string | null;
  confidence?: number;
  validUntil?: string | null;
  status?: FactStatus;
  tags?: string[];
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[«»"'`.,;:!?()]/g, " ").replace(/\s+/g, " ").trim();
}

/** Похожесть строк по общим словам (0..1) — для поиска дублей без расширений БД. */
export function similarity(a: string, b: string): number {
  const A = new Set(norm(a).split(" ").filter((w) => w.length > 2));
  const B = new Set(norm(b).split(" ").filter((w) => w.length > 2));
  if (!A.size || !B.size) return 0;
  let same = 0;
  A.forEach((w) => {
    if (B.has(w)) same += 1;
  });
  return same / Math.max(A.size, B.size);
}

/** Запись факта. Дубликат (похожесть ≥ 0.8 в том же subject) обновляется, а не плодится. */
export async function upsertFact(input: FactInput): Promise<{ id: string; created: boolean }> {
  const db = await admin();
  const subject = input.subject.trim().slice(0, 200);
  const text = input.fact.trim().slice(0, 4000);
  if (!subject || !text) throw new Error("Пустой факт");

  const { data: existing } = await db
    .from("knowledge_facts")
    .select("id, fact, confidence")
    .eq("subject", subject)
    .neq("status", "rejected")
    .limit(50);

  const dup = ((existing ?? []) as { id: string; fact: string; confidence: number }[]).find(
    (r) => similarity(r.fact, text) >= 0.8,
  );

  if (dup) {
    await db
      .from("knowledge_facts")
      .update({
        fact: text,
        confidence: Math.max(dup.confidence ?? 0.5, input.confidence ?? 0.6),
        status: input.status ?? "active",
        updated_at: new Date().toISOString(),
      })
      .eq("id", dup.id);
    return { id: dup.id, created: false };
  }

  const { data, error } = await db
    .from("knowledge_facts")
    .insert({
      scope: input.scope ?? "general",
      subject,
      fact: text,
      source_kind: input.sourceKind ?? "manual",
      source_table: input.sourceTable ?? null,
      source_id: input.sourceId ?? null,
      source_url: input.sourceUrl ?? null,
      author_id: input.authorId ?? null,
      confidence: input.confidence ?? 0.6,
      valid_until: input.validUntil ?? null,
      status: input.status ?? "active",
      tags: input.tags ?? [],
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: (data as { id: string }).id, created: true };
}

/** Поиск фактов по подстроке в теме, тексте и тегах. */
export async function searchFacts(query: string, limit = 8): Promise<Fact[]> {
  const db = await admin();
  const q = query.trim();
  let req = db
    .from("knowledge_facts")
    .select("*")
    .eq("status", "active")
    .order("confidence", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (q) {
    const pat = `%${q.replace(/[%_]/g, " ")}%`;
    req = req.or(`subject.ilike.${pat},fact.ilike.${pat}`);
  }
  const { data } = await req;
  const rows = (data ?? []) as Fact[];
  if (rows.length) {
    await db
      .from("knowledge_facts")
      .update({ hits: (rows[0]!.hits ?? 0) + 1 })
      .eq("id", rows[0]!.id);
  }
  return rows;
}

/** Контекстный блок для модели: короткая выжимка релевантных фактов. */
export async function knowledgeContext(query: string, limit = 6): Promise<string> {
  const rows = await searchFacts(query, limit);
  if (!rows.length) return "";
  return [
    "Факты из базы знаний портала (используй их как достоверные):",
    ...rows.map((r) => `- [${r.subject}] ${r.fact}${r.source_url ? ` (${r.source_url})` : ""}`),
  ].join("\n");
}

export async function setFactStatus(id: string, status: FactStatus): Promise<void> {
  const db = await admin();
  await db.from("knowledge_facts").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
}

export async function listFacts(opts?: { status?: FactStatus; scope?: string; limit?: number }): Promise<Fact[]> {
  const db = await admin();
  let req = db
    .from("knowledge_facts")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(opts?.limit ?? 200);
  if (opts?.status) req = req.eq("status", opts.status);
  if (opts?.scope) req = req.eq("scope", opts.scope);
  const { data } = await req;
  return (data ?? []) as Fact[];
}

/**
 * Автопополнение из админки: любое значимое изменение сущности фиксируется фактом.
 * Вызывается из серверных функций после сохранения.
 */
export async function recordAdminFact(entry: {
  table: string;
  id: string;
  subject: string;
  fact: string;
  authorId?: string | null;
  scope?: string;
}): Promise<void> {
  try {
    await upsertFact({
      scope: entry.scope ?? "admin",
      subject: entry.subject,
      fact: entry.fact,
      sourceKind: "admin",
      sourceTable: entry.table,
      sourceId: entry.id,
      authorId: entry.authorId ?? null,
      confidence: 0.9,
    });
  } catch (e) {
    console.error("[kb] recordAdminFact failed", e instanceof Error ? e.message : e);
  }
}
