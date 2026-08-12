// Админка кейсов: список, создание, редактирование, публикация, featured.
import { ADMIN_LIST_LIMIT } from "@/lib/admin/list-limit";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { UniversalMediaUploader } from "@/components/UniversalMediaUploader";
import { toast } from "sonner";
import { Plus, Search, Star, Sparkles, X } from "lucide-react";
import { persistSortOrder } from "@/lib/sort-order";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminListPanel } from "@/components/admin/AdminListPanel";
import { AdminEditorShell, AdminEmptyEditor } from "@/components/admin/AdminEditorShell";
import { Field } from "@/components/admin/Field";
import { StatusPill } from "@/components/admin/StatusPill";
import { caseSchema } from "@/lib/admin/schemas";
import { useAutoSaveDraft, readDraft, clearDraft } from "@/lib/admin/use-autosave-draft";
import { useUnsavedGuard } from "@/hooks/use-unsaved-guard";
import { useEditorHotkeys } from "@/lib/admin/use-editor-hotkeys";
import { generateSeoDescription } from "@/lib/admin/seo";
import { useListUrlState, matchesQuery } from "@/hooks/use-list-url-state";
import { adminKeys } from "@/lib/query-keys";
import type { SaveState } from "@/components/admin/SaveStatus";

// Поиск и выбранный кейс живут в URL — F5 и «назад» не сбрасывают работу.
export const Route = createFileRoute("/admin/cases")({
  validateSearch: (search: Record<string, unknown>): { q?: string | undefined; id?: string | undefined } => ({
    q: typeof search["q"] === "string" && search["q"] ? (search["q"] as string) : undefined,
    id: typeof search["id"] === "string" && search["id"] ? (search["id"] as string) : undefined,
  }),
  component: CasesAdmin,
});

import type { Database } from "@/integrations/supabase/types";
type CaseRow = Database["public"]["Tables"]["cases"]["Row"];

