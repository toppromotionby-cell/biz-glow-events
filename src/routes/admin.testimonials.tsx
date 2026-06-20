// Админка отзывов: список + редактор.
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Star } from "lucide-react";
import { persistSortOrder } from "@/lib/sort-order";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminListPanel } from "@/components/admin/AdminListPanel";
import { AdminEditorShell, AdminEmptyEditor } from "@/components/admin/AdminEditorShell";
import { Field } from "@/components/admin/Field";
import { StatusPill } from "@/components/admin/StatusPill";
import { testimonialSchema } from "@/lib/admin/schemas";
import { useAutoSaveDraft, readDraft, clearDraft } from "@/lib/admin/use-autosave-draft";
import { useEditorHotkeys } from "@/lib/admin/use-editor-hotkeys";
import type { SaveState } from "@/components/admin/SaveStatus";

export const Route = createFileRoute("/admin/testimonials")({ component: Page });

import type { Database } from "@/integrations/supabase/types";
type Row = Database["public"]["Tables"]["testimonials"]["Row"];

function Page() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Row | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["admin-testimonials"],
    queryFn: async () => (await supabase.from("testimonials").select("*").order("sort_order").order("created_at", { ascending: false })).data ?? [],
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from("testimonials")
        .insert({ client_name: "Новый клиент", text: "Отличная работа!", rating: 5, published: false })
        .select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (row) => { qc.invalidateQueries({ queryKey: ["admin-testimonials"] }); setSelected(row); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("testimonials").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-testimonials"] }); setSelected(null); toast.success("Удалено"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Отзывы"
        subtitle={`${items.length} записей`}
        action={<Button onClick={() => create.mutate()} className="btn-primary-gradient"><Plus className="h-4 w-4 mr-2" />Добавить</Button>}
      />

      <div className="grid lg:grid-cols-[320px_1fr] gap-5">
        <AdminListPanel
          items={items as Row[]}
          isLoading={isLoading}
          onReorder={async (ids) => {
            try { await persistSortOrder("testimonials", ids); qc.invalidateQueries({ queryKey: ["admin-testimonials"] }); }
            catch (e) { toast.error((e as Error).message); throw e; }
          }}
          renderItem={(it, handle) => (
            <div className={`flex items-center gap-1 rounded-lg ${selected?.id === it.id ? "bg-gradient-primary text-primary-foreground" : "hover:bg-muted/40"}`}>
              {handle}
              <button onClick={() => setSelected(it)} className="flex-1 text-left p-3 text-sm min-w-0">
                <div className="font-medium truncate flex items-center gap-1.5">
                  {it.featured && <Star className="h-3 w-3 fill-current shrink-0" />}
                  <span className="truncate">{it.client_name}</span>
                </div>
                <div className="text-xs opacity-70 flex items-center gap-2">
                  <span>{"★".repeat(it.rating)}</span>
                  <StatusPill tone={it.published ? "success" : "muted"}>
                    {it.published ? "опубликовано" : "черновик"}
                  </StatusPill>
                </div>
              </button>
            </div>
          )}
        />

        {selected ? (
          <Editor key={selected.id} row={selected} onDelete={() => remove.mutate(selected.id)} />
        ) : (
          <AdminEmptyEditor
            title="Отзыв не выбран"
            description="Выберите отзыв из списка слева, чтобы отредактировать его, или создайте новый."
          />)}
      </div>
    </div>
  );
}

