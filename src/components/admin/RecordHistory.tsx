// История изменений конкретной записи (этап 2 аудита админки).
// Читает public.audit_log по record_id и показывает, какие поля менялись.
// Таблица доступна только администраторам (RLS), поэтому блок гейтится правом audit.view.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fmtDateTime } from "@/lib/formatters";
import { usePermissions } from "@/hooks/use-permissions";

type AuditRow = {
  id: string;
  created_at: string;
  action: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
};

const ACTION_LABEL: Record<string, string> = {
  INSERT: "Создано",
  UPDATE: "Изменено",
  DELETE: "Удалено",
};

/** Поля, которые меняются служебно и только шумят в истории. */
const NOISE = new Set(["updated_at", "created_at", "id"]);

function short(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "object") return JSON.stringify(v).slice(0, 80);
  const s = String(v);
  return s.length > 80 ? `${s.slice(0, 80)}…` : s;
}

function diff(row: AuditRow): { field: string; from: unknown; to: unknown }[] {
  const oldD = row.old_data ?? {};
  const newD = row.new_data ?? {};
  const keys = new Set([...Object.keys(oldD), ...Object.keys(newD)]);
  const out: { field: string; from: unknown; to: unknown }[] = [];
  for (const k of keys) {
    if (NOISE.has(k)) continue;
    const a = (oldD as Record<string, unknown>)[k];
    const b = (newD as Record<string, unknown>)[k];
    if (JSON.stringify(a) !== JSON.stringify(b)) out.push({ field: k, from: a, to: b });
  }
  return out.slice(0, 12);
}

export function RecordHistory({ recordId, limit = 20 }: { recordId: string; limit?: number }) {
  const { has } = usePermissions();
  const allowed = has("audit.view");

  const { data: rows = [], isLoading } = useQuery({
    enabled: allowed && !!recordId,
    queryKey: ["record-history", recordId, limit],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("id, created_at, action, old_data, new_data")
        .eq("record_id", recordId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as unknown as AuditRow[];
    },
  });

  if (!allowed) return null;
  if (isLoading) return <div className="text-sm text-muted-foreground">Загружаем историю…</div>;
  if (!rows.length) return <div className="text-sm text-muted-foreground">Изменений пока нет.</div>;

  return (
    <ol className="space-y-3">
      {rows.map((r) => {
        const changes = diff(r);
        return (
          <li key={r.id} className="rounded-lg border border-border/50 p-3">
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{ACTION_LABEL[r.action] ?? r.action}</span>
              <span>{fmtDateTime(r.created_at)}</span>
            </div>
            {changes.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs">
                {changes.map((c) => (
                  <li key={c.field} className="flex flex-wrap gap-1">
                    <span className="text-muted-foreground">{c.field}:</span>
                    <span className="line-through opacity-60">{short(c.from)}</span>
                    <span aria-hidden>→</span>
                    <span className="font-medium">{short(c.to)}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}
