// Исполнение инструментов помощника: чтение возвращает данные, запись — только превью операций.
// Реальное применение — отдельно, в applyOps(), после утверждения человеком.
import { admin } from "@/lib/copilot/guard.server";
import { CATALOG_TABLES, CONTENT_TABLES, type ToolName } from "@/lib/copilot/registry";
import type { CopilotOp, CopilotSettings, CopilotSource } from "@/lib/copilot/types";
import { research } from "@/lib/assistant/research.server";
import { searchFacts, upsertFact } from "@/lib/knowledge/facts.server";
import { runHygiene, renderReport } from "@/lib/hygiene/engine.server";

export type ToolResult =
  | { kind: "data"; data: unknown; sources?: CopilotSource[] }
  | { kind: "ops"; ops: CopilotOp[]; note?: string; sources?: CopilotSource[] };

type Args = Record<string, unknown>;

const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const bool = (v: unknown): boolean | undefined => (typeof v === "boolean" ? v : undefined);
const ids = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.length > 0) : [];

/** Таблицы, которые помощнику разрешено менять, и их первичный ключ. */
export const WRITABLE_TABLES: Record<string, string> = {
  zones: "id",
  services: "id",
  tech_equipment: "id",
  production_items: "id",
  attractions: "id",
  blog_posts: "id",
  cases: "id",
  testimonials: "id",
  catalog_sections: "key",
  orders: "id",
  order_internal_notes: "order_id",
  email_templates: "template_key",
  campaigns: "id",
  knowledge_facts: "id",
};

const READABLE_TABLES = [
  ...CATALOG_TABLES,
  ...CONTENT_TABLES,
  "orders",
  "quotes",
  "promo_quotes",
  "email_templates",
] as const;

const TITLE_FIELD: Record<string, string> = {
  testimonials: "client_name",
  orders: "order_number",
  quotes: "quote_number",
  promo_quotes: "doc_number",
  email_templates: "subject",
  campaigns: "name",
  knowledge_facts: "subject",
  catalog_sections: "title",
};

function labelOf(table: string, row: Record<string, unknown>): string {
  const field = TITLE_FIELD[table] ?? "title";
  return String(row[field] ?? row.title ?? row.name ?? row.id ?? "запись");
}

function pick(row: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) out[k] = row[k] ?? null;
  return out;
}

function patchOf(args: Args, fields: string[]): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const f of fields) {
    const v = args[f];
    if (v === undefined || v === null) continue;
    if (typeof v === "string" && !v.trim()) continue;
    patch[f] = v;
  }
  return patch;
}

async function rowsByIds(table: string, list: string[], pk = "id") {
  const db = await admin();
  const { data, error } = await db.from(table).select("*").in(pk, list);
  if (error) throw new Error(`Не удалось прочитать ${table}: ${error.message}`);
  return (data ?? []) as Record<string, unknown>[];
}

function updateOps(table: string, rows: Record<string, unknown>[], patch: Record<string, unknown>, pk = "id"): CopilotOp[] {
  const keys = Object.keys(patch);
  return rows.map((row) => ({
    op: "update" as const,
    table,
    id: String(row[pk]),
    label: labelOf(table, row),
    before: pick(row, keys),
    after: patch,
  }));
}

/* ------------------------------ исполнители ------------------------------ */

