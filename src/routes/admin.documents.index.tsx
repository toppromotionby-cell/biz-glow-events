// Единая точка входа раздела «Документы»: все КП и КП промо в одном списке
// со счётчиками по статусам и одним диалогом создания документа.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  FileStack, Plus, Search, Download, FileSignature, Megaphone, Brain, ArrowRight,
  MoreHorizontal, Copy, Trash2, Send, CheckCircle2, XCircle, Undo2, BookmarkPlus, Wallet,
} from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusPill } from "@/components/admin/StatusPill";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import { fmtDate, fmtMoney } from "@/lib/formatters";
import { useDocumentViewer } from "@/hooks/use-document-viewer";
import {
  listAllDocuments, duplicateDocument, deleteDocument, setDocumentStatus, setDocumentTemplate,
  listOrderDocuments, type DocumentRow,
} from "@/lib/documents-overview.functions";
import { CreateDocumentDialog } from "@/components/admin/documents/CreateDocumentDialog";
import { FinanceDocumentsPanel } from "@/components/admin/documents/FinanceDocumentsPanel";
import { DocumentsAnalyticsPanel } from "@/components/admin/documents/DocumentsAnalyticsPanel";
import { createFinanceDocument } from "@/lib/finance-documents.functions";

export const Route = createFileRoute("/admin/documents/")({ component: Page });

const STATUS_LABELS: Record<string, string> = {
  draft: "Черновик",
  sent: "Отправлено",
  accepted: "Согласовано",
  rejected: "Отклонено",
};

const STATUS_TONE: Record<string, "muted" | "info" | "success" | "danger"> = {
  draft: "muted",
  sent: "info",
  accepted: "success",
  rejected: "danger",
};

const ORDER_DOC_LABELS: Record<string, string> = {
  quote: "КП",
  invoice: "Счёт",
  contract: "Договор",
  act: "Акт",
  custom: "Файл",
};

const FILTERS: Array<{ key: string; label: string }> = [
  { key: "all", label: "Все" },
  { key: "draft", label: "Черновики" },
  { key: "sent", label: "Отправлено" },
  { key: "accepted", label: "Согласовано" },
  { key: "rejected", label: "Отклонено" },
  { key: "expired", label: "Просрочено" },
];

