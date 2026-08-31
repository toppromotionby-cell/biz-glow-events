// Движок гигиены данных: правила проверки, автопочинка безопасного, очередь модерации.
import { admin } from "@/lib/assistant/store.server";

export type Severity = "info" | "warn" | "critical";
export type FindingStatus = "open" | "fixed" | "dismissed" | "needs_review";

export interface Finding {
  id: string;
  rule_key: string;
  area: string;
  entity_table: string | null;
  entity_id: string | null;
  title: string;
  details: string | null;
  severity: Severity;
  status: FindingStatus;
  created_at: string;
}

export interface RuleResult {
  title: string;
  details?: string;
  severity?: Severity;
  entityTable?: string;
  entityId?: string;
  /** Автопочинка: если правило умеет чинить само и это безопасно. */
  fix?: () => Promise<void>;
}

export interface HygieneRule {
  key: string;
  title: string;
  area: string;
  /** Может ли правило чинить автоматически без человека. */
  autoFixable: boolean;
  run: () => Promise<RuleResult[]>;
}

const DAY = 24 * 3600_000;
const iso = (ms: number) => new Date(Date.now() - ms).toISOString();

export const RULES: HygieneRule[] = [
  {
    key: "kb_stale_facts",
    title: "Устаревшие факты базы знаний",
    area: "knowledge",
    autoFixable: true,
    run: async () => {
      const db = await admin();
      const { data } = await db
        .from("knowledge_facts")
        .select("id, subject, valid_until, updated_at, status")
        .eq("status", "active")
        .or(`valid_until.lt.${new Date().toISOString()},updated_at.lt.${iso(365 * DAY)}`)
        .limit(100);
      return ((data ?? []) as { id: string; subject: string }[]).map((r) => ({
        title: `Факт устарел: ${r.subject}`,
        details: "Срок актуальности вышел или запись не обновлялась больше года.",
        severity: "info" as Severity,
        entityTable: "knowledge_facts",
        entityId: r.id,
        fix: async () => {
          const d2 = await admin();
          await d2.from("knowledge_facts").update({ status: "stale" }).eq("id", r.id);
        },
      }));
    },
  },
  {
    key: "kb_duplicates",
    title: "Дубликаты в базе знаний",
    area: "knowledge",
    autoFixable: false,
    run: async () => {
      const db = await admin();
      const { data } = await db
        .from("knowledge_facts")
        .select("id, subject, fact")
        .eq("status", "active")
        .limit(500);
      const rows = (data ?? []) as { id: string; subject: string; fact: string }[];
      const { similarity } = await import("@/lib/knowledge/facts.server");
      const out: RuleResult[] = [];
      for (let i = 0; i < rows.length; i += 1) {
        for (let j = i + 1; j < rows.length; j += 1) {
          const a = rows[i]!;
          const b = rows[j]!;
          if (a.subject === b.subject && similarity(a.fact, b.fact) >= 0.75) {
            out.push({
              title: `Похожие факты: ${a.subject}`,
              details: `1) ${a.fact.slice(0, 160)}\n2) ${b.fact.slice(0, 160)}`,
              severity: "warn",
              entityTable: "knowledge_facts",
              entityId: b.id,
            });
          }
          if (out.length >= 20) return out;
        }
      }
      return out;
    },
  },
  {
    key: "orders_stalled",
    title: "Зависшие заявки",
    area: "orders",
    autoFixable: false,
    run: async () => {
      const db = await admin();
      const { data } = await db
        .from("orders")
        .select("id, order_number, client_name, status, updated_at")
        .in("status", ["new", "consultation", "estimate"])
        .lt("updated_at", iso(21 * DAY))
        .limit(30);
      return ((data ?? []) as { id: string; order_number: string | null; client_name: string | null; status: string }[]).map(
        (r) => ({
          title: `Заявка №${r.order_number ?? r.id.slice(0, 8)} без движения 3 недели`,
          details: `Клиент: ${r.client_name ?? "—"}. Статус: ${r.status}.`,
          severity: "warn" as Severity,
          entityTable: "orders",
          entityId: r.id,
        }),
      );
    },
  },
  {
    key: "quotes_drafts_dormant",
    title: "Брошенные черновики КП",
    area: "documents",
    autoFixable: false,
    run: async () => {
      const db = await admin();
      const { data } = await db
        .from("quotes")
        .select("id, quote_number, status, updated_at")
        .eq("status", "draft")
        .lt("updated_at", iso(60 * DAY))
        .limit(30);
      return ((data ?? []) as { id: string; quote_number: string | null }[]).map((r) => ({
        title: `Черновик КП ${r.quote_number ?? r.id.slice(0, 8)} лежит больше 2 месяцев`,
        details: "Стоит доработать, отправить или удалить.",
        severity: "info" as Severity,
        entityTable: "quotes",
        entityId: r.id,
      }));
    },
  },
  {
    key: "catalog_incomplete",
    title: "Неполные карточки каталога",
    area: "catalog",
    autoFixable: false,
    run: async () => {
      // Таблицы перебираем динамически, поэтому обходим типизацию клиента.
      const db = (await admin()) as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            eq: (c: string, v: unknown) => { limit: (n: number) => Promise<{ data: unknown[] | null }> };
          };
        };
      };
      const out: RuleResult[] = [];
      for (const table of ["services", "zones", "tech_equipment", "production_items"]) {
        const { data } = await db
          .from(table)
          .select("id, title, description, published")
          .eq("published", true)
          .limit(200);
        for (const raw of (data ?? []) as { id: string; title: string | null; description: string | null }[]) {

          if (!raw.description || raw.description.trim().length < 40) {
            out.push({
              title: `Пустое описание: ${raw.title ?? raw.id.slice(0, 8)}`,
              details: `Таблица ${table}: опубликовано без внятного описания — плохо для SEO.`,
              severity: "info",
              entityTable: table,
              entityId: raw.id,
            });
          }
        }
      }
      return out.slice(0, 40);
    },
  },
  {
    key: "assistant_updates_prune",
    title: "Старые записи дедупликации бота",
    area: "system",
    autoFixable: true,
    run: async () => {
      const db = await admin();
      const { count } = await db
        .from("assistant_bot_updates")
        .select("update_id", { count: "exact", head: true })
        .lt("created_at", iso(14 * DAY));
      if (!count) return [];
      return [
        {
          title: `Чистка служебного журнала: ${count} записей старше 14 дней`,
          severity: "info" as Severity,
          fix: async () => {
            const d2 = await admin();
            await d2.from("assistant_bot_updates").delete().lt("created_at", iso(14 * DAY));
          },
        },
      ];
    },
  },
  {
    key: "link_codes_prune",
    title: "Просроченные коды привязки",
    area: "system",
    autoFixable: true,
    run: async () => {
      const db = await admin();
      const { count } = await db
        .from("assistant_bot_codes")
        .select("code", { count: "exact", head: true })
        .lt("expires_at", new Date().toISOString());
      if (!count) return [];
      return [
        {
          title: `Удалить просроченные коды привязки: ${count}`,
          severity: "info" as Severity,
          fix: async () => {
            const d2 = await admin();
            await d2.from("assistant_bot_codes").delete().lt("expires_at", new Date().toISOString());
          },
        },
      ];
    },
  },
];

