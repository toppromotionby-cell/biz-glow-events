// Список презентаций: поиск, фильтры, сортировка, таблица/плитка, быстрые действия.
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminKeys } from "@/lib/query-keys";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Presentation as PresentationIcon, Plus, Search, ArrowRight, MoreHorizontal, Copy, Trash2,
  Download, Pencil, X, RefreshCw, AlertTriangle, LayoutGrid, Rows3,
} from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTable } from "@/components/admin/AdminTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { StatusPill } from "@/components/admin/StatusPill";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import { useDocumentViewer } from "@/hooks/use-document-viewer";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { fmtDate } from "@/lib/formatters";
import { STATUS_LABELS, TEMPLATE_LABELS, type PresentationListRow } from "@/lib/presentations/model";
import {
  listPresentations, duplicatePresentation, deletePresentation, renamePresentation,
} from "@/lib/presentations.functions";
import { CreatePresentationDialog } from "@/components/admin/presentations/CreatePresentationDialog";
import { PresentationCards } from "@/components/admin/presentations/PresentationCards";
import { RenamePresentationDialog } from "@/components/admin/presentations/RenamePresentationDialog";

export const Route = createFileRoute("/admin/documents/presentations/")({ component: Page });

const TONE: Record<string, "muted" | "info" | "success"> = {
  draft: "muted",
  ready: "success",
  archived: "info",
};

const FILTERS = [
  { key: "all", label: "Все" },
  { key: "draft", label: "Черновики" },
  { key: "ready", label: "Готовые" },
  { key: "archived", label: "Архив" },
];

const SORTS = [
  { key: "updated", label: "Сначала изменённые" },
  { key: "created", label: "Сначала новые" },
  { key: "title", label: "По названию" },
];

