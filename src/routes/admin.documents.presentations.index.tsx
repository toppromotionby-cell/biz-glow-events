// Список презентаций: фильтры, статусы, быстрые действия.
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Presentation as PresentationIcon, Plus, Search, ArrowRight, MoreHorizontal, Copy, Trash2, Download,
} from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTable } from "@/components/admin/AdminTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusPill } from "@/components/admin/StatusPill";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import { useDocumentViewer } from "@/hooks/use-document-viewer";
import { fmtDate } from "@/lib/formatters";
import { STATUS_LABELS, TEMPLATE_LABELS, type PresentationListRow } from "@/lib/presentations/model";
import {
  listPresentations, duplicatePresentation, deletePresentation,
} from "@/lib/presentations.functions";
import { CreatePresentationDialog } from "@/components/admin/presentations/CreatePresentationDialog";

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

function Page() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const viewer = useDocumentViewer();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);

  const listFn = useServerFn(listPresentations);
  const { data, isLoading } = useQuery({
    queryKey: ["presentations", search, status],
    queryFn: () => listFn({ data: { search, status } }),
  });
  const rows = data ?? [];

  const refresh = () => qc.invalidateQueries({ queryKey: ["presentations"] });
  const dupFn = useServerFn(duplicatePresentation);
  const delFn = useServerFn(deletePresentation);
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

  return (
    <div className="space-y-5">
      <AdminPageHeader
        icon={<PresentationIcon className="h-5 w-5 text-primary" />}
        title="Презентации"
        subtitle={`${rows.length} презентаций`}
        action={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />Создать презентацию
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Поиск по названию"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="inline-flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <Button
              key={f.key}
              size="sm"
              variant={status === f.key ? "secondary" : "ghost"}
              onClick={() => setStatus(f.key)}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

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
                  title="Скачать PDF"
                  onClick={() =>
                    viewer.openDocument(`/admin/documents/presentations/${r.id}/render?format=pdf`, {
                      name: `${r.title}.pdf`,
                    })
                  }
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" title="Открыть" onClick={() => open(r)}>
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" title="Действия">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
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

      <CreatePresentationDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(id) => navigate({ to: "/admin/documents/presentations/$id", params: { id } })}
      />
      {dialog}
    </div>
  );
}
