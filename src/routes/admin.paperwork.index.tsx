// Раздел «Документы и шаблоны»: список документов и каталог шаблонов.
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  FileSignature, Plus, Search, Trash2, Sparkles, LayoutTemplate, Download, Star,
} from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusPill } from "@/components/admin/StatusPill";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { fmtDate } from "@/lib/formatters";
import { adminKeys } from "@/lib/query-keys";
import {
  PW_CATEGORIES, PW_CATEGORY_LABELS, PW_DOC_TYPE_LABELS, PW_STATUS_LABELS,
} from "@/lib/paperwork/model";
import {
  createDocumentFromTemplate, deletePaperworkDocument, deletePaperworkTemplate,
  installPaperworkPresets, listPaperworkDocuments, listPaperworkTemplates,
} from "@/lib/paperwork.functions";

export const Route = createFileRoute("/admin/paperwork/")({
  head: () => ({ meta: [{ title: "Документы и шаблоны — админка" }] }),
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
  const [category, setCategory] = useState("all");
  const term = useDebouncedValue(search, 300);

  const listDocs = useServerFn(listPaperworkDocuments);
  const listTpl = useServerFn(listPaperworkTemplates);
  const createDoc = useServerFn(createDocumentFromTemplate);
  const delDoc = useServerFn(deletePaperworkDocument);
  const delTpl = useServerFn(deletePaperworkTemplate);
  const installPresets = useServerFn(installPaperworkPresets);

  const docs = useQuery({
    queryKey: [...adminKeys.paperwork, term, status],
    queryFn: () => listDocs({ data: { search: term, status } }),
  });

  const templates = useQuery({
    queryKey: [...adminKeys.paperworkTemplates, category],
    queryFn: () => listTpl({ data: { category } }),
  });

  const create = useMutation({
    mutationFn: (templateId: string | null) => createDoc({ data: { templateId } }),
    onSuccess: ({ id }) => {
      qc.invalidateQueries({ queryKey: adminKeys.paperwork });
      navigate({ to: "/admin/paperwork/$id", params: { id } });
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

  const install = useMutation({
    mutationFn: () => installPresets({}),
    onSuccess: ({ added }) => {
      qc.invalidateQueries({ queryKey: adminKeys.paperworkTemplates });
      toast.success(added ? `Добавлено шаблонов: ${added}` : "Все встроенные шаблоны уже установлены");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      {dialog}
      <AdminPageHeader
        icon={<FileSignature className="h-5 w-5" />}
        title="Документы и шаблоны"
        subtitle="Письма, приказы, доверенности и справки на фирменных бланках компаний"
        action={
          <Button onClick={() => create.mutate(null)} disabled={create.isPending}>
            <Plus className="mr-1 h-4 w-4" /> Новый документ
          </Button>
        }
      />

      <Tabs defaultValue="docs">
        <TabsList>
          <TabsTrigger value="docs">Мои документы</TabsTrigger>
          <TabsTrigger value="templates">Шаблоны</TabsTrigger>
        </TabsList>

        <TabsContent value="docs" className="mt-4 space-y-3">
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
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
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
                  <th className="p-3 text-left">Тип</th>
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
                      {d.doc_number && <span className="ml-2 text-xs text-muted-foreground">№ {d.doc_number}</span>}
                    </td>
                    <td className="p-3 text-muted-foreground">{PW_DOC_TYPE_LABELS[d.doc_type]}</td>
                    <td className="p-3 text-muted-foreground">{d.company_name ?? "—"}</td>
                    <td className="p-3 text-muted-foreground">{fmtDate(d.updated_at)}</td>
                    <td className="p-3">
                      <StatusPill tone={TONE[d.status] ?? "muted"}>{PW_STATUS_LABELS[d.status]}</StatusPill>
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
                      Документов пока нет — создайте первый или начните с шаблона.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="templates" className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все категории</SelectItem>
                {PW_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{PW_CATEGORY_LABELS[c]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => install.mutate()} disabled={install.isPending}>
              <Download className="mr-1 h-4 w-4" /> Установить встроенные шаблоны
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {(templates.data ?? []).map((t) => (
              <div key={t.id} className="flex flex-col rounded-lg border border-border bg-card p-4">
                <div className="flex items-start gap-2">
                  <LayoutTemplate className="mt-0.5 h-4 w-4 text-primary" />
                  <div className="min-w-0">
                    <h3 className="truncate font-medium">{t.name}</h3>
                    <p className="text-xs text-muted-foreground">{PW_CATEGORY_LABELS[t.category]}</p>
                  </div>
                  {t.is_favorite && <Star className="ml-auto h-4 w-4 text-primary" />}
                </div>
                {t.description && (
                  <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{t.description}</p>
                )}
                <p className="mt-2 text-xs text-muted-foreground">Блоков: {t.blocks.length}</p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" onClick={() => create.mutate(t.id)} disabled={create.isPending}>
                    <Sparkles className="mr-1 h-4 w-4" /> Создать документ
                  </Button>
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
              </div>
            ))}
            {!templates.isLoading && !(templates.data ?? []).length && (
              <p className="col-span-full rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                Шаблонов нет. Нажмите «Установить встроенные шаблоны» — появятся письма, приказы, доверенности и справки.
              </p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
