// Список коммерческих предложений: /admin/documents/quotes
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FileSignature, Plus, Search, Copy, Trash2, Download, ImportIcon } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { StatusPill } from "@/components/admin/StatusPill";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import { listQuotes, createQuote, duplicateQuote, deleteQuote, listOrdersForQuote, createQuoteFromTemplate } from "@/lib/quotes.functions";
import { QUOTE_STATUS_LABELS, type QuoteStatus } from "@/lib/quotes-model";
import { fmtDate, fmtMoney } from "@/lib/formatters";
import { useDocumentViewer } from "@/hooks/use-document-viewer";

export const Route = createFileRoute("/admin/documents/quotes/")({ component: Page });

const STATUS_TONE: Record<QuoteStatus, "muted" | "info" | "success" | "danger"> = {
  draft: "muted",
  sent: "info",
  accepted: "success",
  rejected: "danger",
};

function Page() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [templatesMode, setTemplatesMode] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [tplOpen, setTplOpen] = useState(false);
  const [orderTerm, setOrderTerm] = useState("");
  const confirm = useConfirm();

  const list = useServerFn(listQuotes);
  const create = useServerFn(createQuote);
  const duplicate = useServerFn(duplicateQuote);
  const remove = useServerFn(deleteQuote);
  const orders = useServerFn(listOrdersForQuote);
  const fromTemplate = useServerFn(createQuoteFromTemplate);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-quotes", search, status, templatesMode],
    queryFn: () => list({ data: { search, status, templates: templatesMode } }),
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["admin-quotes", "templates-picker"],
    queryFn: () => list({ data: { templates: true } }),
    enabled: tplOpen,
  });

  const { data: orderHits = [] } = useQuery({
    queryKey: ["admin-quotes-orders", orderTerm],
    queryFn: () => orders({ data: { q: orderTerm } }),
    enabled: importOpen,
  });

  const tplMut = useMutation({
    mutationFn: (templateId: string) => fromTemplate({ data: { templateId } }),
    onSuccess: ({ id }) => {
      setTplOpen(false);
      qc.invalidateQueries({ queryKey: ["admin-quotes"] });
      navigate({ to: "/admin/documents/quotes/$id", params: { id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const createMut = useMutation({
    mutationFn: (orderId?: string) => create({ data: { orderId: orderId ?? null } }),
    onSuccess: ({ id }) => {
      setImportOpen(false);
      qc.invalidateQueries({ queryKey: ["admin-quotes"] });
      navigate({ to: "/admin/documents/quotes/$id", params: { id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const dupMut = useMutation({
    mutationFn: (id: string) => duplicate({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-quotes"] }); toast.success("Копия создана"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-quotes"] }); toast.success("КП удалено"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const totalSum = useMemo(() => rows.reduce((s, r) => s + Number(r.total ?? 0), 0), [rows]);

  return (
    <div className="space-y-5">
      <AdminPageHeader
        icon={<FileSignature className="h-5 w-5 text-primary" />}
        title="Коммерческие предложения"
        subtitle={`${rows.length} документов · на сумму ${fmtMoney(totalSum)}`}
        action={
          <div className="flex gap-2">
            <Dialog open={importOpen} onOpenChange={setImportOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm"><ImportIcon className="h-4 w-4 mr-1.5" />Из заказа</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Создать КП на основе заказа</DialogTitle></DialogHeader>
                <Input
                  placeholder="Поиск по клиенту или номеру заказа"
                  value={orderTerm}
                  onChange={(e) => setOrderTerm(e.target.value)}
                />
                <div className="max-h-80 overflow-auto divide-y divide-border/60 rounded-md border border-border/60">
                  {orderHits.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors"
                      onClick={() => createMut.mutate(o.id)}
                    >
                      <div className="text-sm font-medium">
                        №{(o.order_number ?? o.id.slice(0, 8)).replaceAll("/", ".")} · {o.client_company || o.client_name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {o.client_name}{o.event_date ? ` · ${fmtDate(o.event_date)}` : ""}
                      </div>
                    </button>
                  ))}
                  {!orderHits.length && <div className="p-4 text-sm text-muted-foreground">Заказы не найдены</div>}
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={tplOpen} onOpenChange={setTplOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm"><FileSignature className="h-4 w-4 mr-1.5" />Из шаблона</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Создать КП из шаблона</DialogTitle></DialogHeader>
                <div className="max-h-80 overflow-auto divide-y divide-border/60 rounded-md border border-border/60">
                  {templates.map((t) => (
                    <button key={t.id} type="button" className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors"
                      onClick={() => tplMut.mutate(t.id)}>
                      <div className="text-sm font-medium">{t.template_name || t.title}</div>
                      <div className="text-xs text-muted-foreground tabular-nums">{fmtMoney(Number(t.total ?? 0))}</div>
                    </button>
                  ))}
                  {!templates.length && <div className="p-4 text-sm text-muted-foreground">Шаблонов пока нет</div>}
                </div>
              </DialogContent>
            </Dialog>
            <Button size="sm" onClick={() => createMut.mutate(undefined)} disabled={createMut.isPending}>
              <Plus className="h-4 w-4 mr-1.5" />Создать КП
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2">
        <div className="inline-flex rounded-lg border border-border/60 p-0.5">
          <Button variant={templatesMode ? "ghost" : "secondary"} size="sm" onClick={() => setTemplatesMode(false)}>Документы</Button>
          <Button variant={templatesMode ? "secondary" : "ghost"} size="sm" onClick={() => setTemplatesMode(true)}>Шаблоны</Button>
        </div>
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Поиск по клиенту, теме, номеру" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все статусы</SelectItem>
            {Object.entries(QUOTE_STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border border-border/60 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2">Номер</th>
              <th className="text-left px-3 py-2">Клиент / тема</th>
              <th className="text-left px-3 py-2">Мероприятие</th>
              <th className="text-right px-3 py-2">Сумма</th>
              <th className="text-left px-3 py-2">Статус</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Загрузка…</td></tr>}
            {!isLoading && !rows.length && (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Пока нет ни одного КП</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border/50 hover:bg-muted/30 transition-colors">
                <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                  <Link to="/admin/documents/quotes/$id" params={{ id: r.id }} className="hover:text-primary">
                    {(r.quote_number ?? r.id.slice(0, 8)).replaceAll("/", ".")}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <Link to="/admin/documents/quotes/$id" params={{ id: r.id }} className="block hover:text-primary">
                    <div className="font-medium">{r.client_company || r.client_name || "Без клиента"}</div>
                    <div className="text-xs text-muted-foreground line-clamp-1">{r.title}</div>
                  </Link>
                </td>
                <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{r.event_date ? fmtDate(r.event_date) : "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(Number(r.total ?? 0))}</td>
                <td className="px-3 py-2">
                  <StatusPill tone={STATUS_TONE[(r.status as QuoteStatus) ?? "draft"]}>
                    {QUOTE_STATUS_LABELS[(r.status as QuoteStatus) ?? "draft"]}
                  </StatusPill>
                </td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" title="Скачать PDF"
                      onClick={() => viewer.openDocument(`/admin/documents/quotes/${r.id}/render?format=pdf`, { name: "КП.pdf" })}>
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Дублировать" onClick={() => dupMut.mutate(r.id)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Удалить" onClick={async () => {
                        if (await confirm.confirm({ title: "Удалить КП?", description: "Документ и его позиции будут удалены безвозвратно.", destructive: true })) delMut.mutate(r.id);
                      }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {confirm.dialog}
    </div>
  );
}
