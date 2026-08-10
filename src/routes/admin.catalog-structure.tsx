// Справочник разделов и направлений каталога.
// Единый источник для мега-меню, страницы /catalog и фильтров внутри разделов.
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/admin/ConfirmDialog";

export const Route = createFileRoute("/admin/catalog-structure")({
  component: CatalogStructurePage,
});

type SectionRow = {
  key: string;
  title: string;
  description: string;
  icon: string;
  sort_order: number;
  visible: boolean;
};

type CategoryRow = {
  id: string;
  entity_type: string;
  name: string;
  description: string;
  sort_order: number;
  visible: boolean;
};

function CatalogStructurePage() {
  const qc = useQueryClient();
  const { confirm, dialog } = useConfirm();

  const sectionsQuery = useQuery({
    queryKey: ["admin", "catalog-sections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("catalog_sections")
        .select("key,title,description,icon,sort_order,visible")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as SectionRow[];
    },
  });

  const categoriesQuery = useQuery({
    queryKey: ["admin", "catalog-categories-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("catalog_categories")
        .select("id,entity_type,name,description,sort_order,visible")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CategoryRow[];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin", "catalog-sections"] });
    qc.invalidateQueries({ queryKey: ["admin", "catalog-categories-all"] });
    qc.invalidateQueries({ queryKey: ["catalog-nav"] });
  };

  const saveSection = useMutation({
    mutationFn: async (row: Partial<SectionRow> & { key: string }) => {
      const { key, ...patch } = row;
      const { error } = await supabase.from("catalog_sections").update(patch).eq("key", key);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Раздел сохранён"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveCategory = useMutation({
    mutationFn: async (row: Partial<CategoryRow> & { id: string }) => {
      const { id, ...patch } = row;
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

  const byType = useMemo(() => {
    const map = new Map<string, CategoryRow[]>();
    (categoriesQuery.data ?? []).forEach((c) => {
      map.set(c.entity_type, [...(map.get(c.entity_type) ?? []), c]);
    });
    return map;
  }, [categoriesQuery.data]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Разделы и направления</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Всё, что здесь включено, автоматически появляется в меню сайта, на странице «Каталог» и в фильтрах раздела.
        </p>
      </div>

      {sectionsQuery.isLoading && <p className="text-sm text-muted-foreground">Загрузка…</p>}

      {(sectionsQuery.data ?? []).map((section) => (
        <SectionCard
          key={section.key}
          section={section}
          categories={byType.get(section.key) ?? []}
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
        />
      ))}
      {dialog}
    </div>
  );
}

function SectionCard({
  section,
  categories,
  onSaveSection,
  onSaveCategory,
  onAddCategory,
  onRemoveCategory,
}: {
  section: SectionRow;
  categories: CategoryRow[];
  onSaveSection: (patch: Partial<SectionRow>) => void;
  onSaveCategory: (id: string, patch: Partial<CategoryRow>) => void;
  onAddCategory: (name: string) => void;
  onRemoveCategory: (cat: CategoryRow) => void;
}) {
  const [title, setTitle] = useState(section.title);
  const [description, setDescription] = useState(section.description ?? "");
  const [newName, setNewName] = useState("");

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
        <CardTitle className="text-base">{section.title}</CardTitle>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          Показывать
          <Switch
            checked={section.visible}
            onCheckedChange={(v) => onSaveSection({ visible: v })}
          />
        </label>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Название раздела" />
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Короткое описание" />
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onSaveSection({ title: title.trim(), description: description.trim() })}
          disabled={title.trim() === section.title && description.trim() === (section.description ?? "")}
        >
          Сохранить раздел
        </Button>

        <div className="border-t border-border/50 pt-4 space-y-2">
          <div className="text-sm font-medium">Направления</div>
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
        </div>
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
  cat: CategoryRow;
  onSave: (patch: Partial<CategoryRow>) => void;
  onRemove: () => void;
  onUp?: () => void;
  onDown?: () => void;
}) {
  const [name, setName] = useState(cat.name);
  const [description, setDescription] = useState(cat.description ?? "");

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-border/50 p-2">
      <Input className="w-48" value={name} onChange={(e) => setName(e.target.value)} />
      <Input
        className="flex-1 min-w-40"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Описание (необязательно)"
      />
      <Button
        size="sm"
        variant="outline"
        disabled={name.trim() === cat.name && description.trim() === (cat.description ?? "")}
        onClick={() => onSave({ name: name.trim(), description: description.trim() })}
      >
        Сохранить
      </Button>
      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        В меню
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
