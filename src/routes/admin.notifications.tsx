// История уведомлений: единая панель для команды.
// Три вкладки:
//  • Письма — последние транзакционные/auth-email отправки (deduped по message_id).
//  • Действия — последние записи audit_log (фактические автосейвы/правки).
//  • Ошибки — недоставленные письма (dlq/failed/bounced) с описанием ошибки.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Mail, Activity, AlertTriangle, RefreshCw, Inbox } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtDateTime } from "@/lib/formatters";

export const Route = createFileRoute("/admin/notifications")({
  component: NotificationsPage,
});

const LIMIT = 100;

type EmailRow = {
  id: string;
  message_id: string | null;
  template_name: string | null;
  recipient_email: string | null;
  status: string | null;
  error_message: string | null;
  created_at: string;
};

type AuditRow = {
  id: string;
  created_at: string;
  action: string;
  table_name: string;
  record_id: string | null;
};

function NotificationsPage() {
  const [tab, setTab] = useState<"emails" | "actions" | "errors">("emails");

  const emails = useQuery({
    queryKey: ["notif-emails"],
    queryFn: async () => {
      // Берём свежие 400 строк и дедупим по message_id на клиенте — порядок по created_at DESC.
      const { data, error } = await supabase
        .from("email_send_log")
        .select("id, message_id, template_name, recipient_email, status, error_message, created_at")
        .order("created_at", { ascending: false })
        .limit(400);
      if (error) throw error;
      const seen = new Set<string>();
      const out: EmailRow[] = [];
      for (const row of (data ?? []) as EmailRow[]) {
        const key = row.message_id ?? row.id;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(row);
        if (out.length >= LIMIT) break;
      }
      return out;
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const actions = useQuery({
    queryKey: ["notif-actions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("id, created_at, action, table_name, record_id")
        .order("created_at", { ascending: false })
        .limit(LIMIT);
      if (error) throw error;
      return (data ?? []) as AuditRow[];
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const errors = useMemo(
    () => (emails.data ?? []).filter((r) => r.status && ["dlq", "failed", "bounced"].includes(r.status)),
    [emails.data],
  );

  const errCount = errors.length;
  const refresh = () => {
    emails.refetch();
    actions.refetch();
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="История уведомлений"
        description="Последние письма, автосохранения и связанные ошибки в одном окне."
        actions={
          <Button variant="outline" size="sm" onClick={refresh} disabled={emails.isFetching || actions.isFetching}>
            <RefreshCw className={`h-4 w-4 mr-2 ${emails.isFetching || actions.isFetching ? "animate-spin" : ""}`} />
            Обновить
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="space-y-4">
        <TabsList className="bg-card/60 border border-border/50">
          <TabsTrigger value="emails" className="gap-2">
            <Mail className="h-4 w-4" /> Письма
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
              {emails.data?.length ?? 0}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="actions" className="gap-2">
            <Activity className="h-4 w-4" /> Действия
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
              {actions.data?.length ?? 0}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="errors" className="gap-2">
            <AlertTriangle className="h-4 w-4" /> Ошибки
            {errCount > 0 && (
              <Badge className="ml-1 h-5 px-1.5 text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/30">
                {errCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="emails">
          <EmailList rows={emails.data} loading={emails.isLoading} />
        </TabsContent>

        <TabsContent value="actions">
          <ActionList rows={actions.data} loading={actions.isLoading} />
        </TabsContent>

        <TabsContent value="errors">
          <EmailList rows={errors} loading={emails.isLoading} emptyText="Ошибок нет — все письма доставлены." />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  const s = status ?? "—";
  const map: Record<string, string> = {
    sent: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    pending: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    dlq: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    failed: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    bounced: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    complained: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    suppressed: "bg-muted text-muted-foreground border-border",
  };
  const cls = map[s] ?? "bg-muted text-muted-foreground border-border";
  return <span className={`inline-flex items-center px-2 h-5 rounded-full border text-[10px] font-medium ${cls}`}>{s}</span>;
}

function EmailList({ rows, loading, emptyText }: { rows?: EmailRow[]; loading: boolean; emptyText?: string }) {
  if (loading) return <ListSkeleton />;
  if (!rows || rows.length === 0) return <EmptyState text={emptyText ?? "Писем пока нет."} />;
  return (
    <div className="rounded-lg border border-border/50 bg-card/60 divide-y divide-border/40">
      {rows.map((r) => (
        <div key={r.id} className="px-4 py-3 flex items-start gap-3 hover:bg-muted/20 transition-colors">
          <Mail className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium truncate">{r.template_name ?? "—"}</span>
              <StatusBadge status={r.status} />
              <span className="text-xs text-muted-foreground truncate">→ {r.recipient_email ?? "—"}</span>
            </div>
            {r.error_message && (
              <p className="text-xs text-rose-300 mt-1 break-words">{r.error_message}</p>
            )}
          </div>
          <time className="text-xs text-muted-foreground tabular-nums shrink-0">{fmtDateTime(r.created_at)}</time>
        </div>
      ))}
    </div>
  );
}

const ACTION_LABEL: Record<string, string> = {
  INSERT: "создание",
  UPDATE: "автосохранение",
  DELETE: "удаление",
};

function ActionList({ rows, loading }: { rows?: AuditRow[]; loading: boolean }) {
  if (loading) return <ListSkeleton />;
  if (!rows || rows.length === 0) return <EmptyState text="Действий пока нет." />;
  return (
    <div className="rounded-lg border border-border/50 bg-card/60 divide-y divide-border/40">
      {rows.map((r) => {
        const isOrder = r.table_name === "orders" && r.record_id;
        return (
          <div key={r.id} className="px-4 py-3 flex items-start gap-3 hover:bg-muted/20 transition-colors">
            <Activity className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">{ACTION_LABEL[r.action] ?? r.action.toLowerCase()}</span>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-xs font-mono text-muted-foreground">{r.table_name}</span>
                {r.record_id && (
                  isOrder ? (
                    <Link
                      to="/admin/orders/$id"
                      params={{ id: r.record_id }}
                      className="text-xs font-mono text-primary hover:underline truncate"
                    >
                      #{r.record_id.slice(0, 8)}
                    </Link>
                  ) : (
                    <span className="text-xs font-mono text-muted-foreground truncate">#{r.record_id.slice(0, 8)}</span>
                  )
                )}
              </div>
            </div>
            <time className="text-xs text-muted-foreground tabular-nums shrink-0">{fmtDateTime(r.created_at)}</time>
          </div>
        );
      })}
      <div className="px-4 py-3 text-center">
        <Link to="/admin/audit" className="text-xs text-primary hover:underline">
          Открыть полный аудит →
        </Link>
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="rounded-lg border border-border/50 bg-card/60 divide-y divide-border/40">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="px-4 py-3 flex items-center gap-3">
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border/60 bg-card/30 py-12 flex flex-col items-center gap-2 text-center">
      <Inbox className="h-6 w-6 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
