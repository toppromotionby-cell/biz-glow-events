// Этап 3: счета, договоры и акты как сохранённые документы —
// список, статусы, оплата, скачивание PDF, удаление.
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminKeys } from "@/lib/query-keys";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Plus, Download, MoreHorizontal, Trash2, Wallet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Building2 } from "lucide-react";
import { CompanySelect } from "@/components/admin/documents/CompanySelect";
import { Label } from "@/components/ui/label";
import { StatusPill } from "@/components/admin/StatusPill";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SendToTelegramButton } from "@/components/admin/SendToTelegramButton";
import { fmtDate, fmtMoney } from "@/lib/formatters";
import { useDocumentViewer } from "@/hooks/use-document-viewer";
import { listOrdersForQuote } from "@/lib/quotes.functions";
import {
  listFinanceDocuments, createFinanceDocument, updateFinanceDocument, deleteFinanceDocument,
  FINANCE_STATUSES, FINANCE_KIND_LABELS, type FinanceDocument, type FinanceKind,
} from "@/lib/finance-documents.functions";

const TONE: Record<string, "muted" | "info" | "success" | "danger"> = {
  draft: "muted",
  issued: "info",
  sent: "info",
  paid: "success",
  signed: "success",
  closed: "success",
  cancelled: "danger",
};

const TAB_LABELS: Record<"all" | FinanceKind, string> = {
  all: "Все",
  invoice: "Счета",
  contract: "Договоры",
  act: "Акты",
};

const statusLabel = (kind: FinanceKind, status: string) =>
  FINANCE_STATUSES[kind].find((s) => s.key === status)?.label ?? status;

