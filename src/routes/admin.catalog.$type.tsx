// Универсальный CRUD каталогов: zones | tech_equipment | services | production_items.
import { ADMIN_LIST_LIMIT } from "@/lib/admin/list-limit";
import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Eye, EyeOff, Plus, Search, Trash2, X } from "lucide-react";
import { persistSortOrder } from "@/lib/sort-order";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { CatalogTabs } from "@/components/admin/CatalogTabs";

import { AdminListPanel } from "@/components/admin/AdminListPanel";
import { AdminEmptyEditor } from "@/components/admin/AdminEditorShell";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  CATALOG_LABELS, isCatalogTable,
  type CatalogTable, type CatalogInsert, type CatalogUpdate,
} from "@/lib/admin/catalog-types";
import { CatalogEditor } from "@/components/admin/catalog/CatalogEditor";
import { CatalogListItem } from "@/components/admin/catalog/CatalogListItem";
import { AttractionsMediaBackfill } from "@/components/admin/catalog/AttractionsMediaBackfill";

import type { Row } from "@/components/admin/catalog/shared";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

// Поиск и открытая карточка живут в URL: ссылку можно переслать, F5 не сбрасывает работу.
export const Route = createFileRoute("/admin/catalog/$type")({
  validateSearch: (search: Record<string, unknown>): { q?: string | undefined; id?: string | undefined } => ({
    q: typeof search["q"] === "string" && search["q"] ? (search["q"] as string) : undefined,
    id: typeof search["id"] === "string" && search["id"] ? (search["id"] as string) : undefined,
  }),
  component: CatalogAdmin,
});

function CatalogAdmin() {
  const { type } = useParams({ from: "/admin/catalog/$type" });
  if (!isCatalogTable(type)) return <div>Неизвестный тип каталога</div>;
  return <CatalogInner table={type} />;
}