function Page() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const viewer = useDocumentViewer();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("updated");
  const [view, setView] = useState<"table" | "cards">("table");
  const [createOpen, setCreateOpen] = useState(false);
  const [renameRow, setRenameRow] = useState<PresentationListRow | null>(null);

  const listFn = useServerFn(listPresentations);
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: [...adminKeys.presentations, debouncedSearch, status, sort],
    queryFn: () => listFn({ data: { search: debouncedSearch, status, sort } }),
  });
  const rows = data ?? [];
  const searching = debouncedSearch.trim().length > 0;

  const refresh = () => qc.invalidateQueries({ queryKey: adminKeys.presentations });
  const dupFn = useServerFn(duplicatePresentation);
  const delFn = useServerFn(deletePresentation);
  const renFn = useServerFn(renamePresentation);
  const { confirm, dialog } = useConfirm();

  const duplicate = useMutation({
    mutationFn: (r: PresentationListRow) => dupFn({ data: { id: r.id } }),
    onSuccess: (t) => {
      toast.success("Создана копия");
      refresh();
      navigate({ to: "/admin/documents/presentations/$id", params: { id: t.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (r: PresentationListRow) => delFn({ data: { id: r.id } }),
    onSuccess: () => { toast.success("Презентация удалена"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const rename = useMutation({
    mutationFn: (v: { id: string; title: string }) => renFn({ data: v }),
    onSuccess: () => { toast.success("Название обновлено"); setRenameRow(null); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const askDelete = async (r: PresentationListRow) => {
    const ok = await confirm({
      title: "Удалить презентацию?",
      description: `${r.title}. Действие нельзя отменить.`,
      confirmText: "Удалить",
      destructive: true,
    });
    if (ok) remove.mutate(r);
  };

  const open = (r: PresentationListRow) =>
    navigate({ to: "/admin/documents/presentations/$id", params: { id: r.id } });

  const subtitle = isLoading
    ? "Загружаем…"
    : isError
      ? "Не удалось загрузить список"
      : `${rows.length} ${rows.length === 1 ? "презентация" : "презентаций"}`;

  return (
    <div className="space-y-5">
      <AdminPageHeader
        icon={<PresentationIcon className="h-5 w-5 text-primary" />}
        title="Презентации"
        subtitle={subtitle}
        action={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />Создать презентацию
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
          <Input
            className="pl-8 pr-8"
            placeholder="Поиск по названию"
            aria-label="Поиск презентаций"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              aria-label="Очистить поиск"
              className="absolute right-2 top-2.5 rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => setSearch("")}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="inline-flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <Button
              key={f.key}
              size="sm"
              variant={status === f.key ? "secondary" : "ghost"}
              aria-pressed={status === f.key}
              onClick={() => setStatus(f.key)}
            >
              {f.label}
            </Button>
          ))}
        </div>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="h-9 w-[190px]" aria-label="Сортировка">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORTS.map((s) => (
              <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="inline-flex gap-1">
          <Button
            size="icon"
            variant={view === "table" ? "secondary" : "ghost"}
            aria-label="Таблица"
            aria-pressed={view === "table"}
            onClick={() => setView("table")}
          >
            <Rows3 className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant={view === "cards" ? "secondary" : "ghost"}
            aria-label="Плитка"
            aria-pressed={view === "cards"}
            onClick={() => setView("cards")}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isError ? (
        <div className="glass flex flex-col items-center gap-3 rounded-xl p-10 text-center">
          <AlertTriangle className="h-6 w-6 text-destructive" aria-hidden />
          <div>
            <p className="font-medium">Не удалось загрузить презентации</p>
            <p className="text-sm text-muted-foreground">
              {error instanceof Error ? error.message : "Попробуйте ещё раз"}
            </p>
          </div>
          <Button variant="outline" size="sm" disabled={isFetching} onClick={() => void refetch()}>
            <RefreshCw className={`mr-1.5 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />Повторить
          </Button>
        </div>
      ) : !isLoading && !rows.length ? (
        <div className="glass flex flex-col items-center gap-3 rounded-xl p-10 text-center">
          <PresentationIcon className="h-6 w-6 text-muted-foreground" aria-hidden />
          {searching ? (
            <>
              <p className="font-medium">Ничего не найдено</p>
              <p className="text-sm text-muted-foreground">Попробуйте изменить запрос или фильтр.</p>
              <Button variant="outline" size="sm" onClick={() => { setSearch(""); setStatus("all"); }}>
                Сбросить фильтры
              </Button>
            </>
          ) : (
            <>
              <p className="font-medium">Презентаций пока нет</p>
              <p className="text-sm text-muted-foreground">
                Соберите презентацию с нуля или автоматически по позициям КП.
              </p>
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="mr-1.5 h-4 w-4" />Создать первую презентацию
              </Button>
            </>
          )}
        </div>
      ) : view === "cards" ? (
        isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-56 animate-pulse rounded-xl bg-muted/30" />
            ))}
          </div>
        ) : (
          <PresentationCards
            rows={rows}
            onOpen={open}
            onRename={setRenameRow}
            onDuplicate={(r) => duplicate.mutate(r)}
            onDelete={(r) => void askDelete(r)}
          />
        )
      ) : (
        <AdminTable
          columns={[
            { key: "title", label: "Название" },
            { key: "company", label: "Компания" },
            { key: "quote", label: "КП" },
            { key: "slides", label: "Слайдов" },
            { key: "template", label: "Оформление" },
            { key: "status", label: "Статус" },
            { key: "updated", label: "Обновлена" },
            { key: "actions", label: "" },
          ]}
          isLoading={isLoading}
          isEmpty={!rows.length}
          emptyText="Презентаций пока нет"
        >
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-border/50 transition-colors hover:bg-muted/30">
              <td className="p-3">
                <button type="button" className="text-left font-medium hover:text-primary" onClick={() => open(r)}>
                  {r.title}
                </button>
              </td>
              <td className="p-3 text-muted-foreground">{r.company_name ?? "—"}</td>
              <td className="p-3 whitespace-nowrap tabular-nums text-muted-foreground">
                {r.quote_number ?? "—"}
              </td>
              <td className="p-3 tabular-nums">{r.slides_count}</td>
              <td className="p-3 text-muted-foreground">{TEMPLATE_LABELS[r.template]}</td>
              <td className="p-3">
                <StatusPill tone={TONE[r.status] ?? "muted"}>{STATUS_LABELS[r.status]}</StatusPill>
              </td>
              <td className="p-3 whitespace-nowrap text-muted-foreground">{fmtDate(r.updated_at)}</td>
              <td className="p-3">
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Скачать PDF: ${r.title}`}
                    title="Скачать PDF"
                    disabled={!r.slides_count}
                    onClick={() =>
                      viewer.openDocument(`/admin/documents/presentations/${r.id}/render?format=pdf`, {
                        name: `${r.title}.pdf`,
                      })
                    }
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label={`Открыть ${r.title}`} title="Открыть" onClick={() => open(r)}>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label={`Действия: ${r.title}`} title="Действия">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => open(r)}>Открыть</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setRenameRow(r)}>
                        <Pencil className="mr-2 h-4 w-4" />Переименовать
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => duplicate.mutate(r)}>
                        <Copy className="mr-2 h-4 w-4" />Дублировать
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive" onClick={() => void askDelete(r)}>
                        <Trash2 className="mr-2 h-4 w-4" />Удалить
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </td>
            </tr>
          ))}
        </AdminTable>
      )}

      <CreatePresentationDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(id) => navigate({ to: "/admin/documents/presentations/$id", params: { id } })}
      />
      <RenamePresentationDialog
        open={!!renameRow}
        initialTitle={renameRow?.title ?? ""}
        saving={rename.isPending}
        onOpenChange={(v) => { if (!v) setRenameRow(null); }}
        onSubmit={(title) => renameRow && rename.mutate({ id: renameRow.id, title })}
      />
      {dialog}
    </div>
  );
}