export function FinanceDocumentsPanel({ search }: { search: string }) {
  const qc = useQueryClient();
  const viewer = useDocumentViewer();
  const { confirm, dialog } = useConfirm();
  const [kind, setKind] = useState<"all" | FinanceKind>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [payFor, setPayFor] = useState<FinanceDocument | null>(null);
  const [companyFor, setCompanyFor] = useState<FinanceDocument | null>(null);

  const list = useServerFn(listFinanceDocuments);
  const updateFn = useServerFn(updateFinanceDocument);
  const deleteFn = useServerFn(deleteFinanceDocument);

  const { data, isLoading } = useQuery({
    queryKey: [...adminKeys.financeDocuments, search, kind],
    queryFn: () => list({ data: { search, kind } }),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: adminKeys.financeDocuments });

  const update = useMutation({
    mutationFn: (v: { id: string; patch: Record<string, unknown>; snapshot?: boolean }) =>
      updateFn({ data: { id: v.id, patch: v.patch as never, snapshot: v.snapshot } }),
    onSuccess: () => { toast.success("Документ обновлён"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { toast.success("Документ удалён"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = data?.rows ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-border/60 p-0.5">
          {(["all", "invoice", "contract", "act"] as const).map((k) => (
            <Button key={k} size="sm" variant={kind === k ? "secondary" : "ghost"} onClick={() => setKind(k)}>
              {TAB_LABELS[k]}
            </Button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-3">
          {!!data && (
            <span className="text-xs text-muted-foreground">
              На сумму {fmtMoney(data.sum)} · не оплачено {fmtMoney(data.unpaid)}
            </span>
          )}
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />Новый документ
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/60">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Тип</th>
              <th className="px-3 py-2 text-left">Номер</th>
              <th className="px-3 py-2 text-left">Клиент</th>
              <th className="px-3 py-2 text-left">Заказ</th>
              <th className="px-3 py-2 text-left">Дата / срок</th>
              <th className="px-3 py-2 text-right">Сумма</th>
              <th className="px-3 py-2 text-left">Статус</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Загрузка…</td></tr>}
            {!isLoading && !rows.length && (
              <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Документов пока нет</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border/50 transition-colors hover:bg-muted/30">
                <td className="px-3 py-2 text-xs text-muted-foreground">{FINANCE_KIND_LABELS[r.kind]}</td>
                <td className="px-3 py-2 whitespace-nowrap tabular-nums">{r.doc_number}</td>
                <td className="px-3 py-2">{r.client_company || r.client_name || "—"}</td>
                <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                  {r.order_id ? (
                    <Link to="/admin/orders/$id" params={{ id: r.order_id }} className="hover:text-primary">
                      {(r.order_number ?? r.order_id.slice(0, 8)).replaceAll("/", ".")}
                    </Link>
                  ) : "—"}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                  {fmtDate(r.doc_date)}{r.due_date ? ` · до ${fmtDate(r.due_date)}` : ""}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {fmtMoney(r.total)}
                  {r.kind === "invoice" && r.paid > 0 && (
                    <div className="text-[11px] text-muted-foreground">оплачено {fmtMoney(r.paid)}</div>
                  )}
                </td>
                <td className="px-3 py-2">
                  <StatusPill tone={TONE[r.status] ?? "muted"}>{statusLabel(r.kind, r.status)}</StatusPill>
                </td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Скачать PDF"
                      onClick={() =>
                        viewer.openDocument(`/admin/documents/finance/${r.id}/render?format=pdf`, {
                          name: `${FINANCE_KIND_LABELS[r.kind]} ${r.doc_number}.pdf`,
                        })
                      }
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" title="Действия"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <SendToTelegramButton kind="finance" id={r.id} asMenuItem />
                        <DropdownMenuSeparator />
                        {FINANCE_STATUSES[r.kind]
                          .filter((s) => s.key !== r.status)
                          .map((s) => (
                            <DropdownMenuItem
                              key={s.key}
                              onClick={() => update.mutate({ id: r.id, patch: { status: s.key }, snapshot: true })}
                            >
                              {s.label}
                            </DropdownMenuItem>
                          ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setCompanyFor(r)}>
                          <Building2 className="mr-2 h-4 w-4" />Компания документа
                        </DropdownMenuItem>
                        {r.kind === "invoice" && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setPayFor(r)}>
                              <Wallet className="mr-2 h-4 w-4" />Оплата и срок
                            </DropdownMenuItem>
                          </>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={async () => {
                            const ok = await confirm({
                              title: "Удалить документ?",
                              description: `${FINANCE_KIND_LABELS[r.kind]} ${r.doc_number}. Действие нельзя отменить.`,
                              confirmText: "Удалить",
                              destructive: true,
                            });
                            if (ok) remove.mutate(r.id);
                          }}
                        >
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

      <CreateFinanceDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={refresh} />
      <CompanyDialog
        doc={companyFor}
        onClose={() => setCompanyFor(null)}
        onSave={(companyId) => {
          if (companyFor) update.mutate({ id: companyFor.id, patch: { company_id: companyId } });
          setCompanyFor(null);
        }}
      />
      <PaymentDialog
        doc={payFor}
        onClose={() => setPayFor(null)}
        onSave={(patch) => {
          if (payFor) update.mutate({ id: payFor.id, patch, snapshot: true });
          setPayFor(null);
        }}
      />
      {dialog}
    </div>
  );
}

function CompanyDialog({
  doc, onClose, onSave,
}: { doc: FinanceDocument | null; onClose: () => void; onSave: (companyId: string | null) => void }) {
  const [companyId, setCompanyId] = useState<string | null>(null);

  return (
    <Dialog
      open={!!doc}
      onOpenChange={(v) => {
        if (!v) onClose();
        else if (doc) setCompanyId(doc.company_id);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Компания документа</DialogTitle>
          <DialogDescription>
            Реквизиты, логотип, подпись, печать и НДС подставятся из выбранной компании.
          </DialogDescription>
        </DialogHeader>
        <CompanySelect value={companyId} onChange={(id) => setCompanyId(id)} />
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Отмена</Button>
          <Button onClick={() => onSave(companyId)}>Сохранить</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PaymentDialog({
  doc, onClose, onSave,
}: { doc: FinanceDocument | null; onClose: () => void; onSave: (patch: Record<string, unknown>) => void }) {
  const [paid, setPaid] = useState("");
  const [due, setDue] = useState("");

  return (
    <Dialog
      open={!!doc}
      onOpenChange={(v) => {
        if (!v) onClose();
        else if (doc) { setPaid(String(doc.paid || "")); setDue(doc.due_date ?? ""); }
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Оплата и срок</DialogTitle>
          <DialogDescription>{doc ? `Счёт ${doc.doc_number} на ${fmtMoney(doc.total)}` : ""}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="fd-paid">Оплачено, BYN</Label>
            <Input id="fd-paid" inputMode="decimal" value={paid} onChange={(e) => setPaid(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fd-due">Оплатить до</Label>
            <Input id="fd-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Отмена</Button>
          <Button
            onClick={() => {
              const value = Number(paid.replace(",", ".")) || 0;
              const patch: Record<string, unknown> = { paid: value, due_date: due || null };
              if (doc && value >= doc.total && doc.total > 0) patch.status = "paid";
              onSave(patch);
            }}
          >
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateFinanceDialog({
  open, onOpenChange, onCreated,
}: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void }) {
  const [kind, setKind] = useState<FinanceKind>("invoice");
  const [term, setTerm] = useState("");
  const createFn = useServerFn(createFinanceDocument);
  const ordersFn = useServerFn(listOrdersForQuote);

  const { data: orders = [] } = useQuery({
    queryKey: ["finance-create-orders", term],
    queryFn: () => ordersFn({ data: { q: term } }),
    enabled: open,
  });

  const create = useMutation({
    mutationFn: (orderId: string | null) => createFn({ data: { kind, orderId } }),
    onSuccess: () => { toast.success("Документ создан"); onOpenChange(false); onCreated(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Новый документ</DialogTitle>
          <DialogDescription>Счёт, договор или акт — с нуля или на основе заказа</DialogDescription>
        </DialogHeader>

        <div className="inline-flex rounded-lg border border-border/60 p-0.5">
          {(["invoice", "contract", "act"] as const).map((k) => (
            <Button key={k} size="sm" variant={kind === k ? "secondary" : "ghost"} onClick={() => setKind(k)}>
              {FINANCE_KIND_LABELS[k]}
            </Button>
          ))}
        </div>

        {create.isPending && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />Создаём…
          </div>
        )}

        <Button variant="outline" disabled={create.isPending} onClick={() => create.mutate(null)}>
          Пустой документ
        </Button>

        <div>
          <div className="mb-1.5 text-xs uppercase tracking-wide text-muted-foreground">На основе заказа</div>
          <Input placeholder="Поиск по клиенту или номеру заказа" value={term} onChange={(e) => setTerm(e.target.value)} />
          <div className="mt-2 max-h-56 divide-y divide-border/60 overflow-auto rounded-md border border-border/60">
            {orders.map((o) => (
              <button
                key={o.id}
                type="button"
                disabled={create.isPending}
                className="w-full px-3 py-2 text-left transition-colors hover:bg-muted/50"
                onClick={() => create.mutate(o.id)}
              >
                <div className="text-sm font-medium">
                  №{(o.order_number ?? o.id.slice(0, 8)).replaceAll("/", ".")} · {o.client_company || o.client_name}
                </div>
                <div className="text-xs text-muted-foreground">
                  {o.client_name}{o.event_date ? ` · ${fmtDate(o.event_date)}` : ""}
                </div>
              </button>
            ))}
            {!orders.length && <div className="p-3 text-sm text-muted-foreground">Заказы не найдены</div>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
