import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/audit")({
  component: AuditPage,
});

function AuditPage() {
  const { data = [] } = useQuery({
    queryKey: ["audit"],
    queryFn: async () => (await supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(200)).data ?? [],
  });

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-display font-bold gradient-text">Журнал аудита</h1>
      <div className="glass rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/30 text-muted-foreground uppercase">
            <tr><th className="text-left p-3">Дата</th><th className="text-left p-3">Действие</th><th className="text-left p-3">Таблица</th><th className="text-left p-3">Запись</th><th className="text-left p-3">User</th></tr>
          </thead>
          <tbody>
            {data.map((r: any) => (
              <tr key={r.id} className="border-t border-border/40">
                <td className="p-3 whitespace-nowrap">{new Date(r.created_at).toLocaleString("ru-BY")}</td>
                <td className="p-3 font-medium">{r.action}</td>
                <td className="p-3">{r.table_name}</td>
                <td className="p-3 font-mono text-[10px]">{r.record_id?.slice(0, 8)}</td>
                <td className="p-3 font-mono text-[10px]">{r.user_id?.slice(0, 8)}</td>
              </tr>
            ))}
            {data.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Пусто</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
