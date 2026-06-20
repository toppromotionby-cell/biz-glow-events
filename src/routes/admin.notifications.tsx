// История уведомлений: единая панель для команды.
// Три вкладки:
//  • Письма — последние транзакционные/auth-email отправки (deduped по message_id).
//  • Действия — последние записи audit_log (фактические автосейвы/правки).
//  • Ошибки — недоставленные письма (dlq/failed/bounced) с описанием ошибки.
// На вкладках Письма/Ошибки доступны фильтры (поиск, статус, шаблон) и раскрывающаяся
// панель: для писем подтверждения заказа подгружается статус загрузки КП/Счёта/Договора/Акта.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Mail, Activity, AlertTriangle, RefreshCw, Inbox, Search, ChevronDown, CheckCircle2, XCircle, Loader2, FileText, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

type StatusFilter = "all" | "sent" | "failed" | "suppressed" | "pending";

function NotificationsPage() {
  const [tab, setTab] = useState<"emails" | "actions" | "errors">("emails");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [templateFilter, setTemplateFilter] = useState<string>("all");

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

  const templates = useMemo(() => {
    const set = new Set<string>();
    for (const r of emails.data ?? []) if (r.template_name) set.add(r.template_name);
    return Array.from(set).sort();
  }, [emails.data]);

  const filterRows = (rows: EmailRow[]) => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all") {
        const s = r.status ?? "";
        if (statusFilter === "failed" && !["dlq", "failed", "bounced"].includes(s)) return false;
        if (statusFilter === "sent" && s !== "sent") return false;
        if (statusFilter === "pending" && s !== "pending") return false;
        if (statusFilter === "suppressed" && !["suppressed", "complained"].includes(s)) return false;
      }
      if (templateFilter !== "all" && r.template_name !== templateFilter) return false;
      if (q) {
        const hay = `${r.template_name ?? ""} ${r.recipient_email ?? ""} ${r.message_id ?? ""} ${r.error_message ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  };

  const filteredEmails = useMemo(() => filterRows(emails.data ?? []), [emails.data, search, statusFilter, templateFilter]);
  const errors = useMemo(
    () => filterRows((emails.data ?? []).filter((r) => r.status && ["dlq", "failed", "bounced"].includes(r.status))),
    [emails.data, search, statusFilter, templateFilter],
  );

  const errCount = (emails.data ?? []).filter((r) => r.status && ["dlq", "failed", "bounced"].includes(r.status)).length;
  const refresh = () => {
    emails.refetch();
    actions.refetch();
  };

  const filtersBar = (
    <div className="flex flex-wrap items-center gap-2 mb-3">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск: email, шаблон, message_id, ошибка…"
          className="pl-8 h-9"
        />
      </div>
      <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
        <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Все статусы</SelectItem>
          <SelectItem value="sent">Отправлено</SelectItem>
          <SelectItem value="pending">В очереди</SelectItem>
          <SelectItem value="failed">Ошибка / DLQ</SelectItem>
          <SelectItem value="suppressed">Подавлено</SelectItem>
        </SelectContent>
      </Select>
      <Select value={templateFilter} onValueChange={setTemplateFilter}>
        <SelectTrigger className="h-9 w-[200px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Все шаблоны</SelectItem>
          {templates.map((t) => (
            <SelectItem key={t} value={t}>{t}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {(search || statusFilter !== "all" || templateFilter !== "all") && (
        <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setStatusFilter("all"); setTemplateFilter("all"); }}>
          Сбросить
        </Button>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="История уведомлений"
        subtitle="Последние письма, автосохранения и связанные ошибки в одном окне."
        action={
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
          {filtersBar}
          <EmailList rows={filteredEmails} loading={emails.isLoading} />
        </TabsContent>

        <TabsContent value="actions">
          <ActionList rows={actions.data} loading={actions.isLoading} />
        </TabsContent>

        <TabsContent value="errors">
          {filtersBar}
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

// Достаём orderId из message_id вида `order-confirmed-<uuid>-<salt>` или `order-<uuid>`.
function extractOrderId(messageId: string | null): string | null {
  if (!messageId) return null;
  const m = messageId.match(/^order(?:-confirmed)?-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  return m?.[1] ?? null;
}

function EmailList({ rows, loading, emptyText }: { rows?: EmailRow[]; loading: boolean; emptyText?: string }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  if (loading) return <ListSkeleton />;
  if (!rows || rows.length === 0) return <EmptyState text={emptyText ?? "Писем пока нет."} />;
  return (
    <div className="rounded-lg border border-border/50 bg-card/60 divide-y divide-border/40">
      {rows.map((r) => {
        const isOpen = expanded === r.id;
        const orderId = extractOrderId(r.message_id);
        return (
          <div key={r.id}>
            <button
              type="button"
              onClick={() => setExpanded(isOpen ? null : r.id)}
              className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-muted/20 transition-colors"
            >
              <Mail className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium truncate">{r.template_name ?? "—"}</span>
                  <StatusBadge status={r.status} />
                  <span className="text-xs text-muted-foreground truncate">→ {r.recipient_email ?? "—"}</span>
                </div>
                {r.error_message && !isOpen && (
                  <p className="text-xs text-rose-300 mt-1 break-words line-clamp-1">{r.error_message}</p>
                )}
              </div>
              <time className="text-xs text-muted-foreground tabular-nums shrink-0 mt-0.5">{fmtDateTime(r.created_at)}</time>
              <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform mt-0.5 ${isOpen ? "rotate-180" : ""}`} />
            </button>
            {isOpen && (
              <div className="px-4 pb-4 pt-1 pl-11 space-y-3 bg-muted/10">
                <DetailRow label="Message ID" value={r.message_id ?? "—"} mono />
                {r.error_message ? (
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Причина сбоя</div>
                    <pre className="text-xs text-rose-200 bg-rose-500/5 border border-rose-500/20 rounded p-2 whitespace-pre-wrap break-words">
                      {r.error_message}
                    </pre>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">Ошибок при доставке не зафиксировано.</div>
                )}
                {orderId && <OrderDocsPanel orderId={orderId} />}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-xs break-all ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}

type DocStatus = { kind: "quote" | "invoice" | "contract" | "act"; label?: string; ok: boolean; stage?: string; error?: string; url?: string };
const DOC_LABEL: Record<DocStatus["kind"], string> = { quote: "КП", invoice: "Счёт", contract: "Договор", act: "Акт" };
const STAGE_LABEL: Record<string, string> = { build: "генерация", upload: "загрузка в хранилище", sign: "подпись ссылки" };

function OrderDocsPanel({ orderId }: { orderId: string }) {
  const q = useQuery({
    queryKey: ["notif-order-docs", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_timeline")
        .select("event, payload, created_at")
        .eq("order_id", orderId)
        .in("event", ["documents_attached", "documents_attach_failed"])
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      const row = (data ?? [])[0] as { event: string; payload: unknown; created_at: string } | undefined;
      if (!row) return null;
      const payload = (row.payload ?? {}) as { statuses?: DocStatus[] };
      return { event: row.event, statuses: payload.statuses ?? [], createdAt: row.created_at };
    },
    staleTime: 15_000,
  });

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Статус документов</div>
        <Link
          to="/admin/orders/$id"
          params={{ id: orderId }}
          className="text-[11px] text-primary hover:underline ml-auto inline-flex items-center gap-1"
        >
          Заказ #{orderId.slice(0, 8)} <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
      {q.isLoading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Загружаем статус…
        </div>
      ) : !q.data ? (
        <div className="text-xs text-muted-foreground">Нет данных о прикреплении документов для этого заказа.</div>
      ) : (
        (() => {
          const statuses = q.data.statuses;
          return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {(["quote", "invoice", "contract", "act"] as const).map((kind) => {
            const s = statuses.find((x) => x.kind === kind);
            const ok = s?.ok ?? false;
            return (
              <div
                key={kind}
                className={`flex items-start gap-2 rounded-md border px-2.5 py-2 ${
                  !s
                    ? "border-border bg-muted/20"
                    : ok
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-rose-500/30 bg-rose-500/5"
                }`}
              >
                {!s ? (
                  <span className="h-4 w-4 rounded-full border border-dashed border-muted-foreground mt-0.5" />
                ) : ok ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-rose-400 mt-0.5 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium flex items-center gap-2 flex-wrap">
                    {s?.label ?? DOC_LABEL[kind]}
                    {s && !ok && s.stage && (
                      <span className="text-[10px] text-rose-300/80">· {STAGE_LABEL[s.stage] ?? s.stage}</span>
                    )}
                    {s && ok && s.url && (
                      <a href={s.url} target="_blank" rel="noreferrer" className="text-[10px] text-primary hover:underline inline-flex items-center gap-0.5">
                        открыть <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    )}
                  </div>
                  {s && !ok && s.error && (
                    <div className="text-[11px] text-rose-200/90 mt-0.5 break-words">{s.error}</div>
                  )}
                  {!s && (
                    <div className="text-[11px] text-muted-foreground mt-0.5">не прикреплён</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
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