export async function runTool(
  name: ToolName,
  args: Args,
  settings: CopilotSettings,
): Promise<ToolResult> {
  const db = await admin();

  switch (name) {
    case "search_records": {
      const table = str(args.table) ?? "";
      if (!(READABLE_TABLES as readonly string[]).includes(table)) {
        return { kind: "data", data: { error: `Таблица ${table} недоступна` } };
      }
      const limit = Math.min(num(args.limit) ?? 20, 50);
      const q = str(args.query);
      const field = TITLE_FIELD[table] ?? "title";
      let query = db.from(table).select("*").limit(limit);
      if (q) query = query.ilike(field, `%${q}%`);
      const { data, error } = await query;
      if (error) return { kind: "data", data: { error: error.message } };
      const rows = (data ?? []) as Record<string, unknown>[];
      return {
        kind: "data",
        data: {
          count: rows.length,
          rows: rows.map((r) => ({
            id: r.id ?? r.key ?? r.template_key,
            label: labelOf(table, r),
            category: r.category ?? null,
            status: r.status ?? null,
            published: r.published ?? r.enabled ?? r.visible ?? null,
            pricing: r.pricing ?? r.total ?? null,
          })),
        },
      };
    }

    case "read_record": {
      const table = str(args.table) ?? "";
      const id = str(args.id) ?? "";
      if (!(READABLE_TABLES as readonly string[]).includes(table)) {
        return { kind: "data", data: { error: `Таблица ${table} недоступна` } };
      }
      const pk = WRITABLE_TABLES[table] ?? "id";
      const { data, error } = await db.from(table).select("*").eq(pk, id).maybeSingle();
      if (error) return { kind: "data", data: { error: error.message } };
      return { kind: "data", data: data ?? { error: "Запись не найдена" } };
    }

    case "analytics_summary": {
      const days = Math.min(num(args.days) ?? 30, 365);
      const since = new Date(Date.now() - days * 86400000).toISOString();
      const { data } = await db
        .from("orders")
        .select("id, order_number, status, total, paid, event_date, created_at, client_name")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(200);
      const rows = (data ?? []) as Record<string, unknown>[];
      const byStatus: Record<string, number> = {};
      let total = 0;
      let paid = 0;
      for (const r of rows) {
        const s = String(r.status ?? "new");
        byStatus[s] = (byStatus[s] ?? 0) + 1;
        total += Number(r.total ?? 0);
        paid += Number(r.paid ?? 0);
      }
      return {
        kind: "data",
        data: {
          period_days: days,
          orders: rows.length,
          by_status: byStatus,
          total_sum: total,
          paid_sum: paid,
          latest: rows.slice(0, 10).map((r) => ({
            number: r.order_number,
            client: r.client_name,
            status: r.status,
            total: r.total,
            event_date: r.event_date,
          })),
        },
      };
    }

    case "hygiene_scan": {
      const report = await runHygiene({ dryRun: true });
      return { kind: "data", data: { text: renderReport(report).replace(/<[^>]+>/g, "") } };
    }

    case "files_find": {
      const bucket = str(args.bucket) ?? "catalog-media";
      const q = (str(args.query) ?? "").toLowerCase();
      const limit = Math.min(num(args.limit) ?? 20, 50);
      const { data, error } = await db.storage.from(bucket).list("", { limit: 200, sortBy: { column: "created_at", order: "desc" } });
      if (error) return { kind: "data", data: { error: error.message } };
      const files = (data ?? []).filter((f) => !q || f.name.toLowerCase().includes(q)).slice(0, limit);
      return {
        kind: "data",
        data: {
          bucket,
          files: files.map((f) => ({ name: f.name, size: f.metadata?.size ?? null, created_at: f.created_at })),
        },
      };
    }

    case "knowledge_search": {
      const facts = await searchFacts(str(args.query) ?? "", 8);
      return { kind: "data", data: { facts: facts.map((f) => ({ id: f.id, subject: f.subject, fact: f.fact, tags: f.tags })) } };
    }

    case "web_search": {
      if (!settings.allow_web_search) return { kind: "data", data: { error: "Интернет-поиск выключен" } };
      const hits = await research(str(args.query) ?? "", 5);
      return {
        kind: "data",
        data: { hits: hits.map((h) => ({ title: h.title, url: h.url, snippet: h.snippet })) },
        sources: hits.map((h) => ({ title: h.title, url: h.url })),
      };
    }

    /* ------------------------------ запись ------------------------------ */

    case "catalog_update": {
      const table = str(args.table) ?? "";
      if (!(CATALOG_TABLES as readonly string[]).includes(table)) throw new Error("Неизвестная таблица каталога");
      const list = ids(args.ids);
      if (!list.length) throw new Error("Не указаны id позиций");
      const patch = patchOf(args, ["title", "description", "category", "seo_title", "seo_description", "published"]);
      if (!Object.keys(patch).length) throw new Error("Нечего менять: не переданы поля");
      const rows = await rowsByIds(table, list);
      return { kind: "ops", ops: updateOps(table, rows, patch) };
    }

    case "catalog_price_adjust": {
      const table = str(args.table) ?? "";
      if (!(CATALOG_TABLES as readonly string[]).includes(table)) throw new Error("Неизвестная таблица каталога");
      const list = ids(args.ids);
      const category = str(args.category);
      let rows: Record<string, unknown>[];
      if (list.length) rows = await rowsByIds(table, list);
      else if (category) {
        const { data } = await db.from(table).select("*").eq("category", category).limit(settings.max_rows_per_run + 1);
        rows = (data ?? []) as Record<string, unknown>[];
      } else throw new Error("Укажите id позиций или категорию");

      const percent = num(args.percent);
      const setTo = num(args.set);
      const round = num(args.round) ?? 0;
      if (percent === undefined && setTo === undefined) throw new Error("Укажите percent или set");

      const ops: CopilotOp[] = [];
      for (const row of rows) {
        const pricing = (row.pricing ?? {}) as Record<string, unknown>;
        const from = Number(pricing.from ?? 0);
        let next = setTo !== undefined ? setTo : from * (1 + (percent ?? 0) / 100);
        if (round > 0) next = Math.round(next / round) * round;
        next = Math.max(0, Math.round(next * 100) / 100);
        if (next === from) continue;
        ops.push({
          op: "update",
          table,
          id: String(row.id),
          label: labelOf(table, row),
          before: { pricing },
          after: { pricing: { ...pricing, from: next } },
        });
      }
      return { kind: "ops", ops, note: percent !== undefined ? `Изменение цены на ${percent}%` : `Цена «от» = ${setTo}` };
    }

    case "content_update": {
      const table = str(args.table) ?? "";
      if (!(CONTENT_TABLES as readonly string[]).includes(table)) throw new Error("Неизвестная таблица контента");
      const list = ids(args.ids);
      if (!list.length) throw new Error("Не указаны id записей");
      const patch = patchOf(args, [
        "title",
        "excerpt",
        "summary",
        "text",
        "seo_title",
        "seo_description",
        "published",
        "featured",
      ]);
      if (!Object.keys(patch).length) throw new Error("Нечего менять: не переданы поля");
      const rows = await rowsByIds(table, list);
      const allowed = new Set(Object.keys(rows[0] ?? {}));
      for (const k of Object.keys(patch)) if (allowed.size && !allowed.has(k)) delete patch[k];
      return { kind: "ops", ops: updateOps(table, rows, patch) };
    }

    case "section_update": {
      const key = str(args.key);
      if (!key) throw new Error("Не указан ключ раздела");
      const patch = patchOf(args, ["title", "description", "visible", "sort_order"]);
      if (!Object.keys(patch).length) throw new Error("Нечего менять");
      const rows = await rowsByIds("catalog_sections", [key], "key");
      return { kind: "ops", ops: updateOps("catalog_sections", rows, patch, "key") };
    }

    case "order_update": {
      const list = ids(args.ids);
      if (!list.length) throw new Error("Не указаны id заявок");
      const patch = patchOf(args, ["status", "total", "paid", "event_date", "notes"]);
      if (!Object.keys(patch).length) throw new Error("Нечего менять");
      const rows = await rowsByIds("orders", list);
      return { kind: "ops", ops: updateOps("orders", rows, patch) };
    }

    case "order_note_add": {
      const orderId = str(args.orderId);
      const note = str(args.note);
      if (!orderId || !note) throw new Error("Нужны id заявки и текст заметки");
      const { data } = await db.from("order_internal_notes").select("*").eq("order_id", orderId).maybeSingle();
      const prev = (data as Record<string, unknown> | null)?.notes;
      const stamp = new Date().toLocaleString("ru-RU", { timeZone: "Europe/Minsk" });
      const next = `${prev ? `${String(prev)}\n\n` : ""}[${stamp}, Ember] ${note}`;
      return {
        kind: "ops",
        ops: [
          {
            op: data ? "update" : "insert",
            table: "order_internal_notes",
            id: orderId,
            label: `Внутренняя заметка к заявке`,
            before: data ? { notes: prev ?? null } : null,
            after: { order_id: orderId, notes: next },
          },
        ],
      };
    }

    case "mail_template_update": {
      const key = str(args.template_key);
      if (!key) throw new Error("Не указан ключ шаблона");
      const patch = patchOf(args, ["subject", "preheader", "html_body", "enabled"]);
      if (!Object.keys(patch).length) throw new Error("Нечего менять");
      const rows = await rowsByIds("email_templates", [key], "template_key");
      return { kind: "ops", ops: updateOps("email_templates", rows, patch, "template_key") };
    }

    case "campaign_upsert": {
      const id = str(args.id);
      const patch = patchOf(args, ["name", "source", "budget", "start_date", "end_date", "active"]);
      if (!Object.keys(patch).length) throw new Error("Нечего менять");
      if (!id) {
        if (!patch.name) throw new Error("Для новой кампании нужно название");
        return {
          kind: "ops",
          ops: [{ op: "insert", table: "campaigns", id: null, label: String(patch.name), before: null, after: patch }],
        };
      }
      const rows = await rowsByIds("campaigns", [id]);
      return { kind: "ops", ops: updateOps("campaigns", rows, patch) };
    }

    case "knowledge_add": {
      const subject = str(args.subject);
      const fact = str(args.fact);
      if (!subject || !fact) throw new Error("Нужны тема и текст факта");
      const tags = ids(args.tags);
      return {
        kind: "ops",
        ops: [
          {
            op: "insert",
            table: "knowledge_facts",
            id: null,
            label: subject,
            before: null,
            after: { subject, fact, tags, scope: "shared", source_kind: "admin", status: "active" },
          },
        ],
      };
    }

    case "knowledge_archive": {
      const id = str(args.id);
      if (!id) throw new Error("Не указан id факта");
      const rows = await rowsByIds("knowledge_facts", [id]);
      return { kind: "ops", ops: updateOps("knowledge_facts", rows, { status: "stale" }) };
    }

    case "catalog_delete": {
      const table = str(args.table) ?? "";
      if (!(CATALOG_TABLES as readonly string[]).includes(table)) throw new Error("Неизвестная таблица каталога");
      const list = ids(args.ids);
      if (!list.length) throw new Error("Не указаны id позиций");
      const rows = await rowsByIds(table, list);
      return {
        kind: "ops",
        ops: rows.map((row) => ({
          op: "delete" as const,
          table,
          id: String(row.id),
          label: labelOf(table, row),
          before: row,
          after: null,
        })),
      };
    }

    default:
      throw new Error(`Инструмент ${name} не реализован`);
  }
}

