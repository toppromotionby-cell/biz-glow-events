// Раздел одного вида документа: свои шаблоны, свои документы, создание — только здесь.
import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft,
  FileSignature,
  LayoutTemplate,
  Loader2,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusPill } from "@/components/admin/StatusPill";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import { LoanLenderDialog } from "@/components/admin/paperwork/LoanLenderDialog";
import { AttorneyKindDialog } from "@/components/admin/paperwork/AttorneyKindDialog";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { fmtDate } from "@/lib/formatters";
import { adminKeys } from "@/lib/query-keys";
import { PW_STATUS_LABELS, type PwDocType } from "@/lib/paperwork/model";
import { PW_KINDS, pwKind } from "@/lib/paperwork/kinds";
import {
  createDocumentFromTemplate,
  deletePaperworkDocument,
  deletePaperworkTemplate,
  listPaperworkDocuments,
  listPaperworkTemplates,
} from "@/lib/paperwork.functions";

export const Route = createFileRoute("/admin/paperwork/type/$type")({
  head: () => ({ meta: [{ title: "Документы по виду — админка" }] }),
  component: Page,
});

const TONE: Record<string, "muted" | "info" | "success"> = {
  draft: "muted",
  ready: "success",
  archived: "info",
};

function Page() {
  const { type } = useParams({ from: "/admin/paperwork/type/$type" });
  const docType = (PW_KINDS[type as PwDocType] ? type : "custom") as PwDocType;
  const kind = pwKind(docType);

  const qc = useQueryClient();
  const navigate = useNavigate();
  const { confirm, dialog } = useConfirm();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [lenderOpen, setLenderOpen] = useState(false);
  const [attorneyOpen, setAttorneyOpen] = useState(false);
  const isLoan = docType === "loan";
  const isAttorney = docType === "attorney";
  const term = useDebouncedValue(search, 300);

  const listDocs = useServerFn(listPaperworkDocuments);
  const listTpl = useServerFn(listPaperworkTemplates);
  const createDoc = useServerFn(createDocumentFromTemplate);
  const delDoc = useServerFn(deletePaperworkDocument);
  const delTpl = useServerFn(deletePaperworkTemplate);

  const docs = useQuery({
    queryKey: [...adminKeys.paperwork, docType, term, status],
    queryFn: () => listDocs({ data: { docType, search: term, status } }),
  });

  const templates = useQuery({
    queryKey: [...adminKeys.paperworkTemplates, "type", docType],
    queryFn: () => listTpl({ data: { docType } }),
  });

  const open = (id: string) => navigate({ to: "/admin/paperwork/$id", params: { id } });

  const create = useMutation({
    mutationFn: (templateId?: string) =>
      createDoc({ data: templateId ? { templateId } : { kind: docType } }),
    onSuccess: ({ id }) => {
      qc.invalidateQueries({ queryKey: adminKeys.paperwork });
      open(id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Договор займа: сначала спрашиваем, кто выдаёт заём, — от этого зависит шаблон.
  const createFromPreset = useMutation({
    mutationFn: (args: string | null | { presetId: string; title: string; values: Record<string, string> }) =>
      typeof args === "object" && args !== null
        ? createDoc({ data: args })
        : createDoc({ data: args ? { presetId: args } : { kind: docType } }),
    onSuccess: ({ id }) => {
      qc.invalidateQueries({ queryKey: adminKeys.paperwork });
      setLenderOpen(false);
      setAttorneyOpen(false);
      setWorkActOpen(false);
      open(id);
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const removeDoc = useMutation({
    mutationFn: (id: string) => delDoc({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.paperwork });
      toast.success("Документ удалён");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeTpl = useMutation({
    mutationFn: (id: string) => delTpl({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.paperworkTemplates });
      toast.success("Шаблон удалён");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const list = docs.data ?? [];
  const tpls = templates.data ?? [];

  return (
    <div className="space-y-5">
      {dialog}
      <LoanLenderDialog
        open={lenderOpen}
        onOpenChange={setLenderOpen}
        busy={createFromPreset.isPending}
        onPick={(presetId) => createFromPreset.mutate(presetId)}
      />
      <AttorneyKindDialog
        open={attorneyOpen}
        onOpenChange={setAttorneyOpen}
        busy={createFromPreset.isPending}
        onPick={(presetId) => createFromPreset.mutate(presetId)}
      />
      <Link
        to="/admin/paperwork"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> Все документы
      </Link>

      <AdminPageHeader
        icon={<FileSignature className="h-5 w-5" />}
        title={kind.label}
        subtitle={kind.description}
        action={
          <Button
            onClick={() =>
              isLoan
                ? setLenderOpen(true)
                : isAttorney
                  ? setAttorneyOpen(true)
                  : create.mutate(undefined)
            }
            disabled={create.isPending}
          >
            {create.isPending ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-1 h-4 w-4" />
            )}
            Создать документ
          </Button>
        }
      />

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">Шаблоны вида</h2>
        {tpls.length ? (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {tpls.map((t) => (
              <div
                key={t.id}
                className="flex items-start gap-2 rounded-lg border border-border bg-card p-3"
              >
                <LayoutTemplate className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{t.name}</p>
                  {t.description && (
                    <p className="line-clamp-2 text-xs text-muted-foreground">{t.description}</p>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    onClick={() => create.mutate(t.id)}
                    disabled={create.isPending}
                  >
                    Создать из шаблона
                  </Button>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Удалить шаблон"
                  onClick={async () => {
                    const ok = await confirm({
                      title: "Удалить шаблон?",
                      description: t.name,
                      confirmText: "Удалить",
                      destructive: true,
                    });
                    if (ok) removeTpl.mutate(t.id);
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
            Шаблонов этого вида пока нет. Создайте документ и нажмите «В шаблоны» в редакторе.
          </p>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по названию"
              className="pl-9"
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все статусы</SelectItem>
              <SelectItem value="draft">Черновики</SelectItem>
              <SelectItem value="ready">Готовые</SelectItem>
              <SelectItem value="archived">Архив</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="p-3 text-left">Документ</th>
                <th className="p-3 text-left">Компания</th>
                <th className="p-3 text-left">Изменён</th>
                <th className="p-3 text-left">Статус</th>
                <th className="w-16 p-3" />
              </tr>
            </thead>
            <tbody>
              {list.map((d) => (
                <tr key={d.id} className="border-t border-border hover:bg-muted/30">
                  <td className="p-3">
                    <button
                      className="text-left font-medium hover:underline"
                      onClick={() => open(d.id)}
                    >
                      {d.title}
                    </button>
                    {d.doc_number && (
                      <span className="ml-2 text-xs text-muted-foreground">№ {d.doc_number}</span>
                    )}
                  </td>
                  <td className="p-3 text-muted-foreground">{d.company_name ?? "—"}</td>
                  <td className="p-3 text-muted-foreground">{fmtDate(d.updated_at)}</td>
                  <td className="p-3">
                    <StatusPill tone={TONE[d.status] ?? "muted"}>
                      {PW_STATUS_LABELS[d.status]}
                    </StatusPill>
                  </td>
                  <td className="p-3 text-right">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Удалить"
                      onClick={async () => {
                        const ok = await confirm({
                          title: "Удалить документ?",
                          description: d.title,
                          confirmText: "Удалить",
                          destructive: true,
                        });
                        if (ok) removeDoc.mutate(d.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
              {!docs.isLoading && !list.length && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-sm text-muted-foreground">
                    Документов этого вида ещё нет — нажмите «Создать документ».
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