function CasesAdmin() {
  const qc = useQueryClient();
  const sp = Route.useSearch();
  const routeNavigate = Route.useNavigate();
  const patchSearch = (p: { q?: string | undefined; id?: string | undefined }) =>
    void routeNavigate({ to: ".", search: (prev) => ({ ...prev, ...p }), replace: true });
  const { query, setQuery, debouncedQuery, selectedId, selectId } = useListUrlState(sp, patchSearch);

  const { data: items = [], isLoading } = useQuery({
    queryKey: adminKeys.cases,
    queryFn: async () => (await supabase.from("cases").select("*").order("sort_order", { ascending: true }).order("event_date", { ascending: false, nullsFirst: false }).limit(ADMIN_LIST_LIMIT)).data ?? [],
  });

  const visible = useMemo(
    () => (items as CaseRow[]).filter((it) => matchesQuery(debouncedQuery, it.title, it.slug, it.client)),
    [items, debouncedQuery],
  );
  const selected = (items as CaseRow[]).find((it) => it.id === selectedId) ?? null;

  const create = useMutation({
    mutationFn: async () => {
      const slug = `case-${Date.now()}`;
      const { data, error } = await supabase.from("cases")
        .insert({ title: "Новый кейс", slug, published: false })
        .select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (row) => { qc.invalidateQueries({ queryKey: adminKeys.cases }); selectId(row.id); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cases").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: adminKeys.cases }); selectId(null); toast.success("Удалено"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Кейсы"
        subtitle={debouncedQuery ? `${visible.length} из ${items.length} записей` : `${items.length} записей`}
        action={<Button onClick={() => create.mutate()} className="btn-primary-gradient"><Plus className="h-4 w-4 mr-2" />Добавить</Button>}
      />

      <div className="grid lg:grid-cols-[320px_1fr] gap-5">
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по кейсам…"
              aria-label="Поиск по кейсам"
              className="pl-8 pr-8"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Очистить поиск"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <AdminListPanel
            items={visible}
            isLoading={isLoading}
            emptyText={debouncedQuery ? "Ничего не найдено" : "Нет кейсов"}
            // Перетаскивание доступно только без фильтра: иначе порядок сохранится неверно.
            {...(debouncedQuery
              ? {}
              : {
                  onReorder: async (ids: string[]) => {
                    try { await persistSortOrder("cases", ids); qc.invalidateQueries({ queryKey: adminKeys.cases }); }
                    catch (e) { toast.error((e as Error).message); throw e; }
                  },
                })}
            renderItem={(it, handle) => (
              <div className={`flex items-center gap-1 rounded-lg ${selected?.id === it.id ? "bg-gradient-primary text-primary-foreground" : "hover:bg-muted/40"}`}>
                {handle}
                <button onClick={() => selectId(it.id)} className="flex-1 text-left p-3 text-sm min-w-0">
                  <div className="font-medium truncate flex items-center gap-1.5">
                    {it.featured && <Star className="h-3 w-3 fill-current shrink-0" />}
                    <span className="truncate">{it.title}</span>
                  </div>
                  <div className="text-xs opacity-70 flex items-center gap-2">
                    <span>{it.event_date ?? "—"}</span>
                    <StatusPill tone={it.published ? "success" : "muted"}>
                      {it.published ? "опубликовано" : "черновик"}
                    </StatusPill>
                  </div>
                </button>
              </div>
            )}
          />
        </div>

        <div>
          {selected ? (
            <Editor key={selected.id} item={selected}
              onDelete={() => remove.mutate(selected.id)}
              onSaved={() => qc.invalidateQueries({ queryKey: adminKeys.cases })}
            />
          ) : (
            <AdminEmptyEditor
              title="Кейс не выбран"
              description="Выберите кейс из списка слева для редактирования или создайте новый."
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Editor({ item, onSaved, onDelete }: { item: CaseRow; onSaved: () => void; onDelete: () => void }) {
  const draftKey = `cases:${item.id}`;

  const [form, setForm] = useState<CaseRow>(() => {
    const draft = readDraft<CaseRow>(draftKey);
    return draft ? { ...item, ...draft } : { ...item };
  });
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [servicesInput, setServicesInput] = useState((item.services_used ?? []).join(", "));
  const [metricsInput, setMetricsInput] = useState(JSON.stringify(item.metrics ?? {}, null, 2));
  const [metricsError, setMetricsError] = useState<string | null>(null);

  // Живая валидация
  const validation = useMemo(() => {
    const result = caseSchema.safeParse({
      title: form.title ?? "",
      slug: form.slug ?? "",
      client: form.client ?? "",
      event_type: form.event_type ?? "",
      event_date: form.event_date ?? null,
      location: form.location ?? "",
      guests_count: form.guests_count == null ? null : Number(form.guests_count),
      summary: form.summary ?? "",
      description: form.description ?? "",
      cover_url: form.cover_url ?? "",
      seo_title: form.seo_title ?? "",
      seo_description: form.seo_description ?? "",
      published: !!form.published,
      featured: !!form.featured,
    });
    if (result.success) return { ok: true as const, errors: {} as Record<string, string> };
    const errors: Record<string, string> = {};
    for (const issue of result.error.issues) errors[issue.path.join(".")] = issue.message;
    return { ok: false as const, errors };
  }, [form]);

  // JSON-валидация метрик в реальном времени
  useEffect(() => {
    try { JSON.parse(metricsInput || "{}"); setMetricsError(null); }
    catch { setMetricsError("Невалидный JSON"); }
  }, [metricsInput]);

  // Автосохранение черновика
  const { savedAt: draftSavedAt } = useAutoSaveDraft(draftKey, { form, servicesInput, metricsInput });
  const { guardDialog } = useUnsavedGuard(!!draftSavedAt && saveState !== "saved" && !saving);

  const save = async () => {
    if (!validation.ok) { toast.error("Исправьте ошибки в форме"); setSaveState("error"); setErrorMessage("Невалидные поля"); return; }
    if (metricsError) { toast.error("Метрики: невалидный JSON"); setSaveState("error"); setErrorMessage(metricsError); return; }
    setSaving(true); setSaveState("saving"); setErrorMessage(null);
    const metrics = JSON.parse(metricsInput || "{}") as Database["public"]["Tables"]["cases"]["Update"]["metrics"];
    const services_used = servicesInput.split(",").map((s: string) => s.trim()).filter(Boolean);
    const patch: Database["public"]["Tables"]["cases"]["Update"] = {
      title: form.title, slug: form.slug, client: form.client, event_type: form.event_type,
      event_date: form.event_date || null, location: form.location,
      guests_count: form.guests_count ? Number(form.guests_count) : null,
      summary: form.summary, description: form.description,
      cover_url: form.cover_url ?? (form.photo_urls?.[0] ?? null),
      photo_urls: form.photo_urls ?? [], video_urls: form.video_urls ?? [],
      services_used, metrics,
      seo_title: form.seo_title, seo_description: form.seo_description,
      published: !!form.published, featured: !!form.featured,
    };
    const { error } = await supabase.from("cases").update(patch).eq("id", item.id);
    setSaving(false);
    if (error) {
      // Дубль slug и прочие ошибки БД показываем прямо у поля.
      const mapped = mapServerError(error);
      if (mapped.field) setServerErrors((prev) => ({ ...prev, [mapped.field as string]: mapped.message }));
      setSaveState("error");
      setErrorMessage(mapped.message);
      return toast.error(mapped.message);
    }
    setServerErrors({});
    clearDraft(draftKey);
    setSaveState("saved");
    toast.success("Сохранено");
    onSaved();
  };

  useEditorHotkeys({ onSave: save });

  const errors: FieldErrors = { ...validation.errors, ...serverErrors };

  const fillSeoDesc = () => {
    const value = generateSeoDescription(form.summary, form.description);
    if (value) setForm({ ...form, seo_description: value });
  };

  return (
    <>
    {guardDialog}
    <AdminEditorShell
      switches={
        <>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={!!form.published} onCheckedChange={(v) => setForm({ ...form, published: v })} />
            {form.published ? "Опубликовано" : "Черновик"}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={!!form.featured} onCheckedChange={(v) => setForm({ ...form, featured: v })} />
            <Star className="h-3.5 w-3.5" /> На главную
          </label>
        </>
      }
      onDelete={onDelete}
      onSave={save}
      saving={saving}
      saveState={saveState === "idle" && draftSavedAt ? "dirty" : saveState}
      draftSavedAt={draftSavedAt}
      errorMessage={errorMessage}
      saveDisabled={!validation.ok || !!metricsError}
    >
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Заголовок" required error={errors["title"]} counter={{ value: (form.title ?? "").length, max: 200 }}>
          <Input value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </Field>
        <Field label="Slug" required error={errors["slug"]} tooltip="Только латиница, цифры и дефис. Используется в URL.">
          <Input value={form.slug ?? ""} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
        </Field>
        <Field label="Клиент" error={errors["client"]}><Input value={form.client ?? ""} onChange={(e) => setForm({ ...form, client: e.target.value })} /></Field>
        <Field label="Тип события" error={errors["event_type"]}><Input value={form.event_type ?? ""} onChange={(e) => setForm({ ...form, event_type: e.target.value })} placeholder="Корпоратив / Конференция / Фестиваль" /></Field>
        <Field label="Дата"><Input type="date" value={form.event_date ?? ""} onChange={(e) => setForm({ ...form, event_date: e.target.value })} /></Field>
        <Field label="Локация" error={errors["location"]}><Input value={form.location ?? ""} onChange={(e) => setForm({ ...form, location: e.target.value })} /></Field>
        <Field label="Число гостей" error={errors["guests_count"]}><Input type="number" value={form.guests_count ?? ""} onChange={(e) => setForm({ ...form, guests_count: e.target.value ? Number(e.target.value) : null })} /></Field>
        <Field label="URL обложки (опц.)" hint="Иначе берём первое фото"><Input value={form.cover_url ?? ""} onChange={(e) => setForm({ ...form, cover_url: e.target.value })} /></Field>
      </div>

      <Field label="Краткое описание" error={errors["summary"]} counter={{ value: (form.summary ?? "").length, max: 500 }}>
        <Textarea rows={2} value={form.summary ?? ""} onChange={(e) => setForm({ ...form, summary: e.target.value })} />
      </Field>
      <Field label="Полное описание">
        <Textarea rows={6} value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </Field>

      <Field label="Услуги (через запятую)" hint="Будут сохранены как массив тегов">
        <Input value={servicesInput} onChange={(e) => setServicesInput(e.target.value)} placeholder="Сцена и свет, VR-арена, LED-экран" />
      </Field>
      <Field
        label="Метрики (JSON)"
        tooltip='Объект ключ-значение, например {"гостей": 500, "часов": 8}'
        error={metricsError}
      >
        <Textarea rows={4} value={metricsInput} onChange={(e) => setMetricsInput(e.target.value)} className="font-mono text-xs" />
      </Field>

      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="SEO title" error={errors["seo_title"]} counter={{ value: (form.seo_title ?? "").length, max: 60 }}>
          <Input value={form.seo_title ?? ""} onChange={(e) => setForm({ ...form, seo_title: e.target.value })} />
        </Field>
        <Field
          label="SEO description"
          error={errors["seo_description"]}
          counter={{ value: (form.seo_description ?? "").length, max: 160 }}
          hint={
            <button type="button" onClick={fillSeoDesc} className="inline-flex items-center gap-1 text-primary hover:underline">
              <Sparkles className="h-3 w-3" /> Сгенерировать из описания
            </button>
          }
        >
          <Input value={form.seo_description ?? ""} onChange={(e) => setForm({ ...form, seo_description: e.target.value })} />
        </Field>
      </div>

      <div>
        <Label className="mb-2 block">Медиа</Label>
        <UniversalMediaUploader
          entity="cases"
          slug={form.slug || item.id}
          photoUrls={form.photo_urls ?? []}
          videoUrls={form.video_urls ?? []}
          onChange={({ photoUrls, videoUrls }) => setForm({ ...form, photo_urls: photoUrls, video_urls: videoUrls })}
        />
      </div>
    </AdminEditorShell>
    </>
  );
}
