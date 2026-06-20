// Админка блога: список + кнопка редактирования. Логика редактора — в @/components/admin/blog/BlogEditor.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Plus, Trash2, ExternalLink } from "lucide-react";
import { SortableList } from "@/components/admin/SortableList";
import { persistSortOrder } from "@/lib/sort-order";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { StatusPill } from "@/components/admin/StatusPill";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import { BlogEditor } from "@/components/admin/blog/BlogEditor";
import type { BlogPostInput } from "@/lib/admin/schemas";

type Post = BlogPostInput & { id: string };

const EMPTY: BlogPostInput = {
  slug: "", title: "", excerpt: "", body: "", cover_url: "",
  tags: [], published: false, published_at: null, seo_title: "", seo_description: "",
};

export const Route = createFileRoute("/admin/blog")({ component: AdminBlogPage });

function AdminBlogPage() {
  const qc = useQueryClient();
  const { confirm, dialog } = useConfirm();
  const [editing, setEditing] = useState<Post | ({ id?: undefined } & BlogPostInput) | null>(null);

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
