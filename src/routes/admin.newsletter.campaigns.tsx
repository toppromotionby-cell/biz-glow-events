// Админка: список и создание массовых email-кампаний.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listCampaigns, saveCampaign, deleteCampaign } from "@/lib/campaigns.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Megaphone, Plus, Trash2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/newsletter/campaigns")({ component: Page });

const STATUS_LABELS: Record<string, string> = {
  draft: "Черновик",
  sending: "Отправляется",
  completed: "Завершена",
  failed: "Ошибка",
};

function Page() {
  const qc = useQueryClient();
  const list = useServerFn(listCampaigns);
  const save = useServerFn(saveCampaign);
  const del = useServerFn(deleteCampaign);

  const { data = [], isLoading } = useQuery({
    queryKey: ["admin-campaigns"],
    queryFn: () => list(),
  });

  const [showForm, setShowForm] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [mode, setMode] = useState<"confirmed_subscribers" | "all_subscribers" | "manual">("all_subscribers");
  const [emails, setEmails] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      const recipient_filter: any = { mode };
      if (mode === "manual") {
        recipient_filter.emails = emails.split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean);
      }
      return save({ data: { subject, html_content: body, recipient_filter } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-campaigns"] });
      toast.success("Черновик создан");
      setShowForm(false); setSubject(""); setBody(""); setEmails("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-campaigns"] }); toast.success("Удалена"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link to="/admin/newsletter" className="text-xs text-muted-foreground hover:underline flex items-center gap-1 mb-1">
            <ArrowLeft className="h-3 w-3" /> К подписчикам
          </Link>
          <h1 className="text-3xl font-display font-bold gradient-text flex items-center gap-2">
            <Megaphone className="h-7 w-7" /> Email-кампании
          </h1>
          <p className="text-sm text-muted-foreground">Массовые рассылки для пиара портала</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4 mr-2" />{showForm ? "Отмена" : "Новая кампания"}
        </Button>
      </header>

      {showForm && (
        <div className="glass rounded-xl p-5 space-y-4">
          <div>
            <Label>Тема письма</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Открылся портал event-hub.by — приглашаем!" />
          </div>
          <div>
            <Label>Получатели</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="confirmed_subscribers">Подтверждённые подписчики</SelectItem>
                <SelectItem value="all_subscribers">Все подписчики</SelectItem>
                <SelectItem value="manual">Ручной список email</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {mode === "manual" && (
            <div>
              <Label>Email-адреса (через запятую, пробел или с новой строки)</Label>
              <Textarea rows={4} value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="info@example.com, partner@company.by" />
            </div>
          )}
          <div>
            <Label>HTML-контент письма</Label>
            <Textarea rows={12} value={body} onChange={(e) => setBody(e.target.value)} placeholder="<h2>Заголовок</h2><p>Здравствуйте! Рады представить...</p>" className="font-mono text-xs" />
            <p className="text-xs text-muted-foreground mt-1">Контент будет вставлен в фирменный шаблон с шапкой и подвалом.</p>
          </div>
          <Button onClick={() => create.mutate()} disabled={!subject || !body || create.isPending}>
            {create.isPending ? "Сохранение..." : "Сохранить черновик"}
          </Button>
        </div>
      )}

      <div className="glass rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Загрузка...</div>
        ) : data.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">Пока нет кампаний.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-left">
              <tr>
                <th className="p-3 font-medium">Тема</th>
                <th className="p-3 font-medium">Статус</th>
                <th className="p-3 font-medium">Получатели</th>
                <th className="p-3 font-medium">Отправлено</th>
                <th className="p-3 font-medium">Дата</th>
                <th className="p-3 font-medium w-12"></th>
              </tr>
            </thead>
            <tbody>
              {data.map((c: any) => (
                <tr key={c.id} className="border-t border-border/40">
                  <td className="p-3">
                    <Link to="/admin/newsletter/campaigns/$id" params={{ id: c.id }} className="hover:underline font-medium">
                      {c.subject}
                    </Link>
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      c.status === "completed" ? "bg-green-500/20 text-green-700" :
                      c.status === "sending" ? "bg-blue-500/20 text-blue-700" :
                      c.status === "failed" ? "bg-red-500/20 text-red-700" :
                      "bg-muted text-muted-foreground"
                    }`}>{STATUS_LABELS[c.status] ?? c.status}</span>
                  </td>
                  <td className="p-3 text-muted-foreground">{c.total_recipients}</td>
                  <td className="p-3 text-muted-foreground">
                    {c.sent_count} / {c.failed_count > 0 ? <span className="text-red-600">{c.failed_count} ошибок</span> : "0 ошибок"}
                  </td>
                  <td className="p-3 text-muted-foreground">{new Date(c.created_at).toLocaleDateString("ru-RU")}</td>
                  <td className="p-3">
                    {c.status === "draft" && (
                      <Button variant="ghost" size="sm" onClick={() => { if (confirm("Удалить черновик?")) remove.mutate(c.id); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