/* ------------------------------- применение ------------------------------- */

export interface ApplyOutcome {
  applied: CopilotOp[];
  failed: { op: CopilotOp; error: string }[];
}

/** Применяет утверждённые операции и пишет журнал. Возвращает фактически применённые (с id). */
export async function applyOps(ops: readonly CopilotOp[], meta: { runId: string; userId: string; tool?: string }): Promise<ApplyOutcome> {
  const db = await admin();
  const applied: CopilotOp[] = [];
  const failed: { op: CopilotOp; error: string }[] = [];

  for (const op of ops) {
    const pk = WRITABLE_TABLES[op.table];
    if (!pk) {
      failed.push({ op, error: `Таблица ${op.table} закрыта для изменений` });
      continue;
    }
    try {
      let finalId = op.id;
      if (op.op === "insert") {
        if (op.table === "knowledge_facts") {
          const a = (op.after ?? {}) as Record<string, unknown>;
          const res = await upsertFact({
            subject: String(a.subject ?? ""),
            fact: String(a.fact ?? ""),
            tags: Array.isArray(a.tags) ? (a.tags as string[]) : [],
            sourceKind: "admin",
            authorId: meta.userId,
          });
          finalId = res.id;
        } else {
          const { data, error } = await db.from(op.table).insert(op.after as never).select(pk).maybeSingle();
          if (error) throw new Error(error.message);
          finalId = String((data as Record<string, unknown> | null)?.[pk] ?? "");
        }
      } else if (op.op === "delete") {
        const { error } = await db.from(op.table).delete().eq(pk, op.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await db.from(op.table).update(op.after as never).eq(pk, op.id);
        if (error) throw new Error(error.message);
      }
      const done = { ...op, id: finalId };
      applied.push(done);
      await db.from("copilot_audit").insert({
        run_id: meta.runId,
        user_id: meta.userId,
        tool: meta.tool ?? "apply",
        target_table: op.table,
        target_id: finalId,
        action: op.op,
        before: op.before,
        after: op.after,
      } as never);
    } catch (e) {
      failed.push({ op, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return { applied, failed };
}
