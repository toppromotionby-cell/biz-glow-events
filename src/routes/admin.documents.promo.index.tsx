// Список промо-КП: /admin/documents/promo
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Megaphone, Plus, Search, Copy, Trash2, Download } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { StatusPill } from "@/components/admin/StatusPill";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import {
  listPromoQuotes, createPromoQuote, deletePromoQuote,
} from "@/lib/promo-quotes.functions";
import { PROMO_PRESETS, PROMO_STATUS_LABELS, formatMoney, type PromoStatus } from "@/lib/promo-quote-model";
import { fmtDate } from "@/lib/formatters";
import { useDocumentViewer } from "@/hooks/use-document-viewer";

export const Route = createFileRoute("/admin/documents/promo/")({ component: Page });

const STATUS_TONE: Record<PromoStatus, "muted" | "info" | "success" | "danger"> = {
  draft: "muted",
  sent: "info",
  accepted: "success",
  rejected: "danger",
};

function Page() {
  const viewer = useDocumentViewer();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { confirm, dialog } = useConfirm();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [tab, setTab] = useState<"docs" | "templates">("docs");
  const [newOpen, setNewOpen] = useState(false);

  const list = useServerFn(listPromoQuotes);
  const create = useServerFn(createPromoQuote);
  const remove = useServerFn(deletePromoQuote);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-promo-quotes", search, status, tab],
    queryFn: () => list({ data: { search, status, templates: tab === "templates" } }),
  });

  const createMut = useMutation({
    mutationFn: (input: { preset?: string; fromId?: string }) => create({ data: input }),
    onSuccess: ({ id }) => {
      setNewOpen(false);
      navigate({ to: "/admin/documents/promo/$id", params: { id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Документ удалён");
      qc.invalidateQueries({ queryKey: ["admin-promo-quotes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="КП промо"
        subtitle="Коммерческие предложения промо-направления: рекламные игры, промоакции, мероприятия"
        icon={<Megaphone className="h-5 w-5 text-primary" />}
        action={
          <Dialog open={newOpen} onOpenChange={setNewOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />Новое КП</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>С чего начать</DialogTitle></DialogHeader>
              <div className="space-y-2">
                {PROMO_PRESETS.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    disabled={createMut.isPending}
                    onClick={() => createMut.mutate({ preset: p.key })}
                    className="w-full rounded-lg border border-border p-3 text-left transition hover:border-primary hover:bg-accent/50 disabled:opacity-60"
                  >
                    <div className="font-medium">{p.label}</div>
                    <div className="text-sm text-muted-foreground">{p.description}</div>
                  </button>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Проект, клиент или номер"
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все статусы</SelectItem>
            {Object.entries(PROMO_STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex rounded-md border border-border p-0.5">
          {(["docs", "templates"] as const).map((t) => (
            <Button
              key={t}
              size="sm"
              variant={tab === t ? "secondary" : "ghost"}
              onClick={() => setTab(t)}
            >
              {t === "docs" ? "Документы" : "Шаблоны"}
            </Button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Загрузка…</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">Ничего не найдено</div>
        ) : (
          <div className="divide-y divide-border">
            {rows.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-3 p-3 hover:bg-accent/40">
                <button
                  type="button"
                  className="min-w-[200px] flex-1 text-left"
                  onClick={() => navigate({ to: "/admin/documents/promo/$id", params: { id: r.id } })}
                >
                  <div className="font-medium">
                    {r.is_template ? r.template_name || "Шаблон" : r.project || "Без названия"}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {r.doc_number ? `№ ${r.doc_number.replaceAll("/", ".")} · ` : ""}
                    {r.client_name || "клиент не указан"}
                    {r.period ? ` · ${r.period}` : ""}
                  </div>
                </button>
                <div className="text-sm tabular-nums">{formatMoney(Number(r.total))}</div>
                <StatusPill tone={STATUS_TONE[(r.status as PromoStatus) ?? "draft"]}>
                  {PROMO_STATUS_LABELS[(r.status as PromoStatus) ?? "draft"]}
                </StatusPill>
                <div className="hidden text-sm text-muted-foreground md:block">{fmtDate(r.updated_at)}</div>
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    title="Скачать PDF"
                    onClick={() =>
                      viewer.openDocument(`/admin/documents/promo/${r.id}/render?format=pdf`, { name: "КП.pdf" })
                    }
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    title="Дублировать"
                    onClick={() => createMut.mutate({ fromId: r.id })}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    title="Удалить"
                    onClick={async () => {
                      const ok = await confirm({
                        title: "Удалить документ?",
                        description: "Действие нельзя отменить.",
                        confirmText: "Удалить",
                        destructive: true,
                      });
                      if (ok) removeMut.mutate(r.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {dialog}
    </div>
  );
}
