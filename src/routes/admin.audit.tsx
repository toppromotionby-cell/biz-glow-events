import { createFileRoute } from "@tanstack/react-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTable } from "@/components/admin/AdminTable";
import { Button } from "@/components/ui/button";
import { fmtDateTime } from "@/lib/formatters";

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

const PAGE_SIZE = 50;

type AuditRow = {
  id: string;
  created_at: string;
  action: string;
  table_name: string;
  record_id: string | null;
  user_id: string | null;
};

function AuditPage() {
  // Курсорная пагинация по created_at: дешевле, чем .range() на больших таблицах
  // (избегаем COUNT(*) и сканов нарастающих смещений).
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ["audit"],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      let q = supabase
        .from("audit_log")
        .select("id, created_at, action, table_name, record_id, user_id")
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);
      if (pageParam) q = q.lt("created_at", pageParam);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as AuditRow[];
    },
    getNextPageParam: (lastPage) =>
      lastPage.length < PAGE_SIZE ? undefined : lastPage[lastPage.length - 1].created_at,
  });

  const rows = data?.pages.flat() ?? [];

  return (
    <div className="space-y-5">
      <AdminPageHeader title="Журнал аудита" />
      <AdminTable
        columns={COLS}
        textSize="xs"
        isLoading={isLoading}
        isEmpty={!isLoading && rows.length === 0}
      >
        {rows.map((r) => (
          <tr key={r.id} className="border-t border-border/40">
            <td className="p-3 whitespace-nowrap">{fmtDateTime(r.created_at)}</td>
            <td className="p-3 font-medium">{r.action}</td>
            <td className="p-3">{r.table_name}</td>
            <td className="p-3 font-mono text-[10px]">{r.record_id?.slice(0, 8)}</td>
            <td className="p-3 font-mono text-[10px]">{r.user_id?.slice(0, 8)}</td>
          </tr>
        ))}
      </AdminTable>
      {hasNextPage && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? "Загрузка…" : "Показать ещё"}
          </Button>
        </div>
      )}
    </div>
  );
}
