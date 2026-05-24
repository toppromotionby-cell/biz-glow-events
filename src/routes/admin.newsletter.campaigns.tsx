// Админка: список и создание массовых email-кампаний.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listCampaigns, saveCampaign, deleteCampaign, startCampaign } from "@/lib/campaigns.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Megaphone, Plus, Trash2, ArrowLeft, Send } from "lucide-react";
import { toast } from "sonner";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTable } from "@/components/admin/AdminTable";
import { Field } from "@/components/admin/Field";
import { StatusPill, type PillTone } from "@/components/admin/StatusPill";

const STATUS_TONE: Record<string, PillTone> = {
  completed: "success",
  sending: "info",
  failed: "danger",
  draft: "muted",
};

const TABLE_COLS = [
  { key: "subject", label: "Тема" },
  { key: "status", label: "Статус" },
  { key: "recipients", label: "Получатели" },
  { key: "sent", label: "Отправлено" },
  { key: "date", label: "Дата" },
  { key: "actions", label: "", className: "w-12" },
];

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
  const start = useServerFn(startCampaign);

  const { data = [], isLoading } = useQuery({
    queryKey: ["admin-campaigns"],
    queryFn: () => list(),
  });

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [mode, setMode] = useState<"confirmed_subscribers" | "all_subscribers" | "manual">("all_subscribers");
  const [emails, setEmails] = useState("");

  const drafts = (data as any[]).filter((c) => c.status === "draft");

  const resetForm = () => {
    setEditingId(null); setSubject(""); setBody(""); setEmails(""); setMode("all_subscribers");
  };

  const buildPayload = () => {
    const recipient_filter: any = { mode };
    if (mode === "manual") {
      recipient_filter.emails = emails.split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean);
    }
    return { id: editingId ?? undefined, subject, html_content: body, recipient_filter };
  };

  const saveDraft = useMutation({
    mutationFn: async () => save({ data: buildPayload() }),
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ["admin-campaigns"] });
      if (r?.id) setEditingId(r.id);
      toast.success("Черновик сохранён");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-campaigns"] }); toast.success("Удалена"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const launch = useMutation({
    mutationFn: (id: string) => start({ data: { id } }),
    onSuccess: (r: any) => {
      toast.success(`Запущена отправка: ${r.total} получателей${r.suppressed ? `, ${r.suppressed} в чёрном списке` : ""}`);
      qc.invalidateQueries({ queryKey: ["admin-campaigns"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveAndSend = useMutation({
    mutationFn: async () => {
      if (!subject.trim()) throw new Error("Укажите тему письма");
      if (!body.trim()) throw new Error("Добавьте содержимое письма");
      const r: any = await save({ data: buildPayload() });
      if (!confirm(`Отправить кампанию «${subject}»? Получатели вычисляются в момент запуска.`)) {
        throw new Error("__cancelled__");
      }
      const sent: any = await start({ data: { id: r.id } });
      return { ...sent, id: r.id };
    },
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ["admin-campaigns"] });
      toast.success(`Отправка запущена: ${r.total} получателей`);
      setShowForm(false); resetForm();
    },
    onError: (e: Error) => { if (e.message !== "__cancelled__") toast.error(e.message); },
  });

  const loadDraft = (id: string) => {
    const c = drafts.find((d: any) => d.id === id);
    if (!c) return;
    setEditingId(c.id);
    setSubject(c.subject ?? "");
    setBody(c.html_content ?? "");
    const f = c.recipient_filter ?? {};
    setMode((f.mode as any) ?? "all_subscribers");
    setEmails(Array.isArray(f.emails) ? f.emails.join(", ") : "");
    setShowForm(true);
  };

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link to="/admin/newsletter" className="text-xs text-muted-foreground hover:underline flex items-center gap-1 mb-1">
            <ArrowLeft className="h-3 w-3" /> К подписчикам
          </Link>
          <h1 className="admin-h1 flex items-center gap-2">
            <Megaphone className="h-7 w-7" /> Email-кампании
          </h1>
          <p className="text-sm text-muted-foreground">Массовые рассылки для пиара портала</p>
        </div>
        <Button onClick={() => { if (showForm) { setShowForm(false); resetForm(); } else { setShowForm(true); } }}>
          <Plus className="h-4 w-4 mr-2" />{showForm ? "Отмена" : "Новая кампания"}
        </Button>
      </header>

      {showForm && (
        <div className="glass rounded-xl p-5 space-y-4">
          {drafts.length > 0 && (
            <div>
              <Label>Загрузить из черновиков ({drafts.length})</Label>
              <Select value={editingId ?? ""} onValueChange={loadDraft}>
                <SelectTrigger><SelectValue placeholder="Выбрать черновик…" /></SelectTrigger>
                <SelectContent>
                  {drafts.map((d: any) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.subject || "(без темы)"} — {new Date(d.created_at).toLocaleDateString("ru-RU")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {editingId && (
                <button type="button" onClick={resetForm} className="text-xs text-muted-foreground hover:underline mt-1">
                  Сбросить и создать новый
                </button>
              )}
            </div>
          )}
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
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => saveDraft.mutate()} disabled={saveDraft.isPending}>
              {saveDraft.isPending ? "Сохранение…" : editingId ? "Обновить черновик" : "Сохранить черновик"}
            </Button>
            <Button onClick={() => saveAndSend.mutate()} disabled={saveAndSend.isPending}>
              <Send className="h-4 w-4 mr-2" />
              {saveAndSend.isPending ? "Отправка…" : "Отправить"}
            </Button>
          </div>
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
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          onClick={() => { if (confirm(`Отправить кампанию «${c.subject}»? Получатели вычисляются в момент запуска.`)) launch.mutate(c.id); }}
                          disabled={launch.isPending}
                        >
                          <Send className="h-4 w-4 mr-1" />Отправить
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => { if (confirm("Удалить черновик?")) remove.mutate(c.id); }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
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