export interface HygieneReport {
  ranAt: string;
  autoFixed: number;
  needsReview: number;
  byArea: Record<string, number>;
  top: { title: string; severity: Severity; area: string }[];
  errors: string[];
}

/** Прогон всех включённых правил. Безопасное чинится, спорное уходит в очередь модерации. */
export async function runHygiene(opts?: { dryRun?: boolean }): Promise<HygieneReport> {
  const db = await admin();
  const { data: cfgRows } = await db.from("hygiene_rules").select("key, enabled, auto_fix");
  const cfg = new Map(
    ((cfgRows ?? []) as { key: string; enabled: boolean; auto_fix: boolean }[]).map((r) => [r.key, r]),
  );

  const report: HygieneReport = {
    ranAt: new Date().toISOString(),
    autoFixed: 0,
    needsReview: 0,
    byArea: {},
    top: [],
    errors: [],
  };

  for (const rule of RULES) {
    const conf = cfg.get(rule.key);
    if (conf && conf.enabled === false) continue;
    const allowFix = rule.autoFixable && (conf?.auto_fix ?? true) && !opts?.dryRun;
    try {
      const results = await rule.run();
      for (const r of results) {
        report.byArea[rule.area] = (report.byArea[rule.area] ?? 0) + 1;
        if (allowFix && r.fix) {
          await r.fix();
          report.autoFixed += 1;
          await db.from("hygiene_findings").insert({
            rule_key: rule.key,
            area: rule.area,
            entity_table: r.entityTable ?? null,
            entity_id: r.entityId ?? null,
            title: r.title,
            details: r.details ?? null,
            severity: r.severity ?? "info",
            status: "fixed",
          });
        } else {
          report.needsReview += 1;
          if (report.top.length < 8) {
            report.top.push({ title: r.title, severity: r.severity ?? "info", area: rule.area });
          }
          const { data: dup } = await db
            .from("hygiene_findings")
            .select("id")
            .eq("rule_key", rule.key)
            .eq("title", r.title)
            .in("status", ["open", "needs_review"])
            .maybeSingle();
          if (!dup) {
            await db.from("hygiene_findings").insert({
              rule_key: rule.key,
              area: rule.area,
              entity_table: r.entityTable ?? null,
              entity_id: r.entityId ?? null,
              title: r.title,
              details: r.details ?? null,
              severity: r.severity ?? "info",
              status: (r.severity ?? "info") === "info" ? "open" : "needs_review",
            });
          }
        }
      }
      await db
        .from("hygiene_rules")
        .upsert(
          { key: rule.key, title: rule.title, area: rule.area, last_run_at: new Date().toISOString() } as never,
          { onConflict: "key" },
        );
    } catch (e) {
      report.errors.push(`${rule.key}: ${e instanceof Error ? e.message : "ошибка"}`);
    }
  }
  return report;
}

