import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Trash2, ExternalLink } from "lucide-react";

type Post = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string | null;
  cover_url: string | null;
  tags: string[] | null;
  published: boolean;
  published_at: string | null;
  seo_title: string | null;
  seo_description: string | null;
};

const EMPTY: Omit<Post, "id"> = {
  slug: "", title: "", excerpt: "", body: "", cover_url: "",
  tags: [], published: false, published_at: null, seo_title: "", seo_description: "",
};

export const Route = createFileRoute("/admin/blog")({
  component: AdminBlogPage,
});

function slugify(s: string) {
  const map: Record<string, string> = {
    а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"yo",ж:"zh",з:"z",и:"i",й:"y",к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",
    р:"r",с:"s",т:"t",у:"u",ф:"f",х:"h",ц:"ts",ч:"ch",ш:"sh",щ:"sch",ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya",
  };
  return s.toLowerCase().split("").map((c) => map[c] ?? c).join("")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

function AdminBlogPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [editing, setEditing] = useState<Post | (Omit<Post, "id"> & { id?: string }) | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data } = await supabase.from("blog_posts").select("*").order("created_at", { ascending: false });
    setPosts((data ?? []) as Post[]);
  }
  useEffect(() => { load(); }, []);

  async function save() {
    if (!editing) return;
    if (!editing.title || !editing.slug) { toast.error("Заполните title и slug"); return; }
    setSaving(true);
    const payload = {
      slug: editing.slug,
      title: editing.title,
      excerpt: editing.excerpt || null,
      body: editing.body || null,
      cover_url: editing.cover_url || null,
      tags: editing.tags ?? [],
      published: editing.published,
      published_at: editing.published && !editing.published_at ? new Date().toISOString() : editing.published_at,
      seo_title: editing.seo_title || null,
      seo_description: editing.seo_description || null,
    };
    const { error } = editing.id
      ? await supabase.from("blog_posts").update(payload).eq("id", editing.id)
      : await supabase.from("blog_posts").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Сохранено");
    setEditing(null);
    load();
  }

  async function remove(id: string) {
    if (!confirm("Удалить запись?")) return;
    const { error } = await supabase.from("blog_posts").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Удалено");
    load();
  }

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-display font-bold gradient-text">Блог</h1>
          <p className="text-sm text-muted-foreground">Статьи и кейсы</p>
        </div>
        <Button onClick={() => setEditing({ ...EMPTY })}><Plus className="h-4 w-4 mr-1" />Новая запись</Button>
      </header>

      {editing && (
        <div className="glass rounded-xl p-5 space-y-4">
          <h2 className="font-display font-semibold">{editing.id ? "Редактировать" : "Новая запись"}</h2>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <Label>Заголовок</Label>
              <Input value={editing.title} onChange={(e) => {
                const title = e.target.value;
                setEditing((s) => s && ({ ...s, title, slug: s.slug || slugify(title) }));
              }} />
            </div>
            <div>
              <Label>Slug</Label>
              <Input value={editing.slug} onChange={(e) => setEditing((s) => s && ({ ...s, slug: slugify(e.target.value) }))} />
            </div>
          </div>
          <div>
            <Label>Excerpt (короткое описание)</Label>
            <Textarea rows={2} value={editing.excerpt ?? ""} onChange={(e) => setEditing((s) => s && ({ ...s, excerpt: e.target.value }))} />
          </div>
          <div>
            <Label>Текст статьи</Label>
            <Textarea rows={10} value={editing.body ?? ""} onChange={(e) => setEditing((s) => s && ({ ...s, body: e.target.value }))} />
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <Label>Обложка (URL)</Label>
              <Input value={editing.cover_url ?? ""} onChange={(e) => setEditing((s) => s && ({ ...s, cover_url: e.target.value }))} />
            </div>
            <div>
              <Label>Теги (через запятую)</Label>
              <Input
                value={(editing.tags ?? []).join(", ")}
                onChange={(e) => setEditing((s) => s && ({ ...s, tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) }))}
              />
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <Label>SEO title</Label>
              <Input value={editing.seo_title ?? ""} onChange={(e) => setEditing((s) => s && ({ ...s, seo_title: e.target.value }))} />
            </div>
            <div>
              <Label>SEO description</Label>
              <Input value={editing.seo_description ?? ""} onChange={(e) => setEditing((s) => s && ({ ...s, seo_description: e.target.value }))} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={editing.published} onCheckedChange={(v) => setEditing((s) => s && ({ ...s, published: v }))} />
            <Label>Опубликована</Label>
          </div>
          <div className="flex gap-2">
            <Button onClick={save} disabled={saving}>{saving ? "Сохраняю..." : "Сохранить"}</Button>
            <Button variant="ghost" onClick={() => setEditing(null)}>Отмена</Button>
          </div>
        </div>
      )}

      <div className="glass rounded-xl divide-y divide-border/40">
        {posts.length === 0 && <div className="p-6 text-sm text-muted-foreground text-center">Пока нет записей</div>}
        {posts.map((p) => (
          <div key={p.id} className="p-4 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium truncate">{p.title}</span>
                {p.published ? (
                  <span className="text-[10px] uppercase px-2 py-0.5 rounded-full border border-emerald-500/40 text-emerald-500">опубликовано</span>
                ) : (
                  <span className="text-[10px] uppercase px-2 py-0.5 rounded-full border border-border/50 text-muted-foreground">черновик</span>
                )}
              </div>
              <div className="text-xs text-muted-foreground truncate">/{p.slug}</div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {p.published && (
                <Button asChild variant="ghost" size="icon" aria-label="Открыть на сайте">
                  <Link to="/blog/$slug" params={{ slug: p.slug }} target="_blank"><ExternalLink className="h-4 w-4" /></Link>
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => setEditing(p)}>Изменить</Button>
              <Button variant="ghost" size="icon" onClick={() => remove(p.id)} aria-label="Удалить">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