function Editor({ row, onDelete }: { row: Row; onDelete: () => void }) {
  const qc = useQueryClient();
  const draftKey = `testimonials:${row.id}`;
  const [f, setF] = useState<Row>(() => {
    const draft = readDraft<Row>(draftKey);
    return draft ? { ...row, ...draft } : row;
  });
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const validation = useMemo(() => {
    const r = testimonialSchema.safeParse({
      client_name: f.client_name ?? "",
      client_company: f.client_company ?? "",
      client_role: f.client_role ?? "",
      client_photo_url: f.client_photo_url ?? "",
      rating: Number(f.rating) || 5,
      text: f.text ?? "",
      event_date: f.event_date ?? null,
      published: !!f.published,
      featured: !!f.featured,
      sort_order: Number(f.sort_order) || 0,
    });
    if (r.success) return { ok: true as const, errors: {} as Record<string, string> };
    const errors: Record<string, string> = {};
    for (const issue of r.error.issues) errors[issue.path.join(".")] = issue.message;
    return { ok: false as const, errors };
  }, [f]);

  const { savedAt: draftSavedAt } = useAutoSaveDraft(draftKey, f);

  const save = useMutation({
    mutationFn: async () => {
      if (!validation.ok) throw new Error("Исправьте ошибки в форме");
      const patch = {
        client_name: f.client_name,
        client_company: f.client_company || null,
        client_role: f.client_role || null,
        client_photo_url: f.client_photo_url || null,
        rating: Number(f.rating) || 5,
        text: f.text,
        event_date: f.event_date || null,
        published: !!f.published,
        featured: !!f.featured,
        sort_order: Number(f.sort_order) || 0,
      };
      const { error } = await supabase.from("testimonials").update(patch).eq("id", row.id);
      if (error) throw error;
    },
    onMutate: () => { setSaveState("saving"); setErrorMessage(null); },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-testimonials"] });
      clearDraft(draftKey);
      setSaveState("saved");
      toast.success("Сохранено");
    },
    onError: (e: Error) => { setSaveState("error"); setErrorMessage(e.message); toast.error(e.message); },
  });

  useEditorHotkeys({ onSave: () => save.mutate() });
  const errors = validation.errors;

  return (
    <AdminEditorShell
      title={f.client_name || "Без имени"}
      switches={
        <>
          <label className="flex items-center gap-2 text-sm"><Switch checked={!!f.published} onCheckedChange={(v) => setF({ ...f, published: v })} /> Опубликовано</label>
          <label className="flex items-center gap-2 text-sm"><Switch checked={!!f.featured} onCheckedChange={(v) => setF({ ...f, featured: v })} /> Featured</label>
        </>
      }
      onDelete={onDelete}
      onSave={() => save.mutate()}
      saving={save.isPending}
      saveState={saveState === "idle" && draftSavedAt ? "dirty" : saveState}
      draftSavedAt={draftSavedAt}
      errorMessage={errorMessage}
      saveDisabled={!validation.ok}
    >
      <div className="grid md:grid-cols-2 gap-4">
        <Field label="Имя клиента" required error={errors["client_name"]} counter={{ value: (f.client_name ?? "").length, max: 120 }}>
          <Input value={f.client_name ?? ""} onChange={(e) => setF({ ...f, client_name: e.target.value })} />
        </Field>
        <Field label="Компания" error={errors["client_company"]}><Input value={f.client_company ?? ""} onChange={(e) => setF({ ...f, client_company: e.target.value })} /></Field>
        <Field label="Должность" error={errors["client_role"]}><Input value={f.client_role ?? ""} onChange={(e) => setF({ ...f, client_role: e.target.value })} /></Field>
        <Field label="URL фото" error={errors["client_photo_url"]}><Input value={f.client_photo_url ?? ""} onChange={(e) => setF({ ...f, client_photo_url: e.target.value })} /></Field>
        <Field label="Оценка (1–5)" error={errors["rating"]}><Input type="number" min={1} max={5} value={f.rating ?? 5} onChange={(e) => setF({ ...f, rating: Number(e.target.value) })} /></Field>
        <Field label="Дата мероприятия"><Input type="date" value={f.event_date ?? ""} onChange={(e) => setF({ ...f, event_date: e.target.value })} /></Field>
        <Field label="Порядок сортировки" tooltip="Меньше — выше в списке"><Input type="number" value={f.sort_order ?? 0} onChange={(e) => setF({ ...f, sort_order: Number(e.target.value) })} /></Field>
      </div>

      <Field label="Текст отзыва" required error={errors["text"]} counter={{ value: (f.text ?? "").length, max: 2000 }}>
        <Textarea rows={6} value={f.text ?? ""} onChange={(e) => setF({ ...f, text: e.target.value })} />
      </Field>
    </AdminEditorShell>
  );
}
