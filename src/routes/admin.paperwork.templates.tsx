// Каталог шаблонов документов: фильтр по категории, создание документа из шаблона.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, LayoutTemplate, RefreshCw, Sparkles, Star, Trash2 } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import { adminKeys } from "@/lib/query-keys";
import { PW_CATEGORIES, PW_CATEGORY_LABELS } from "@/lib/paperwork/model";
import {
  createDocumentFromTemplate, deletePaperworkTemplate, installPaperworkPresets, listPaperworkTemplates,
} from "@/lib/paperwork.functions";

export const Route = createFileRoute("/admin/paperwork/templates")({
  head: () => ({ meta: [{ title: "Шаблоны документов — админка" }] }),
  component: Page,
});

function Page() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { confirm, dialog } = useConfirm();
  const [category, setCategory] = useState("all");
  const installed = useRef(false);

  const listTpl = useServerFn(listPaperworkTemplates);
  const createDoc = useServerFn(createDocumentFromTemplate);
  const delTpl = useServerFn(deletePaperworkTemplate);
  const installPresets = useServerFn(installPaperworkPresets);

  const templates = useQuery({
    queryKey: [...adminKeys.paperworkTemplates, category],
    queryFn: () => listTpl({ data: { category } }),
  });

  const install = useMutation({
    mutationFn: () => installPresets({}),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.paperworkTemplates }),
  });

  // Недостающие встроенные шаблоны доустанавливаются при открытии каталога.
  useEffect(() => {
    if (installed.current) return;
    installed.current = true;
    install.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshPresets = useMutation({
    mutationFn: () => installPresets({}),
    onSuccess: ({ added, names }) => {
      qc.invalidateQueries({ queryKey: adminKeys.paperworkTemplates });
      toast.success(added ? `Добавлено шаблонов: ${added} — ${names.join(", ")}` : "Все встроенные шаблоны уже установлены");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const create = useMutation({
    mutationFn: (templateId: string) => createDoc({ data: { templateId } }),
    onSuccess: ({ id }) => {
      qc.invalidateQueries({ queryKey: adminKeys.paperwork });
      navigate({ to: "/admin/paperwork/$id", params: { id } });
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

  return (
    <div className="space-y-5">
      {dialog}
      <Link to="/admin/paperwork" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ArrowLeft className="h-4 w-4" /> Все документы
      </Link>

      <AdminPageHeader
        icon={<LayoutTemplate className="h-5 w-5" />}
        title="Шаблоны документов"
        subtitle="Готовые заготовки: письма, приказы, доверенности, справки, кадровые и финансовые формы"
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refreshPresets.mutate()}
              disabled={refreshPresets.isPending || install.isPending}
            >
              <RefreshCw className={`mr-1 h-4 w-4 ${refreshPresets.isPending ? "animate-spin" : ""}`} />
              Обновить встроенные
            </Button>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все категории</SelectItem>
                {PW_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{PW_CATEGORY_LABELS[c]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {(templates.data ?? []).map((t) => (
          <div key={t.id} className="flex flex-col rounded-lg border border-border bg-card p-4">
            <div className="flex items-start gap-2">
              <LayoutTemplate className="mt-0.5 h-4 w-4 text-primary" />
              <div className="min-w-0">
                <h3 className="truncate font-medium">{t.name}</h3>
                <p className="text-xs text-muted-foreground">
                  {PW_CATEGORY_LABELS[t.category]}
                  {BUILTIN_NAMES.has(t.name.trim().toLowerCase()) && (
                    <span className="ml-2 rounded border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide">Встроенный</span>
                  )}
                </p>
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
        {!templates.isLoading && !install.isPending && !(templates.data ?? []).length && (
          <p className="col-span-full rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            В этой категории шаблонов нет.
          </p>
        )}
      </div>
    </div>
  );
}
