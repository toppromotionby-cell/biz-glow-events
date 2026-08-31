// Обсуждения клуба: темы, категории, комментарии.
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, MessageSquare, Pin, Plus } from "lucide-react";
import { MemberGate } from "@/components/dj/MemberGate";
import { CommentsDialog } from "@/components/dj/CommentsDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { djCreateThread, djListThreads } from "@/lib/dj/dj.functions";
import { THREAD_CATEGORIES } from "@/lib/dj/types";

const ALL = "__all__";

export const Route = createFileRoute("/dj/community")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Обсуждения клуба — DJ Hub event-hub.by" },
      { name: "description", content: "Темы диджеев: ищу трек, оборудование и софт, площадки и заказы, идеи по сервису." },
      { property: "og:title", content: "Обсуждения DJ Hub" },
      { property: "og:description", content: "Комьюнити event-диджеев: вопросы, находки и обмен опытом." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <MemberGate><CommunityPage /></MemberGate>,
});

function CommunityPage() {
  const [category, setCategory] = useState<string>(ALL);
  const [openThread, setOpenThread] = useState<{ id: string; title: string } | null>(null);
  const params = { category: category === ALL ? undefined : category };

  const { data = [], isLoading } = useQuery({
    queryKey: ["dj", "threads", params],
    queryFn: () => djListThreads({ data: params }),
    placeholderData: (prev) => prev,
  });

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold gradient-text">Обсуждения</h1>
          <p className="mt-1 text-sm text-muted-foreground">Вопросы, находки и обмен опытом внутри клуба.</p>
        </div>
        <NewThreadDialog />
      </header>

      <div className="mb-4 flex flex-wrap gap-2">
        <Button size="sm" variant={category === ALL ? "default" : "outline"} onClick={() => setCategory(ALL)}>Все</Button>
        {THREAD_CATEGORIES.map((c) => (
          <Button key={c.value} size="sm" variant={category === c.value ? "default" : "outline"} onClick={() => setCategory(c.value)}>
            {c.label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : data.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center text-muted-foreground">Пока нет тем — начните первым.</div>
      ) : (
        <ul className="space-y-3">
          {data.map((t) => (
            <li key={t.id} className="glass rounded-2xl p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="flex items-center gap-2 font-medium">
                    {t.pinned && <Pin className="h-3.5 w-3.5 text-primary" />}
                    <span className="truncate">{t.title}</span>
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t.author_name} · {new Date(t.created_at).toLocaleDateString("ru-RU")}
                  </p>
                </div>
                <Badge variant="secondary" className="shrink-0 font-normal">
                  {THREAD_CATEGORIES.find((c) => c.value === t.category)?.label ?? t.category}
                </Badge>
              </div>
              {t.body && <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{t.body}</p>}
              <Button className="mt-3" size="sm" variant="outline" onClick={() => setOpenThread({ id: t.id, title: t.title })}>
                <MessageSquare className="mr-2 h-4 w-4" /> Ответы ({t.replies})
              </Button>
            </li>
          ))}
        </ul>
      )}

      {openThread && (
        <CommentsDialog
          open
          onOpenChange={(o) => !o && setOpenThread(null)}
          targetType="thread"
          targetId={openThread.id}
          title={openThread.title}
        />
      )}
    </div>
  );
}

function NewThreadDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", body: "", category: "general" });

  const create = useMutation({
    mutationFn: () => djCreateThread({ data: form }),
    onSuccess: () => {
      toast.success("Тема создана");
      setOpen(false);
      setForm({ title: "", body: "", category: "general" });
      void qc.invalidateQueries({ queryKey: ["dj", "threads"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-2 h-4 w-4" /> Новая тема</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Новая тема</DialogTitle>
          <DialogDescription>Опишите вопрос — участники клуба ответят в комментариях.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="th-title">Заголовок *</Label>
            <Input id="th-title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} maxLength={160} />
          </div>
          <div className="space-y-1.5">
            <Label>Категория</Label>
            <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {THREAD_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="th-body">Текст</Label>
            <Textarea id="th-body" rows={5} value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} maxLength={8000} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Отмена</Button>
          <Button disabled={form.title.trim().length < 3 || create.isPending} onClick={() => create.mutate()}>
            {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Создать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
