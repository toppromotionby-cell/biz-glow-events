import { createFileRoute } from "@tanstack/react-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useRef } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
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

  // Виртуализация: рендерим только видимые строки в окне просмотра,
  // чтобы тысячи записей аудита не топили DOM при использовании «Показать ещё».
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: () => 44,
    overscan: 10,
    scrollMargin: parentRef.current?.offsetTop ?? 0,
    getItemKey: (i) => rows[i]?.id ?? i,
  });
  const items = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();
  const scrollMargin = virtualizer.options.scrollMargin;
  const paddingTop = items.length > 0 ? Math.max(0, items[0].start - scrollMargin) : 0;
  const paddingBottom = items.length > 0 ? Math.max(0, totalSize - (items[items.length - 1].end - scrollMargin)) : 0;
  const showVirtual = !isLoading && rows.length > 0;

  return (
    <div className="space-y-5">
      <AdminPageHeader title="Журнал аудита" />
      <div ref={parentRef}>
        <AdminTable
          columns={COLS}
          textSize="xs"
          isLoading={isLoading}
          isEmpty={!isLoading && rows.length === 0}
        >
          {showVirtual && paddingTop > 0 && (
            <tr aria-hidden="true"><td colSpan={COLS.length} style={{ height: paddingTop, padding: 0, border: 0 }} /></tr>
          )}
          {showVirtual && items.map((vi) => {
            const r = rows[vi.index];
            return (
              <tr
                key={r.id}
                data-index={vi.index}
                ref={virtualizer.measureElement}
                className="border-t border-border/40"
              >
                <td className="p-3 whitespace-nowrap">{fmtDateTime(r.created_at)}</td>
                <td className="p-3 font-medium">{r.action}</td>
                <td className="p-3">{r.table_name}</td>
                <td className="p-3 font-mono text-[10px]">{r.record_id?.slice(0, 8)}</td>
                <td className="p-3 font-mono text-[10px]">{r.user_id?.slice(0, 8)}</td>
              </tr>
            );
          })}
          {showVirtual && paddingBottom > 0 && (
            <tr aria-hidden="true"><td colSpan={COLS.length} style={{ height: paddingBottom, padding: 0, border: 0 }} /></tr>
          )}
        </AdminTable>
      </div>
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

