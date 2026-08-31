// Чистые функции превью «было → стало». Клиентобезопасно, покрыто тестами.
import type { CopilotOp } from "@/lib/copilot/types";

export const FIELD_LABEL: Record<string, string> = {
  title: "Название",
  name: "Название",
  slug: "Адрес",
  description: "Описание",
  excerpt: "Краткое описание",
  summary: "Краткое описание",
  text: "Текст",
  category: "Категория",
  published: "Публикация",
  visible: "Видимость",
  featured: "Избранное",
  enabled: "Включён",
  active: "Активна",
  status: "Статус",
  total: "Сумма",
  paid: "Оплачено",
  event_date: "Дата мероприятия",
  notes: "Заметки",
  pricing: "Цена",
  seo_title: "SEO-заголовок",
  seo_description: "SEO-описание",
  subject: "Тема",
  preheader: "Прехедер",
  html_body: "HTML письма",
  sort_order: "Порядок",
  budget: "Бюджет",
  source: "Источник",
  start_date: "Начало",
  end_date: "Окончание",
  fact: "Факт",
  tags: "Метки",
  note: "Заметка",
};

export function fieldLabel(key: string): string {
  return FIELD_LABEL[key] ?? key;
}

/** Значение поля в виде короткой строки для таблицы превью. */
export function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "да" : "нет";
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.length ? value.map((v) => formatValue(v)).join(", ") : "—";
  if (typeof value === "object") {
    const p = value as Record<string, unknown>;
    if (typeof p.from === "number") {
      const unit = typeof p.unit === "string" && p.unit ? ` / ${p.unit}` : "";
      return `от ${p.from} ${String(p.currency ?? "BYN")}${unit}`;
    }
    return JSON.stringify(value);
  }
  const s = String(value);
  return s.length > 160 ? `${s.slice(0, 157)}…` : s;
}

export interface DiffRow {
  field: string;
  label: string;
  before: string;
  after: string;
}

/** Построчный список изменённых полей одной операции. */
export function opDiff(op: CopilotOp): DiffRow[] {
  const keys = new Set([...Object.keys(op.before ?? {}), ...Object.keys(op.after ?? {})]);
  const rows: DiffRow[] = [];
  for (const key of keys) {
    const before = op.before?.[key];
    const after = op.after?.[key];
    const b = formatValue(before);
    const a = formatValue(after);
    if (b === a) continue;
    rows.push({ field: key, label: fieldLabel(key), before: b, after: a });
  }
  return rows;
}

/** Осмысленные операции: вставка, удаление или реально изменённые поля. */
export function meaningfulOps(ops: readonly CopilotOp[]): CopilotOp[] {
  return ops.filter((o) => o.op !== "update" || opDiff(o).length > 0);
}

export function opVerb(op: CopilotOp["op"]): string {
  return op === "insert" ? "Создать" : op === "delete" ? "Удалить" : "Изменить";
}

/** Краткая сводка плана для чата и озвучки. */
export function summarizeOps(ops: readonly CopilotOp[]): string {
  const real = meaningfulOps(ops);
  if (!real.length) return "Изменений нет.";
  const byTable = new Map<string, number>();
  for (const o of real) byTable.set(o.table, (byTable.get(o.table) ?? 0) + 1);
  const parts = [...byTable.entries()].map(([t, n]) => `${t}: ${n}`);
  return `${real.length} изменени${plural(real.length)} (${parts.join(", ")})`;
}

function plural(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "е";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "я";
  return "й";
}

/** Обратные операции для отката применённого плана. */
export function invertOps(ops: readonly CopilotOp[]): CopilotOp[] {
  const out: CopilotOp[] = [];
  for (const o of ops) {
    if (o.op === "update") {
      out.push({ ...o, before: o.after, after: o.before });
    } else if (o.op === "insert") {
      out.push({ ...o, op: "delete", before: o.after, after: null });
    } else {
      out.push({ ...o, op: "insert", before: null, after: o.before });
    }
  }
  return out;
}
