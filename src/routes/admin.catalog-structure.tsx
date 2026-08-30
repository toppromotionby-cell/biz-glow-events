// Справочник разделов и направлений каталога.
// Единый источник для мега-меню, страницы /catalog и фильтров внутри разделов.
// Поддерживает свои (виртуальные) разделы и автоочистку пустых направлений.
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminKeys } from "@/lib/query-keys";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CatalogTabs } from "@/components/admin/CatalogTabs";
import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import { AUTOSAVE_DELAY } from "@/lib/editor/save-state";
import { invalidateEntity } from "@/lib/admin/invalidate";

import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

import { Plus, Trash2, ArrowUp, ArrowDown, RefreshCw, ChevronDown, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import {
  getStructureOverview, updateSection, createVirtualSection, deleteVirtualSection,
  cleanupCatalogStructure, type StructureSection, type StructureCategory,
} from "@/lib/catalog-structure.functions";

export const Route = createFileRoute("/admin/catalog-structure")({
  component: CatalogStructurePage,
});

function CatalogStructurePage() {
  const qc = useQueryClient();
  const { confirm, dialog } = useConfirm();
  const [search, setSearch] = useState("");
  const [showHidden, setShowHidden] = useState(false);
  const cleanedRef = useRef(false);

  const overview = useQuery({
    queryKey: adminKeys.catalogStructure,
    queryFn: () => getStructureOverview(),
  });

  const invalidate = () => invalidateEntity(qc, "catalog-structure");


  const cleanup = useMutation({
    mutationFn: () => cleanupCatalogStructure(),
    onSuccess: (r) => {
      invalidate();
      const parts: string[] = [];
      if (r.removedCategories.length) parts.push(`удалено направлений: ${r.removedCategories.length}`);
      if (r.hiddenSections.length) parts.push(`скрыто разделов: ${r.hiddenSections.length}`);
      if (r.shownSections.length) parts.push(`возвращено разделов: ${r.shownSections.length}`);
      toast.success(parts.length ? `Синхронизация: ${parts.join(", ")}` : "Всё синхронизировано");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Автосинхронизация при открытии страницы (один раз за монтирование).
  useEffect(() => {
    if (cleanedRef.current) return;
    cleanedRef.current = true;
    cleanupCatalogStructure()
      .then(() => invalidate())
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveSection = useMutation({
    mutationFn: (input: Parameters<typeof updateSection>[0] extends never ? never : {
      key: string; title?: string; description?: string; visible?: boolean; categoryIds?: string[];
    }) => updateSection({ data: input }),
    onSuccess: () => { invalidate(); toast.success("Раздел сохранён"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeSection = useMutation({
    mutationFn: (key: string) => deleteVirtualSection({ data: { key } }),
    onSuccess: () => { invalidate(); toast.success("Раздел удалён"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveCategory = useMutation({
    mutationFn: async (row: { id: string } & Partial<StructureCategory>) => {
      const { id, count: _count, ...patch } = row;
      const { error } = await supabase.from("catalog_categories").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Направление сохранено"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const addCategory = useMutation({
    mutationFn: async (input: { entity_type: string; name: string; sort_order: number }) => {
      const { error } = await supabase.from("catalog_categories").insert(input);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Направление добавлено"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeCategory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("catalog_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Направление удалено"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const sections = overview.data?.sections ?? [];
  const categories = overview.data?.categories ?? [];

  const byType = useMemo(() => {
    const map = new Map<string, StructureCategory[]>();
    categories.forEach((c) => map.set(c.entity_type, [...(map.get(c.entity_type) ?? []), c]));
    return map;
  }, [categories]);

  const q = search.trim().toLowerCase();
  const matches = (s: StructureSection) =>
    !q ||
    s.title.toLowerCase().includes(q) ||
    (byType.get(s.key) ?? []).some((c) => c.name.toLowerCase().includes(q));

  const visibleSections = sections.filter((s) => s.visible && !s.auto_hidden).filter(matches);
  const hiddenSections = sections.filter((s) => !s.visible || s.auto_hidden).filter(matches);

  const renderCard = (section: StructureSection) => (
    <SectionCard
      key={section.key}
      section={section}
      categories={byType.get(section.key) ?? []}
      allCategories={categories}
      onSaveSection={(patch) => saveSection.mutate({ key: section.key, ...patch })}
      onSaveCategory={(id, patch) => saveCategory.mutate({ id, ...patch })}
      onAddCategory={(name) =>
        addCategory.mutate({
          entity_type: section.key,
          name,
          sort_order: ((byType.get(section.key) ?? []).at(-1)?.sort_order ?? 0) + 10,
        })
      }
      onRemoveCategory={async (cat) => {
        const ok = await confirm({
          title: "Удалить направление?",
          description: `«${cat.name}» исчезнет из меню и фильтров. Позиции каталога останутся.`,
          confirmText: "Удалить",
          destructive: true,
        });
        if (ok) removeCategory.mutate(cat.id);
      }}
      onRemoveSection={async () => {
        const ok = await confirm({
          title: "Удалить раздел?",
          description: `«${section.title}» исчезнет из меню и каталога. Позиции и направления останутся.`,
          confirmText: "Удалить",
          destructive: true,
        });
        if (ok) removeSection.mutate(section.key);
      }}
    />
  );

  return (
    <div className="space-y-6">
      <CatalogTabs />
      <div className="flex flex-wrap items-start justify-between gap-4">

        <div>
          <h1 className="text-2xl font-display font-bold">Структура каталога</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Всё, что здесь включено, автоматически появляется в меню сайта, на странице «Каталог» и в фильтрах раздела.
            Направления без позиций удаляются автоматически (новым даётся сутки на наполнение).
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => cleanup.mutate()} disabled={cleanup.isPending}>
            <RefreshCw className={`h-4 w-4 mr-1 ${cleanup.isPending ? "animate-spin" : ""}`} />
            Синхронизировать
          </Button>
          <CreateSectionDialog categories={categories} onCreated={invalidate} />
        </div>
      </div>

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Поиск по разделам и направлениям"
        className="max-w-sm"
      />

      {overview.isLoading && <p className="text-sm text-muted-foreground">Загрузка…</p>}

      {visibleSections.map(renderCard)}

      {hiddenSections.length > 0 && (
        <div className="border-t border-border/50 pt-4">
          <Button variant="ghost" size="sm" onClick={() => setShowHidden((v) => !v)}>
            <ChevronDown className={`h-4 w-4 mr-1 transition ${showHidden ? "rotate-180" : ""}`} />
            Скрытые ({hiddenSections.length})
          </Button>
          {showHidden && <div className="space-y-4 mt-4">{hiddenSections.map(renderCard)}</div>}
        </div>
      )}

      {dialog}
    </div>
  );
}

function CreateSectionDialog({
  categories,
  onCreated,
}: {
  categories: StructureCategory[];
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ids, setIds] = useState<string[]>([]);

  const create = useMutation({
    mutationFn: () =>
      createVirtualSection({ data: { title, description, icon: "Sparkles", categoryIds: ids } }),
    onSuccess: () => {
      toast.success("Раздел создан");
      setOpen(false); setTitle(""); setDescription(""); setIds([]);
      onCreated();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4 mr-1" />Создать раздел</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Свой раздел каталога</DialogTitle>
          <DialogDescription>
            Витрина из уже существующих направлений — например, «Новый год» или «Свадьбы».
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Название раздела" />
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Короткое описание" />
          <div className="max-h-64 overflow-y-auto rounded-md border border-border/50 p-2 space-y-1">
            {categories.length === 0 && <p className="text-sm text-muted-foreground">Направлений пока нет.</p>}
            {categories.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm py-1">
                <Checkbox
                  checked={ids.includes(c.id)}
                  onCheckedChange={(v) =>
                    setIds((prev) => (v ? [...prev, c.id] : prev.filter((x) => x !== c.id)))
                  }
                />
                <span className="flex-1">{c.name}</span>
                <span className="text-xs text-muted-foreground">{c.count}</span>
              </label>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => create.mutate()} disabled={title.trim().length < 2 || create.isPending}>
            Создать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SectionCard({
  section,
  categories,
  allCategories,
  onSaveSection,
  onSaveCategory,
  onAddCategory,
  onRemoveCategory,
  onRemoveSection,
}: {
  section: StructureSection;
  categories: StructureCategory[];
  allCategories: StructureCategory[];
  onSaveSection: (patch: { title?: string; description?: string; visible?: boolean; categoryIds?: string[] }) => void;
  onSaveCategory: (id: string, patch: Partial<StructureCategory>) => void;
  onAddCategory: (name: string) => void;
  onRemoveCategory: (cat: StructureCategory) => void;
  onRemoveSection: () => void;
}) {
  const [title, setTitle] = useState(section.title);
  const [description, setDescription] = useState(section.description ?? "");
  const [newName, setNewName] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const isVirtual = section.kind === "virtual";
  const storageKey = `catalog-structure:open:${section.key}`;

  useEffect(() => {
    if (typeof window === "undefined") return;
    setListOpen(window.localStorage.getItem(storageKey) === "1");
  }, [storageKey]);

  const toggleList = (v: boolean) => {
    setListOpen(v);
    if (typeof window !== "undefined") window.localStorage.setItem(storageKey, v ? "1" : "0");
  };

  // Автосохранение названия и описания раздела через 1.2 с после ввода.
  const autosave = useDebouncedCallback((t: string, d: string) => {
    if (t.trim() === section.title && d.trim() === (section.description ?? "")) return;
    onSaveSection({ title: t.trim(), description: d.trim() });
  }, AUTOSAVE_DELAY);

  const move = (index: number, dir: -1 | 1) => {

    const target = categories[index + dir];
    const current = categories[index];
    if (!target || !current) return;
    onSaveCategory(current.id, { sort_order: target.sort_order });
    onSaveCategory(target.id, { sort_order: current.sort_order });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle className="text-base flex flex-wrap items-center gap-2">
          {section.title}
          <Badge variant="secondary">{section.count} поз.</Badge>
          {isVirtual && <Badge variant="outline">свой раздел</Badge>}
          {section.auto_hidden && (
            <Badge variant="outline" className="text-muted-foreground">
              <EyeOff className="h-3 w-3 mr-1" />скрыт: нет позиций
            </Badge>
          )}
        </CardTitle>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Показывать
            <Switch checked={section.visible} onCheckedChange={(v) => onSaveSection({ visible: v })} />
          </label>
          {isVirtual && (
            <Button variant="ghost" size="icon" onClick={onRemoveSection} aria-label="Удалить раздел">
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            value={title}
            onChange={(e) => { setTitle(e.target.value); autosave(e.target.value, description); }}
            placeholder="Название раздела"
          />
          <Input
            value={description}
            onChange={(e) => { setDescription(e.target.value); autosave(title, e.target.value); }}
            placeholder="Короткое описание"
          />
        </div>
        <p className="text-xs text-muted-foreground">Правки сохраняются автоматически.</p>


        <Collapsible open={listOpen} onOpenChange={toggleList} className="border-t border-border/50 pt-4">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-1 py-1.5 text-sm font-medium transition-colors hover:bg-muted/50"
            >
              <ChevronDown className={`h-4 w-4 transition-transform ${listOpen ? "" : "-rotate-90"}`} />
              {isVirtual ? "Что входит в раздел" : "Направления"}
              <span className="text-xs font-normal text-muted-foreground">
                · {isVirtual ? section.category_ids.length : categories.length}
              </span>
            </button>
          </CollapsibleTrigger>

          <CollapsibleContent className="space-y-2 pt-2">
            {isVirtual ? (
              <div className="max-h-64 overflow-y-auto rounded-md border border-border/50 p-2 space-y-1">
                {allCategories.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm py-1">
                    <Checkbox
                      checked={section.category_ids.includes(c.id)}
                      onCheckedChange={(v) =>
                        onSaveSection({
                          categoryIds: v
                            ? [...section.category_ids, c.id]
                            : section.category_ids.filter((x) => x !== c.id),
                        })
                      }
                    />
                    <span className="flex-1">{c.name}</span>
                    <span className="text-xs text-muted-foreground">{c.count}</span>
                  </label>
                ))}
              </div>
            ) : (
              <>
                {categories.length === 0 && (
                  <p className="text-sm text-muted-foreground">Пока нет направлений.</p>
                )}
                {categories.map((cat, i) => (
                  <CategoryRowEditor
                    key={cat.id}
                    cat={cat}
                    onSave={(patch) => onSaveCategory(cat.id, patch)}
                    onRemove={() => onRemoveCategory(cat)}
                    onUp={i > 0 ? () => move(i, -1) : undefined}
                    onDown={i < categories.length - 1 ? () => move(i, 1) : undefined}
                  />
                ))}

                <div className="flex gap-2 pt-2">
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Новое направление"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newName.trim()) {
                        onAddCategory(newName.trim());
                        setNewName("");
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    onClick={() => { if (newName.trim()) { onAddCategory(newName.trim()); setNewName(""); } }}
                    disabled={!newName.trim()}
                  >
                    <Plus className="h-4 w-4 mr-1" />Добавить
                  </Button>
                </div>
              </>
            )}
          </CollapsibleContent>
        </Collapsible>

      </CardContent>
    </Card>
  );
}

function CategoryRowEditor({
  cat,
  onSave,
  onRemove,
  onUp,
  onDown,
}: {
  cat: StructureCategory;
  onSave: (patch: Partial<StructureCategory>) => void;
  onRemove: () => void;
  onUp?: () => void;
  onDown?: () => void;
}) {
  const [name, setName] = useState(cat.name);
  const [description, setDescription] = useState(cat.description ?? "");

  // Автосохранение направления — без отдельной кнопки «Сохранить».
  const autosave = useDebouncedCallback((n: string, d: string) => {
    if (n.trim() === cat.name && d.trim() === (cat.description ?? "")) return;
    if (!n.trim()) return;
    onSave({ name: n.trim(), description: d.trim() });
  }, AUTOSAVE_DELAY);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-border/50 p-2">
      <Input
        className="w-48"
        value={name}
        onChange={(e) => { setName(e.target.value); autosave(e.target.value, description); }}
      />
      <Input
        className="flex-1 min-w-[12rem]"
        value={description}
        onChange={(e) => { setDescription(e.target.value); autosave(name, e.target.value); }}
        placeholder="Описание (необязательно)"
      />
      <Badge variant={cat.count > 0 ? "secondary" : "outline"}>{cat.count}</Badge>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        Видно
        <Switch checked={cat.visible} onCheckedChange={(v) => onSave({ visible: v })} />
      </label>

      <Button size="icon" variant="ghost" onClick={onUp} disabled={!onUp} aria-label="Выше">
        <ArrowUp className="h-4 w-4" />
      </Button>
      <Button size="icon" variant="ghost" onClick={onDown} disabled={!onDown} aria-label="Ниже">
        <ArrowDown className="h-4 w-4" />
      </Button>
      <Button size="icon" variant="ghost" onClick={onRemove} aria-label="Удалить">
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}
