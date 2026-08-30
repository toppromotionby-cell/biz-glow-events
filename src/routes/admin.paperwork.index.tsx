// Раздел «Документы»: быстрый старт по виду документа и список созданных документов.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FileSignature, LayoutTemplate, Search, Trash2 } from "lucide-react";
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
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { fmtDate } from "@/lib/formatters";
import { adminKeys } from "@/lib/query-keys";
import { PW_CATEGORIES, PW_CATEGORY_LABELS, PW_DOC_TYPE_LABELS, PW_STATUS_LABELS } from "@/lib/paperwork/model";
import { PW_KIND_LIST } from "@/lib/paperwork/kinds";
import { deletePaperworkDocument, listPaperworkDocuments } from "@/lib/paperwork.functions";

export const Route = createFileRoute("/admin/paperwork/")({
  head: () => ({ meta: [{ title: "Документы — админка" }] }),
  component: Page,
});

const TONE: Record<string, "muted" | "info" | "success"> = {
  draft: "muted",
  ready: "success",
  archived: "info",
};

function Page() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { confirm, dialog } = useConfirm();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const term = useDebouncedValue(search, 300);

  const listDocs = useServerFn(listPaperworkDocuments);
  const delDoc = useServerFn(deletePaperworkDocument);

  const docs = useQuery({
    queryKey: [...adminKeys.paperwork, term, status],
    queryFn: () => listDocs({ data: { search: term, status } }),
  });

  // Счётчики по видам — тайлы работают как фильтр, документы создаются внутри вида.
  const counts = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const d of docs.data ?? []) acc[d.doc_type] = (acc[d.doc_type] ?? 0) + 1;
    return acc;
  }, [docs.data]);

  const removeDoc = useMutation({
    mutationFn: (id: string) => delDoc({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.paperwork });
      toast.success("Документ удалён");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      {dialog}
      <AdminPageHeader
        icon={<FileSignature className="h-5 w-5" />}
        title="Документы компании"
        subtitle="Письма, приказы, доверенности, счета и акты на фирменных бланках компаний"
        action={
          <Button variant="outline" asChild>
            <Link to="/admin/paperwork/templates">
              <LayoutTemplate className="mr-1 h-4 w-4" /> Шаблоны
            </Link>
          </Button>
        }
      />

      <section className="space-y-4">
        {PW_CATEGORIES.filter((cat) => PW_KIND_LIST.some((k) => k.category === cat)).map((cat) => (
          <div key={cat} className="space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground">{PW_CATEGORY_LABELS[cat]}</h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {PW_KIND_LIST.filter((k) => k.category === cat).map((k) => (
                <Link
                  key={k.type}
                  to="/admin/paperwork/type/$type"
                  params={{ type: k.type }}
                  className="rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary hover:bg-muted/40"
                >
                  <span className="flex items-center justify-between gap-2 text-sm font-medium">
                    {k.label}
                    <span className="text-xs text-muted-foreground">{counts[k.type] ?? 0}</span>
                  </span>
                  <span className="mt-1 line-clamp-2 block text-xs text-muted-foreground">
                    {k.description}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        ))}
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
                <th className="p-3 text-left">Вид</th>
                <th className="p-3 text-left">Компания</th>
                <th className="p-3 text-left">Изменён</th>
                <th className="p-3 text-left">Статус</th>
                <th className="w-24 p-3" />
              </tr>
            </thead>
            <tbody>
              {(docs.data ?? []).map((d) => (
                <tr key={d.id} className="border-t border-border hover:bg-muted/30">
                  <td className="p-3">
                    <button
                      className="text-left font-medium hover:underline"
                      onClick={() => navigate({ to: "/admin/paperwork/$id", params: { id: d.id } })}
                    >
                      {d.title}
                    </button>
                    {d.doc_number && (
                      <span className="ml-2 text-xs text-muted-foreground">№ {d.doc_number}</span>
                    )}
                  </td>
                  <td className="p-3 text-muted-foreground">{PW_DOC_TYPE_LABELS[d.doc_type]}</td>
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
              {!docs.isLoading && !(docs.data ?? []).length && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-sm text-muted-foreground">
                    Документов пока нет — откройте нужный вид документа выше и создайте первый.
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