export function renderReport(rep: HygieneReport): string {
  const areas = Object.entries(rep.byArea)
    .map(([a, n]) => `${a}: ${n}`)
    .join(" · ");
  const lines = [
    "🧹 <b>Гигиена данных</b>",
    `Автоматически исправлено: <b>${rep.autoFixed}</b> · требует решения: <b>${rep.needsReview}</b>`,
    areas ? `Разделы: ${areas}` : "Проблем не найдено — всё чисто.",
  ];
  if (rep.top.length) {
    lines.push("", "<b>Требует внимания</b>");
    for (const t of rep.top) {
      const mark = t.severity === "critical" ? "🔴" : t.severity === "warn" ? "🟡" : "⚪️";
      lines.push(`${mark} ${t.title}`);
    }
  }
  if (rep.errors.length) lines.push("", `⚠️ Ошибки правил: ${rep.errors.join("; ")}`);
  return lines.join("\n");
}

export async function openFindings(limit = 50): Promise<Finding[]> {
  const db = await admin();
  const { data } = await db
    .from("hygiene_findings")
    .select("*")
    .in("status", ["open", "needs_review"])
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as Finding[];
}

export async function decideFinding(id: string, status: FindingStatus, userId: string | null): Promise<void> {
  const db = await admin();
  await db
    .from("hygiene_findings")
    .update({ status, decided_by: userId, decided_at: new Date().toISOString() })
    .eq("id", id);
}
