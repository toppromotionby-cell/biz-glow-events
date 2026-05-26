// Список email-кампаний: создать, редактировать, удалить, посмотреть отчёт.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  listCampaigns,
  deleteCampaign,
} from "@/lib/campaigns.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Loader2, Mail, Plus, Pencil, Trash2, BarChart3 } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTable } from "@/components/admin/AdminTable";

const STATUS_LABEL: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  draft: { label: "Черновик", variant: "outline" },
  sending: { label: "Отправка…", variant: "secondary" },
  sent: { label: "Отправлено", variant: "default" },
  failed: { label: "Ошибка", variant: "destructive" },
};

const COLS = [
  { key: "name", label: "Кампания" },
  { key: "status", label: "Статус" },
  { key: "stats", label: "Получатели" },
  { key: "date", label: "Создана" },
  { key: "actions", label: "", className: "w-48 text-right" },
];

export const Route = createFileRoute("/admin/campaigns")({
  head: () => ({ meta: [{ title: "Email-рассылки — Админ" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: CampaignsListPage,
});

function CampaignsListPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fetchList = useServerFn(listCampaigns);
  const deleteFn = useServerFn(deleteCampaign);

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ["admin", "campaigns"],
    queryFn: () => fetchList(),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { toast.success("Кампания удалена"); qc.invalidateQueries({ queryKey: ["admin", "campaigns"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Email-рассылки"
        subtitle="Маркетинговые письма по подтверждённым пользователям и ручному списку."
        icon={
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl btn-primary-gradient">
            <Mail className="h-5 w-5 text-primary-foreground" />
          </span>
        }
        action={
          <Button onClick={() => navigate({ to: "/admin/campaigns/new" })} className="btn-primary-gradient">
            <Plus className="h-4 w-4 mr-1" /> Новая кампания
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Загрузка…</div>
      ) : (
        <AdminTable
          columns={COLS}
          isEmpty={campaigns.length === 0}
          emptyText="Пока нет ни одной кампании"
        >
          {campaigns.map((c) => {
            const s = STATUS_LABEL[c.status] ?? { label: c.status, variant: "outline" as const };
            return (
              <tr key={c.id} className="border-t border-border/40 align-top">
                <td className="px-4 py-3">
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 truncate max-w-md">{c.subject}</div>
                </td>
                <td className="px-4 py-3"><Badge variant={s.variant}>{s.label}</Badge></td>
                <td className="px-4 py-3 text-sm">
                  {c.status === "draft" ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <span>
                      {c.sent_count} / {c.total_recipients}
                      {c.failed_count > 0 && <span className="text-destructive ml-1">(−{c.failed_count})</span>}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {new Date(c.created_at).toLocaleString("ru-BY")}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex gap-1">
                    {c.status !== "draft" && (
                      <Button asChild size="icon" variant="ghost" title="Отчёт">
                        <Link to="/admin/campaigns/$id/report" params={{ id: c.id }}>
                          <BarChart3 className="h-4 w-4" />
                        </Link>
                      </Button>
                    )}
                    {(c.status === "draft" || c.status === "failed") && (
                      <Button asChild size="icon" variant="ghost" title="Редактировать">
                        <Link to="/admin/campaigns/$id" params={{ id: c.id }}>
                          <Pencil className="h-4 w-4" />
                        </Link>
                      </Button>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" title="Удалить">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Удалить кампанию?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Кампания «{c.name}» и список её получателей будут удалены безвозвратно.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Отмена</AlertDialogCancel>
                          <AlertDialogAction onClick={() => del.mutate(c.id)}>Удалить</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </td>
              </tr>
            );
          })}
        </AdminTable>
      )}
    </div>
  );
}
