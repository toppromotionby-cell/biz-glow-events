// Серверная логика журнала аудита: фильтры, курсорная пагинация и
// разрешение user_id/record_id в человекочитаемые имена.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface AuditFilters {
  table?: string | undefined;
  action?: string | undefined;
  userId?: string | undefined;
  /** ISO-дата начала (включительно). */
  from?: string | undefined;
  /** ISO-дата конца (включительно). */
  to?: string | undefined;
  cursor?: string | undefined;
  limit: number;
}

export interface AuditEntry {
  id: string;
  created_at: string;
  action: string;
  table_name: string;
  record_id: string | null;
  user_id: string | null;
  user_name: string | null;
}

function endOfDay(date: string): string {
  // Приходит YYYY-MM-DD — расширяем до конца суток, чтобы «по» было включительно.
  return date.length === 10 ? `${date}T23:59:59.999Z` : date;
}

export async function queryAuditLog(f: AuditFilters): Promise<AuditEntry[]> {
  let q = supabaseAdmin
    .from("audit_log")
    .select("id, created_at, action, table_name, record_id, user_id")
    .order("created_at", { ascending: false })
    .limit(f.limit);

  if (f.table) q = q.eq("table_name", f.table);
  if (f.action) q = q.eq("action", f.action);
  if (f.userId) q = q.eq("user_id", f.userId);
  if (f.from) q = q.gte("created_at", f.from);
  if (f.to) q = q.lte("created_at", endOfDay(f.to));
  if (f.cursor) q = q.lt("created_at", f.cursor);

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Omit<AuditEntry, "user_name">[];
  const names = await resolveUserNames(rows.map((r) => r.user_id));

  return rows.map((r) => ({
    ...r,
    user_name: r.user_id ? (names.get(r.user_id) ?? null) : null,
  }));
}

export async function resolveUserNames(ids: (string | null)[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(ids.filter((id): id is string => !!id)));
  const map = new Map<string, string>();
  if (unique.length === 0) return map;

  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, email")
    .in("id", unique);

  for (const p of data ?? []) {
    map.set(p.id, (p.full_name && p.full_name.trim()) || p.email || p.id.slice(0, 8));
  }
  return map;
}

/** Значения для выпадающих фильтров: считаем по свежему срезу журнала. */
export async function queryAuditFacets(): Promise<{
  tables: string[];
  actions: string[];
  users: Array<{ id: string; name: string }>;
}> {
  const { data, error } = await supabaseAdmin
    .from("audit_log")
    .select("action, table_name, user_id")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Array<{ action: string; table_name: string; user_id: string | null }>;
  const names = await resolveUserNames(rows.map((r) => r.user_id));

  return {
    tables: Array.from(new Set(rows.map((r) => r.table_name).filter(Boolean))).sort(),
    actions: Array.from(new Set(rows.map((r) => r.action).filter(Boolean))).sort(),
    users: Array.from(new Set(rows.map((r) => r.user_id).filter((v): v is string => !!v)))
      .map((id) => ({ id, name: names.get(id) ?? id.slice(0, 8) }))
      .sort((a, b) => a.name.localeCompare(b.name, "ru")),
  };
}