function CatalogInner({ table }: { table: CatalogTable }) {
  const qc = useQueryClient();
  const sp = Route.useSearch();
  const routeNavigate = Route.useNavigate();
  const patchSearch = (patch: { q?: string | undefined; id?: string | undefined }) =>
    void routeNavigate({ to: ".", search: (prev) => ({ ...prev, ...patch }), replace: true });

  const [selectedRow, setSelectedRow] = useState<Row | null>(null);
  const setSelected = (row: Row | null) => {
    setSelectedRow(row);
    patchSearch({ id: row?.id });
  };
  const [search, setSearch] = useState(sp.q ?? "");
  const debouncedSearch = useDebouncedValue(search, 300);
  useEffect(() => {
    if ((sp.q ?? "") === debouncedSearch) return;
    patchSearch({ q: debouncedSearch || undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkConfirm, setBulkConfirm] = useState(false);

  // Сбрасываем выделение и редактируемую запись при смене таблицы.
  useEffect(() => { setSelectedIds(new Set()); setSelectedRow(null); }, [table]);


  const { data: items = [], isLoading } = useQuery<Row[]>({
    queryKey: ["catalog", table],
    queryFn: async () => {
      const { data } = await supabase.from(table).select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false })
        .limit(ADMIN_LIST_LIMIT);
      return (data ?? []) as Row[];
    },
  });

  // После перезагрузки восстанавливаем открытую карточку из ?id=.
  const selected = selectedRow ?? (sp.id ? (items.find((i) => i.id === sp.id) ?? null) : null);


  const create = useMutation({
    mutationFn: async (): Promise<Row> => {
      const slug = `new-${Date.now()}`;
      const payload: CatalogInsert = { title: "Новая запись", slug, published: false };
      const { data, error } = await supabase.from(table).insert(payload).select().single();
      if (error) throw error;
      return data as Row;
    },
    onSuccess: (row) => { qc.invalidateQueries({ queryKey: ["catalog", table] }); setSelected(row); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["catalog", table] }); setSelected(null); toast.success("Удалено"); },
    onError: (e: Error) => toast.error(e.message),
  });

  // Дублирование карточки: создаём копию с уникальным slug.
  const duplicate = useMutation({
    mutationFn: async (src: Row): Promise<Row> => {
      const { id: _id, created_at: _c, updated_at: _u, slug, title, ...rest } = src;
      void _id; void _c; void _u;
      const newSlug = `${slug ?? "copy"}-${Date.now().toString(36).slice(-4)}`;
      const payload: CatalogInsert = {
        ...rest,
        slug: newSlug,
        title: `${title ?? "Без названия"} (копия)`,
        published: false,
      };
      const { data, error } = await supabase.from(table).insert(payload).select().single();
      if (error) throw error;
      return data as Row;
    },
    onSuccess: (row) => { qc.invalidateQueries({ queryKey: ["catalog", table] }); setSelected(row); toast.success("Карточка скопирована"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkPublish = useMutation({
    mutationFn: async (published: boolean) => {
      if (selectedIds.size === 0) return;
      const patch: CatalogUpdate = { published };
      const { error } = await supabase.from(table).update(patch).in("id", [...selectedIds]);
      if (error) throw error;
    },
    onSuccess: (_d, published) => {
      qc.invalidateQueries({ queryKey: ["catalog", table] });
      toast.success(`${selectedIds.size} ${published ? "опубликовано" : "снято с публикации"}`);
      setSelectedIds(new Set());
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkDelete = useMutation({
    mutationFn: async () => {
      if (selectedIds.size === 0) return;
      const { error } = await supabase.from(table).delete().in("id", [...selectedIds]);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["catalog", table] });
      toast.success(`Удалено: ${selectedIds.size}`);
      setSelectedIds(new Set());
      setSelected(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Локальный поиск по карточкам.
  const q = search.trim().toLowerCase();
  const filtered = q
    ? items.filter((it) => {
        const hay = [it.title, it.slug, it.category, it.description]
          .filter(Boolean).join(" ").toLowerCase();
        return hay.includes(q);
      })
    : items;

  const allVisibleSelected = filtered.length > 0 && filtered.every((it) => selectedIds.has(it.id));
  const toggleId = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    if (allVisibleSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map((it) => it.id)));
  };

  return (
    <div className="space-y-5">
      <CatalogTabs />
      <AdminPageHeader

        title={CATALOG_LABELS[table]}
        subtitle={`${items.length} ${pluralRecords(items.length)}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {table === "attractions" && <AttractionsMediaBackfill />}
            <Button onClick={() => create.mutate()} className="btn-primary-gradient"><Plus className="h-4 w-4 mr-2" />Добавить</Button>
          </div>
        }
      />


      {selectedIds.size > 0 && (
        <div className="glass rounded-xl p-3 flex flex-wrap items-center gap-2 sticky top-2 z-20 border border-primary/40">
          <span className="text-sm font-medium mr-2">Выбрано: {selectedIds.size}</span>
          <Button size="sm" variant="outline" onClick={() => bulkPublish.mutate(true)} disabled={bulkPublish.isPending}>
            <Eye className="h-4 w-4 mr-1" />Опубликовать
          </Button>
          <Button size="sm" variant="outline" onClick={() => bulkPublish.mutate(false)} disabled={bulkPublish.isPending}>
            <EyeOff className="h-4 w-4 mr-1" />Снять с публикации
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
            onClick={() => setBulkConfirm(true)}
          >
            <Trash2 className="h-4 w-4 mr-1" />Удалить
          </Button>
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSelectedIds(new Set())}>
            Снять выделение
          </Button>
        </div>
      )}

      <div className="grid lg:grid-cols-[320px_1fr] gap-5">
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по карточкам…"
              className="pl-9 pr-9"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Очистить"
                className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-6 w-6 items-center justify-center rounded hover:bg-muted/60"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {filtered.length > 0 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <Checkbox checked={allVisibleSelected} onCheckedChange={toggleAll} aria-label="Выбрать все" />
                <span>Выбрать все ({filtered.length})</span>
              </label>
              {q && <span>Найдено: {filtered.length} из {items.length}</span>}
            </div>
          )}
          {items.length >= ADMIN_LIST_LIMIT && (
            <p className="px-1 text-xs text-muted-foreground">
              Показаны первые {ADMIN_LIST_LIMIT} карточек — уточните поиск, чтобы найти остальные.
            </p>
          )}
          <AdminListPanel<Row>
            items={filtered}
            isLoading={isLoading}
            emptyText={q ? "Ничего не найдено" : "Пока нет карточек"}
            emptyAction={!q && (
              <Button size="sm" onClick={() => create.mutate()} className="btn-primary-gradient">
                <Plus className="h-4 w-4 mr-1" />Добавить первую
              </Button>
            )}
            onReorder={q ? undefined : async (ids) => {
              try { await persistSortOrder(table, ids); qc.invalidateQueries({ queryKey: ["catalog", table] }); }
              catch (e) { toast.error((e as Error).message); throw e; }
            }}
            renderItem={(it: Row, handle) => (
              <CatalogListItem
                item={it}
                handle={handle}
                active={selected?.id === it.id}
                checked={selectedIds.has(it.id)}
                onToggleCheck={() => toggleId(it.id)}
                onEdit={() => setSelected(it)}
                onDuplicate={() => duplicate.mutate(it)}
              />
            )}
          />
        </div>

        <div>
          {selected ? (
            <CatalogEditor
              key={selected.id}
              table={table}
              item={selected}
              onDelete={() => remove.mutate(selected.id)}
              onDuplicate={() => duplicate.mutate(selected)}
              onSaved={() => qc.invalidateQueries({ queryKey: ["catalog", table] })}
            />
          ) : (
            <AdminEmptyEditor
              title="Запись не выбрана"
              description="Кликните по карточке слева, чтобы начать редактирование. Изменения сохраняются автоматически."
              action={<Button onClick={() => create.mutate()} className="btn-primary-gradient"><Plus className="h-4 w-4 mr-1" />Создать карточку</Button>}
            />
          )}
        </div>
      </div>

      <AlertDialog open={bulkConfirm} onOpenChange={setBulkConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить {selectedIds.size} карточек?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие необратимо. Выбранные карточки будут удалены без возможности восстановления.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => bulkDelete.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function pluralRecords(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "запись";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "записи";
  return "записей";
}
