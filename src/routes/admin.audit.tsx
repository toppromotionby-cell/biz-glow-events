import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTable } from "@/components/admin/AdminTable";

export const Route = createFileRoute("/admin/audit")({
  component: AuditPage,
});

const COLS = [
  { key: "date", label: "Дата" },
  { key: "action", label: "Действие" },
  { key: "table", label: "Таблица" },
  { key: "record", label: "Запись" },
  { key: "user", label: "User" },
];

function AuditPage() {
  const { data = [], isLoading } = useQuery({
    queryKey: ["audit"],
    queryFn: async () => (await supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(200)).data ?? [],
  });

  return (
    <div className="space-y-5">
      <AdminPageHeader title="Журнал аудита" />
      <AdminTable
        columns={COLS}
        textSize="xs"
        isLoading={isLoading}
        isEmpty={!isLoading && data.length === 0}
      >
        {data.map((r: any) => (
          <tr key={r.id} className="border-t border-border/40">
            <td className="p-3 whitespace-nowrap">{new Date(r.created_at).toLocaleString("ru-BY")}</td>
            <td className="p-3 font-medium">{r.action}</td>
            <td className="p-3">{r.table_name}</td>
            <td className="p-3 font-mono text-[10px]">{r.record_id?.slice(0, 8)}</td>
            <td className="p-3 font-mono text-[10px]">{r.user_id?.slice(0, 8)}</td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}
