// Админка блога: RHF + Zod, useQuery/useMutation, проверка уникальности slug,
// автосохранение черновика в localStorage, AlertDialog для удаления.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Trash2, ExternalLink, Check, X, Loader2 } from "lucide-react";
import { SortableList } from "@/components/admin/SortableList";
import { persistSortOrder } from "@/lib/sort-order";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Field } from "@/components/admin/Field";
import { StatusPill } from "@/components/admin/StatusPill";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import { blogPostSchema, type BlogPostInput } from "@/lib/admin/schemas";
import { useSlugUnique } from "@/lib/admin/use-slug-unique";
import { useAutoSaveDraft, readDraft, clearDraft } from "@/lib/admin/use-autosave-draft";
import { slugify } from "@/lib/utils";
import { cn } from "@/lib/utils";

type Post = BlogPostInput & { id: string };

const EMPTY: BlogPostInput = {
  slug: "", title: "", excerpt: "", body: "", cover_url: "",
  tags: [], published: false, published_at: null, seo_title: "", seo_description: "",
};

export const Route = createFileRoute("/admin/blog")({ component: AdminBlogPage });

function AdminBlogPage() {
  const qc = useQueryClient();
  const { confirm, dialog } = useConfirm();
  const [editing, setEditing] = useState<Post | { id?: undefined } & BlogPostInput | null>(null);

  const { data: posts = [] } = useQuery({
    queryKey: ["admin-blog"],
    queryFn: async () => {
      const { data, error } = await supabase.from("blog_posts").select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Post[];
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("blog_posts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-blog"] }); toast.success("Удалено"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const onDelete = async (p: Post) => {
    const ok = await confirm({
      title: "Удалить запись?",
      description: `«${p.title}» будет удалена без возможности восстановления.`,
      confirmText: "Удалить",
      destructive: true,
    });
    if (ok) remove.mutate(p.id);
  };

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Блог"
        subtitle={`${posts.length} записей`}
        action={
          <Button onClick={() => setEditing({ ...EMPTY })}>
            <Plus className="h-4 w-4 mr-1" />Новая запись
          </Button>
        }
      />

      {editing && (
        <BlogEditor
          key={editing.id ?? "new"}
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { qc.invalidateQueries({ queryKey: ["admin-blog"] }); setEditing(null); }}
        />
      )}

      <div className="glass rounded-xl">
        {posts.length === 0 && (
          <div className="p-8 text-center space-y-3">
            <p className="text-sm text-muted-foreground">Пока нет записей</p>
            <Button size="sm" onClick={() => setEditing({ ...EMPTY })}>
              <Plus className="h-4 w-4 mr-1" />Создать первую
            </Button>
          </div>
        )}
        <SortableList
          items={posts}
          onReorder={async (ids) => {
            try {
              await persistSortOrder("blog_posts", ids);
              qc.invalidateQueries({ queryKey: ["admin-blog"] });
            } catch (e) { toast.error((e as Error).message); throw e; }
          }}
          className="divide-y divide-border/40"
          renderItem={(p, handle) => (
            <div className="p-4 flex items-center justify-between gap-3">
              {handle}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{p.title}</span>
                  <StatusPill tone={p.published ? "success" : "muted"}>
                    {p.published ? "опубликовано" : "черновик"}
                  </StatusPill>
                </div>
                <div className="text-xs text-muted-foreground truncate">/{p.slug}</div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {p.published && (
                  <Button asChild variant="ghost" size="icon" aria-label="Открыть на сайте">
                    <Link to="/blog/$slug" params={{ slug: p.slug }} target="_blank">
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => setEditing(p)}>Изменить</Button>
                <Button variant="ghost" size="icon" onClick={() => onDelete(p)} aria-label="Удалить">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          )}
        />
      </div>

      {dialog}
    </div>
  );
}

type EditorProps = {
  initial: BlogPostInput & { id?: string };
  onClose: () => void;
  onSaved: () => void;
};

function BlogEditor({ initial, onClose, onSaved }: EditorProps) {
  const draftKey = `blog:${initial.id ?? "new"}`;
  const { confirm, dialog } = useConfirm();

  // Восстановление черновика из localStorage.
  const initialValues = useMemo(() => {
    const draft = readDraft<BlogPostInput>(draftKey);
    return draft ? { ...initial, ...draft } : initial;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [draftRestored, setDraftRestored] = useState(() => readDraft<BlogPostInput>(draftKey) != null);

  const form = useForm<BlogPostInput>({
    resolver: zodResolver(blogPostSchema),
    defaultValues: initialValues,
    mode: "onBlur",
  });

  const { register, control, handleSubmit, watch, setValue, formState, getValues } = form;
  const values = watch();
  const slugValue = values.slug;
  const titleValue = values.title;

  // Авто-генерация slug, пока пользователь его не редактировал вручную.
  const [slugTouched, setSlugTouched] = useState(!!initial.slug);
  useEffect(() => {
    if (!slugTouched && titleValue) {
      const next = slugify(titleValue).slice(0, 80);
      if (next !== slugValue) setValue("slug", next, { shouldValidate: true });
    }
  }, [titleValue, slugTouched, slugValue, setValue]);

  // Проверка уникальности.
  const slugStatus = useSlugUnique("blog_posts", slugValue, initial.id);

  // Автосохранение.
  const { savedAt } = useAutoSaveDraft(draftKey, values, { enabled: formState.isDirty });

  const save = useMutation({
    mutationFn: async (data: BlogPostInput) => {
      if (slugStatus === "taken") throw new Error("Slug уже используется");
      const payload = {
        slug: data.slug,
        title: data.title,
        excerpt: data.excerpt || null,
        body: data.body || null,
        cover_url: data.cover_url || null,
        tags: data.tags ?? [],
        published: data.published,
        published_at: data.published && !data.published_at ? new Date().toISOString() : data.published_at ?? null,
        seo_title: data.seo_title || null,
        seo_description: data.seo_description || null,
      };
      const { error } = initial.id
        ? await supabase.from("blog_posts").update(payload).eq("id", initial.id)
        : await supabase.from("blog_posts").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      clearDraft(draftKey);
      toast.success("Сохранено");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const tryClose = async () => {
    if (formState.isDirty) {
      const ok = await confirm({
        title: "Закрыть без сохранения?",
        description: "Черновик останется в браузере, его можно будет восстановить.",
        confirmText: "Закрыть",
      });
      if (!ok) return;
    }
    onClose();
  };

  // Hotkey: Cmd/Ctrl+S.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!save.isPending) handleSubmit((d) => save.mutate(d))();
      }
      if (e.key === "Escape") tryClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [save.isPending, handleSubmit]);

  const tagsString = (values.tags ?? []).join(", ");

  return (
    <form
      onSubmit={handleSubmit((d) => save.mutate(d))}
      className="glass rounded-xl p-5 space-y-4"
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="font-display font-semibold">
          {initial.id ? "Редактировать" : "Новая запись"}
        </h2>
        <SaveStatus
          isDirty={formState.isDirty}
          isSaving={save.isPending}
          isError={save.isError}
          savedAt={savedAt}
        />
      </div>

      {draftRestored && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          <span>Восстановлен черновик из браузера.</span>
          <button
            type="button"
            className="text-xs underline"
            onClick={() => {
              clearDraft(draftKey);
              setDraftRestored(false);
              form.reset(initial);
            }}
          >
            Сбросить
          </button>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-3">
        <Field
          label="Заголовок"
          required
          error={formState.errors.title?.message}
          counter={{ value: titleValue?.length ?? 0, max: 200 }}
        >
          <Input {...register("title")} />
        </Field>
        <Field
          label="Slug"
          required
          tooltip="Часть URL после /blog/. Только латиница, цифры и дефис. До 80 символов."
          error={formState.errors.slug?.message ?? (slugStatus === "taken" ? "Slug уже используется" : undefined)}
          hint={<SlugHintLine status={slugStatus} />}
          counter={{ value: slugValue?.length ?? 0, max: 80 }}
        >
          <Input
            {...register("slug", { onChange: () => setSlugTouched(true) })}
            value={slugValue}
            onChange={(e) => {
              setSlugTouched(true);
              setValue("slug", slugify(e.target.value).slice(0, 80), { shouldValidate: true, shouldDirty: true });
            }}
          />
        </Field>
      </div>

      <Field
        label="Excerpt (короткое описание)"
        tooltip="Используется в превью статьи и в OpenGraph-описании по умолчанию."
        error={formState.errors.excerpt?.message}
        counter={{ value: values.excerpt?.length ?? 0, max: 500 }}
      >
        <Textarea rows={2} {...register("excerpt")} />
      </Field>

      <Field label="Текст статьи" hint="Поддерживается Markdown.">
        <Textarea rows={10} {...register("body")} />
      </Field>

      <div className="grid md:grid-cols-2 gap-3">
        <Field
          label="Обложка (URL)"
          tooltip="Полный URL изображения. Используется как cover и og:image."
          error={formState.errors.cover_url?.message}
        >
          <Input {...register("cover_url")} placeholder="https://…" />
        </Field>
        <Field label="Теги (через запятую)">
          <Input
            value={tagsString}
            onChange={(e) =>
              setValue(
                "tags",
                e.target.value.split(",").map((t) => t.trim()).filter(Boolean),
                { shouldDirty: true },
              )
            }
          />
        </Field>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <Field
          label="SEO title"
          tooltip="Если пусто, используется заголовок."
          error={formState.errors.seo_title?.message}
          counter={{ value: values.seo_title?.length ?? 0, max: 60 }}
        >
          <Input {...register("seo_title")} />
        </Field>
        <Field
          label="SEO description"
          tooltip="Если пусто, используется excerpt. Рекомендуется 120-160 символов."
          error={formState.errors.seo_description?.message}
          counter={{ value: values.seo_description?.length ?? 0, max: 160 }}
        >
          <Input {...register("seo_description")} />
        </Field>
      </div>

      <div className="flex items-center gap-2">
        <Controller
          control={control}
          name="published"
          render={({ field }) => (
            <Switch checked={field.value} onCheckedChange={field.onChange} />
          )}
        />
        <Label>Опубликована</Label>
      </div>

      <div className="sticky bottom-0 -mx-5 -mb-5 px-5 py-3 mt-2 bg-background/95 backdrop-blur border-t border-border/40 flex items-center justify-end gap-2 rounded-b-xl">
        <Button type="button" variant="ghost" onClick={tryClose}>Отмена</Button>
        <Button
          type="submit"
          disabled={save.isPending || slugStatus === "checking" || slugStatus === "taken" || !formState.isValid}
        >
          {save.isPending ? (<><Loader2 className="h-4 w-4 mr-1 animate-spin" />Сохраняю…</>) : "Сохранить"}
        </Button>
      </div>

      {/* Скрытый запасной триггер для submit на старых браузерах */}
      <button type="submit" className="hidden" aria-hidden tabIndex={-1}>submit</button>

      {dialog}
    </form>
  );
}

function FormDebugBlocker({ disabled }: { disabled: boolean }) {
  // Перехватываем закрытие вкладки при наличии несохранённых изменений.
  useEffect(() => {
    if (disabled) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [disabled]);
  return null;
}

function SlugHintLine({ status }: { status: ReturnType<typeof useSlugUnique> }) {
  if (status === "checking") return <span className="inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />Проверка…</span>;
  if (status === "ok") return <span className="inline-flex items-center gap-1 text-emerald-500"><Check className="h-3 w-3" />Свободен</span>;
  if (status === "taken") return <span className="inline-flex items-center gap-1 text-destructive"><X className="h-3 w-3" />Занят</span>;
  if (status === "error") return <span className="text-muted-foreground">Не удалось проверить</span>;
  return <span className="text-muted-foreground">URL: /blog/&lt;slug&gt;</span>;
}

function SaveStatus({ isDirty, isSaving, isError, savedAt }:
  { isDirty: boolean; isSaving: boolean; isError: boolean; savedAt: Date | null }) {
  let label = "Без изменений";
  let cls = "text-muted-foreground";
  if (isError) { label = "Ошибка сохранения"; cls = "text-destructive"; }
  else if (isSaving) { label = "Сохраняю…"; cls = "text-muted-foreground"; }
  else if (isDirty) {
    label = savedAt
      ? `Черновик · ${savedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
      : "Не сохранено";
    cls = "text-amber-500";
  }
  return <span className={cn("text-xs", cls)}>{label}</span>;
}