function Page() {
  const viewer = useDocumentViewer();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [kind, setKind] = useState<"all" | "quote" | "promo">("all");
  const [view, setView] = useState<"docs" | "templates" | "finance" | "orders" | "analytics">("docs");
  const templates = view === "templates";
  const [createOpen, setCreateOpen] = useState(false);

  const list = useServerFn(listAllDocuments);
  const listOrderDocs = useServerFn(listOrderDocuments);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-documents-overview", search, status, kind, templates],
    queryFn: () => list({ data: { search, status, kind, templates } }),
    enabled: view === "docs" || view === "templates",
  });

  const orderDocs = useQuery({
    queryKey: ["admin-order-documents", search],
    queryFn: () => listOrderDocs({ data: { search } }),
    enabled: view === "orders",
  });

  const rows = data?.rows ?? [];
  const counts = data?.counts;

  const openDoc = (r: DocumentRow) =>
    r.kind === "quote"
      ? navigate({ to: "/admin/documents/quotes/$id", params: { id: r.id } })
      : navigate({ to: "/admin/documents/promo/$id", params: { id: r.id } });

  const created = useMutation({
    mutationFn: async (target: { kind: "quote" | "promo"; id: string }) => target,
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ["admin-documents-overview"] });
      navigate(
        t.kind === "quote"
          ? { to: "/admin/documents/quotes/$id", params: { id: t.id } }
          : { to: "/admin/documents/promo/$id", params: { id: t.id } },
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { confirm, dialog } = useConfirm();
  const dupFn = useServerFn(duplicateDocument);
  const delFn = useServerFn(deleteDocument);
  const statusFn = useServerFn(setDocumentStatus);
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-documents-overview"] });

  const duplicate = useMutation({
    mutationFn: (r: DocumentRow) => dupFn({ data: { kind: r.kind, id: r.id } }),
    onSuccess: (t) => { toast.success("Создана копия"); created.mutate(t); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (r: DocumentRow) => delFn({ data: { kind: r.kind, id: r.id } }),
    onSuccess: () => { toast.success("Документ удалён"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const changeStatus = useMutation({
    mutationFn: (v: { r: DocumentRow; status: "draft" | "sent" | "accepted" | "rejected" }) =>
      statusFn({ data: { kind: v.r.kind, id: v.r.id, status: v.status } }),
    onSuccess: () => { toast.success("Статус обновлён"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const tplFn = useServerFn(setDocumentTemplate);
  const toggleTemplate = useMutation({
    mutationFn: (v: { r: DocumentRow; isTemplate: boolean }) =>
      tplFn({ data: { kind: v.r.kind, id: v.r.id, isTemplate: v.isTemplate, name: v.r.title } }),
    onSuccess: (_d, v) => { toast.success(v.isTemplate ? "Сохранено как шаблон" : "Убрано из шаблонов"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const invoiceFn = useServerFn(createFinanceDocument);
  const invoiceFromQuote = useMutation({
    mutationFn: (r: DocumentRow) => invoiceFn({ data: { kind: "invoice", quoteId: r.id } }),
    onSuccess: () => {
      toast.success("Счёт создан — вкладка «Счета и акты»");
      qc.invalidateQueries({ queryKey: ["finance-documents"] });
      setView("finance");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const askDelete = async (r: DocumentRow) => {
    const ok = await confirm({
      title: "Удалить документ?",
      description: `${r.number} · ${r.client}. Действие нельзя отменить.`,
      confirmText: "Удалить",
      destructive: true,
    });
    if (ok) remove.mutate(r);
  };

  return (
    <div className="space-y-5">
      <AdminPageHeader
        icon={<FileStack className="h-5 w-5 text-primary" />}
        title="Документы"
        subtitle={`${rows.length} документов · на сумму ${fmtMoney(data?.sum ?? 0)}`}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/admin/documents/knowledge"><Brain className="h-4 w-4 mr-1.5" />База знаний</Link>
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />Создать документ
            </Button>
          </div>
        }
      />

      {view === "docs" && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Черновики" value={counts?.draft ?? 0} onClick={() => setStatus("draft")} />
          <StatCard label="Ждут ответа клиента" value={counts?.awaiting ?? 0} onClick={() => setStatus("sent")} />
          <StatCard label="Согласовано" value={counts?.accepted ?? 0} onClick={() => setStatus("accepted")} />
          <StatCard label="Просрочено" value={counts?.expired ?? 0} onClick={() => setStatus("expired")} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-border/60 p-0.5">
          {([
            { key: "docs", label: "Документы" },
            { key: "templates", label: "Шаблоны" },
            { key: "finance", label: "Счета и акты" },
            { key: "orders", label: "Файлы по заказам" },
            { key: "analytics", label: "Аналитика" },
          ] as const).map((v) => (
            <Button
              key={v.key}
              size="sm"
              variant={view === v.key ? "secondary" : "ghost"}
              onClick={() => { setView(v.key); setStatus("all"); }}
            >
              {v.label}
            </Button>
          ))}
        </div>
        {(view === "docs" || view === "templates") && (
          <div className="inline-flex rounded-lg border border-border/60 p-0.5">
            {(["all", "quote", "promo"] as const).map((k) => (
              <Button key={k} size="sm" variant={kind === k ? "secondary" : "ghost"} onClick={() => setKind(k)}>
                {k === "all" ? "Все типы" : k === "quote" ? "КП" : "КП промо"}
              </Button>
            ))}
          </div>
        )}
        {view !== "analytics" && (
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Поиск по номеру, клиенту, теме"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        )}
        {view === "docs" && (
          <div className="inline-flex flex-wrap gap-1">
            {FILTERS.map((f) => (
              <Button key={f.key} size="sm" variant={status === f.key ? "secondary" : "ghost"} onClick={() => setStatus(f.key)}>
                {f.label}
              </Button>
            ))}
          </div>
        )}
      </div>

      {view === "orders" && (
        <div className="overflow-hidden rounded-xl border border-border/60">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Тип</th>
                <th className="px-3 py-2 text-left">Файл</th>
                <th className="px-3 py-2 text-left">Заказ</th>
                <th className="px-3 py-2 text-left">Клиент</th>
                <th className="px-3 py-2 text-left">Создан</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {orderDocs.isLoading && (
                <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Загрузка…</td></tr>
              )}
              {!orderDocs.isLoading && !(orderDocs.data ?? []).length && (
                <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Документов по заказам пока нет</td></tr>
              )}
              {(orderDocs.data ?? []).map((d) => (
                <tr key={d.id} className="border-t border-border/50 transition-colors hover:bg-muted/30">
                  <td className="px-3 py-2 text-xs text-muted-foreground">{ORDER_DOC_LABELS[d.kind] ?? d.kind}</td>
                  <td className="px-3 py-2">{d.fileName}</td>
                  <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                    <Link to="/admin/orders/$id" params={{ id: d.orderId }} className="hover:text-primary">
                      {d.orderNumber.replaceAll("/", ".")}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{d.client}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{fmtDate(d.createdAt)}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Скачать"
                        disabled={!d.url}
                        onClick={() => d.url && viewer.openDocument(d.url, { name: d.fileName })}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {view === "finance" && <FinanceDocumentsPanel search={search} />}
      {view === "analytics" && <DocumentsAnalyticsPanel />}

      {(view === "docs" || view === "templates") && (
      <div className="overflow-hidden rounded-xl border border-border/60">

        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Тип</th>
              <th className="px-3 py-2 text-left">Номер</th>
              <th className="px-3 py-2 text-left">Клиент / тема</th>
              <th className="px-3 py-2 text-left">Срок / событие</th>
              <th className="px-3 py-2 text-right">Сумма</th>
              <th className="px-3 py-2 text-left">Статус</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Загрузка…</td></tr>
            )}
            {!isLoading && !rows.length && (
              <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Документов не найдено</td></tr>
            )}
            {rows.map((r) => (
              <tr key={`${r.kind}-${r.id}`} className="border-t border-border/50 transition-colors hover:bg-muted/30">
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    {r.kind === "quote"
                      ? <><FileSignature className="h-3.5 w-3.5" />КП</>
                      : <><Megaphone className="h-3.5 w-3.5" />Промо</>}
                  </span>
                </td>
                <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                  <button type="button" className="hover:text-primary" onClick={() => openDoc(r)}>
                    {r.number.replaceAll("/", ".")}
                  </button>
                </td>
                <td className="px-3 py-2">
                  <button type="button" className="block text-left hover:text-primary" onClick={() => openDoc(r)}>
                    <div className="font-medium">{r.client}</div>
                    <div className="line-clamp-1 text-xs text-muted-foreground">{r.title}</div>
                  </button>
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                  {r.event_date ? fmtDate(r.event_date) : r.valid_until ? `до ${fmtDate(r.valid_until)}` : "—"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(r.total)}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <StatusPill tone={STATUS_TONE[r.status] ?? "muted"}>
                      {STATUS_LABELS[r.status] ?? r.status}
                    </StatusPill>
                    {r.viewed_at && !r.client_response && (
                      <span className="text-[11px] text-muted-foreground">просмотрено</span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Скачать PDF"
                      onClick={() =>
                        viewer.openDocument(
                          `/admin/documents/${r.kind === "quote" ? "quotes" : "promo"}/${r.id}/render?format=pdf`,
                          { name: "КП.pdf" },
                        )
                      }
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Открыть" onClick={() => openDoc(r)}>
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" title="Действия">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => duplicate.mutate(r)}>
                          <Copy className="mr-2 h-4 w-4" />
                          {templates ? "Создать документ из шаблона" : "Дублировать"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => toggleTemplate.mutate({ r, isTemplate: !templates })}
                        >
                          <BookmarkPlus className="mr-2 h-4 w-4" />
                          {templates ? "Убрать из шаблонов" : "Сохранить как шаблон"}
                        </DropdownMenuItem>
                        {!templates && (
                          <>
                            <DropdownMenuSeparator />
                            {r.status !== "sent" && (
                              <DropdownMenuItem onClick={() => changeStatus.mutate({ r, status: "sent" })}>
                                <Send className="mr-2 h-4 w-4" />Отметить отправленным
                              </DropdownMenuItem>
                            )}
                            {r.status !== "accepted" && (
                              <DropdownMenuItem onClick={() => changeStatus.mutate({ r, status: "accepted" })}>
                                <CheckCircle2 className="mr-2 h-4 w-4" />Согласовано
                              </DropdownMenuItem>
                            )}
                            {r.status !== "rejected" && (
                              <DropdownMenuItem onClick={() => changeStatus.mutate({ r, status: "rejected" })}>
                                <XCircle className="mr-2 h-4 w-4" />Отклонено
                              </DropdownMenuItem>
                            )}
                            {r.status !== "draft" && (
                              <DropdownMenuItem onClick={() => changeStatus.mutate({ r, status: "draft" })}>
                                <Undo2 className="mr-2 h-4 w-4" />Вернуть в черновик
                              </DropdownMenuItem>
                            )}
                          </>
                        )}
                        {!templates && r.kind === "quote" && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => invoiceFromQuote.mutate(r)}>
                              <Wallet className="mr-2 h-4 w-4" />Выставить счёт
                            </DropdownMenuItem>
                          </>
                        )}
                        <DropdownMenuSeparator />

                        <DropdownMenuItem className="text-destructive" onClick={() => void askDelete(r)}>
                          <Trash2 className="mr-2 h-4 w-4" />Удалить
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}


      <CreateDocumentDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(t) => { setCreateOpen(false); created.mutate(t); }}
      />
      {dialog}
    </div>
  );
}

function StatCard({ label, value, onClick }: { label: string; value: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border border-border/60 p-4 text-left transition-colors hover:border-primary/60 hover:bg-muted/30"
    >
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </button>
  );
}
