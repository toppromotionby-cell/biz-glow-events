// Редактор записи блога: RHF + Zod, slug-уникальность, автосохранение,
// горячая клавиша Cmd/Ctrl+S, индикатор статуса сохранения.
import { useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Check, Loader2, X } from "lucide-react";
import { Field } from "@/components/admin/Field";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import { blogPostSchema, type BlogPostInput } from "@/lib/admin/schemas";
import { useSlugUnique } from "@/lib/admin/use-slug-unique";
import { useAutoSaveDraft, readDraft, clearDraft } from "@/lib/admin/use-autosave-draft";
import { useUnsavedGuard } from "@/hooks/use-unsaved-guard";
import { SaveStatus } from "@/components/admin/SaveStatus";
import { slugify, cn } from "@/lib/utils";

type EditorProps = {
  initial: BlogPostInput & { id?: string };
  onClose: () => void;
  onSaved: () => void;
};

export function BlogEditor({ initial, onClose, onSaved }: EditorProps) {
  const draftKey = `blog:${initial.id ?? "new"}`;
  const { confirm, dialog } = useConfirm();

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

  const { register, control, handleSubmit, watch, setValue, setError, formState } = form;
  const values = watch();
  const slugValue = values.slug;
  const titleValue = values.title;

  const [slugTouched, setSlugTouched] = useState(!!initial.slug);
  useEffect(() => {
    if (!slugTouched && titleValue) {
      const next = slugify(titleValue).slice(0, 80);
      if (next !== slugValue) setValue("slug", next, { shouldValidate: true });
    }
  }, [titleValue, slugTouched, slugValue, setValue]);

  const slugStatus = useSlugUnique("blog_posts", slugValue, initial.id);

  const { savedAt } = useAutoSaveDraft(draftKey, values, { enabled: formState.isDirty });
  const { guardDialog } = useUnsavedGuard(formState.isDirty && !formState.isSubmitting);

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
    onError: (e: unknown) => {
      // Ошибку БД (например, занятый slug) отдаём в конкретное поле формы.
      const mapped = mapServerError(e);
      if (mapped.field && mapped.field in (initialValues as Record<string, unknown>)) {
        setError(mapped.field as keyof BlogPostInput, { type: "server", message: mapped.message });
      }
      toast.error(mapped.message);
    },

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
          state={
            save.isError ? "error" : save.isPending ? "saving" : formState.isDirty ? "dirty" : savedAt ? "saved" : "idle"
          }
          draftSavedAt={savedAt}
          errorMessage={save.error instanceof Error ? save.error.message : null}
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
      {guardDialog}
    </form>
  );
}

function SlugHintLine({ status }: { status: ReturnType<typeof useSlugUnique> }) {
  if (status === "checking") return <span className="inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />Проверка…</span>;
  if (status === "ok") return <span className="inline-flex items-center gap-1 text-emerald-500"><Check className="h-3 w-3" />Свободен</span>;
  if (status === "taken") return <span className="inline-flex items-center gap-1 text-destructive"><X className="h-3 w-3" />Занят</span>;
  if (status === "error") return <span className="text-muted-foreground">Не удалось проверить</span>;
  return <span className="text-muted-foreground">URL: /blog/&lt;slug&gt;</span>;
}
