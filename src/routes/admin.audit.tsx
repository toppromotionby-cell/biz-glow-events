// Журнал аудита: фильтры (таблица, действие, пользователь, период) в URL,
// курсорная пагинация и разрешение UUID пользователя в имя.
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useRef } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTable } from "@/components/admin/AdminTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtDateTime } from "@/lib/formatters";
import { listAuditLog, getAuditFacets } from "@/lib/audit.functions";
import { adminKeys } from "@/lib/query-keys";
import { X } from "lucide-react";

type AuditSearch = {
  table?: string | undefined;
  action?: string | undefined;
  user?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
};

const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);

export const Route = createFileRoute("/admin/audit")({
  validateSearch: (s: Record<string, unknown>): AuditSearch => ({
    table: str(s["table"]),
    action: str(s["action"]),
    user: str(s["user"]),
    from: str(s["from"]),
    to: str(s["to"]),
  }),
  head: () => ({ meta: [{ title: "Журнал аудита — Админ" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: AuditPage,
});

const COLS = [
  { key: "date", label: "Дата" },
  { key: "action", label: "Действие" },
  { key: "table", label: "Таблица" },
  { key: "record", label: "Запись" },
  { key: "user", label: "Пользователь" },
];

const PAGE_SIZE = 50;
const ALL = "__all__";

const ACTION_LABEL: Record<string, string> = {
  INSERT: "Создание",
  UPDATE: "Изменение",
  DELETE: "Удаление",
};

function AuditPage() {
  const sp = Route.useSearch();
  const navigate = Route.useNavigate();
  const patch = (p: AuditSearch) =>
    void navigate({ to: ".", search: (prev) => ({ ...prev, ...p }), replace: true });

  const fetchLog = useServerFn(listAuditLog);
  const fetchFacets = useServerFn(getAuditFacets);

  const { data: facets } = useQuery({
    queryKey: adminKeys.auditFacets,
    queryFn: () => fetchFacets(),
    staleTime: 5 * 60_000,
  });

  const filters = { table: sp.table, action: sp.action, userId: sp.user, from: sp.from, to: sp.to };
  const hasFilters = Object.values(filters).some(Boolean);

  const { data, isLoading, isError, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: adminKeys.audit(filters),
      initialPageParam: null as string | null,
      queryFn: ({ pageParam }) =>
        fetchLog({
          data: {
            ...filters,
            cursor: pageParam ?? undefined,
            limit: PAGE_SIZE,
          },
        }),
      getNextPageParam: (lastPage) =>
        lastPage.length < PAGE_SIZE ? undefined : lastPage[lastPage.length - 1]!.created_at,
    });

  const rows = data?.pages.flat() ?? [];

  // Виртуализация: рендерим только видимые строки, чтобы тысячи записей
  // не топили DOM при использовании «Показать ещё».
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
  const paddingTop = items.length > 0 ? Math.max(0, items[0]!.start - scrollMargin) : 0;
  const paddingBottom =
    items.length > 0 ? Math.max(0, totalSize - (items[items.length - 1]!.end - scrollMargin)) : 0;
  const showVirtual = !isLoading && !isError && rows.length > 0;

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Журнал аудита"
        subtitle={isLoading ? "Загружаем записи…" : `Показано записей: ${rows.length}${hasNextPage ? "+" : ""}`}
      />

      <div className="glass rounded-xl p-3 flex flex-wrap items-end gap-2">
        <FilterSelect
          label="Таблица"
          value={sp.table}
          options={(facets?.tables ?? []).map((t) => ({ value: t, label: t }))}
          onChange={(v) => patch({ table: v })}
        />
        <FilterSelect
          label="Действие"
          value={sp.action}
          options={(facets?.actions ?? []).map((a) => ({ value: a, label: ACTION_LABEL[a] ?? a }))}
          onChange={(v) => patch({ action: v })}
        />
        <FilterSelect
          label="Пользователь"
          value={sp.user}
          options={(facets?.users ?? []).map((u) => ({ value: u.id, label: u.name }))}
          onChange={(v) => patch({ user: v })}
        />
        <label className="text-xs text-muted-foreground space-y-1">
          <span className="block">С даты</span>
          <Input
            type="date"
            className="h-9 w-[150px]"
            value={sp.from ?? ""}
            onChange={(e) => patch({ from: e.target.value || undefined })}
          />
        </label>
        <label className="text-xs text-muted-foreground space-y-1">
          <span className="block">По дату</span>
          <Input
            type="date"
            className="h-9 w-[150px]"
            value={sp.to ?? ""}
            onChange={(e) => patch({ to: e.target.value || undefined })}
          />
        </label>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9"
            onClick={() => patch({ table: undefined, action: undefined, user: undefined, from: undefined, to: undefined })}
          >
            <X className="h-4 w-4 mr-1" />Сбросить
          </Button>
        )}
      </div>

      <div ref={parentRef}>
        <AdminTable
          columns={COLS}
          textSize="xs"
          isLoading={isLoading}
          isError={isError}
          error={error}
          onRetry={() => void refetch()}
          isEmpty={!isLoading && !isError && rows.length === 0}
          emptyText={hasFilters ? "По выбранным фильтрам записей нет" : "Журнал пуст"}
        >
          {showVirtual && paddingTop > 0 && (
            <tr aria-hidden="true"><td colSpan={COLS.length} style={{ height: paddingTop, padding: 0, border: 0 }} /></tr>
          )}
          {showVirtual && items.map((vi) => {
            const r = rows[vi.index]!;
            return (
              <tr
                key={r.id}
                data-index={vi.index}
                ref={virtualizer.measureElement}
                className="border-t border-border/40"
              >
                <td className="p-3 whitespace-nowrap">{fmtDateTime(r.created_at)}</td>
                <td className="p-3 font-medium">{ACTION_LABEL[r.action] ?? r.action}</td>
                <td className="p-3">{r.table_name}</td>
                <td className="p-3 font-mono text-[10px]">{r.record_id?.slice(0, 8)}</td>
                <td className="p-3">{r.user_name ?? (r.user_id ? r.user_id.slice(0, 8) : "система")}</td>
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
          <Button variant="outline" size="sm" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
            {isFetchingNextPage ? "Загрузка…" : "Показать ещё"}
          </Button>
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  label, value, options, onChange,
}: {
  label: string;
  value: string | undefined;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string | undefined) => void;
}) {
  return (
    <label className="text-xs text-muted-foreground space-y-1">
      <span className="block">{label}</span>
      <Select value={value ?? ALL} onValueChange={(v) => onChange(v === ALL ? undefined : v)}>
        <SelectTrigger className="h-9 w-[190px] text-sm text-foreground">
          <SelectValue placeholder="Все" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Все</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}
