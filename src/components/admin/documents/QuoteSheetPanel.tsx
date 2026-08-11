// Панель синхронизации КП с Google Таблицами: открыть таблицу, выгрузить состав,
// увидеть изменения из таблицы и применить выбранные строки.
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ExternalLink, RefreshCw, Table2, Upload, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  applyQuoteSheetDiff,
  ensureQuoteSheet,
  getQuoteSheetDiff,
  pushQuoteToSheet,
  type SheetDiffRow,
} from "@/lib/quote-sheets.functions";

const KIND_LABEL: Record<SheetDiffRow["kind"], string> = {
  added: "Новая позиция",
  changed: "Изменено",
  removed: "Удалена в таблице",
};

function money(v: number) {
  return `${v.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} BYN`;
}

function RowSummary({ row }: { row: SheetDiffRow }) {
  const it = row.after ?? row.before;
  if (!it) return null;
  return (
    <div className="min-w-0">
      <div className="truncate font-medium">{it.title || "Без названия"}</div>
      <div className="text-xs text-muted-foreground truncate">
        {it.section || "Без раздела"} · {it.qty} {it.unit} × {money(it.price)}
      </div>
      {row.kind === "changed" && row.before && row.after && (
        <div className="mt-1 text-xs text-amber-600">
          {row.fields.join(", ")}: {money(row.before.price * row.before.qty)} → {money(row.after.price * row.after.qty)}
        </div>
      )}
    </div>
  );
}

export function QuoteSheetPanel({ quoteId }: { quoteId: string }) {
  const qc = useQueryClient();
  const ensure = useServerFn(ensureQuoteSheet);
  const push = useServerFn(pushQuoteToSheet);
  const loadDiff = useServerFn(getQuoteSheetDiff);
  const apply = useServerFn(applyQuoteSheetDiff);

  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);

  const { data, refetch, isFetching } = useQuery({
    queryKey: ["quote-sheet", quoteId],
    queryFn: () => loadDiff({ data: { id: quoteId } }),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const diff = useMemo(() => data?.diff ?? [], [data]);

  const onOpenSheet = async () => {
    setBusy(true);
    try {
      const res = await ensure({ data: { id: quoteId } });
      window.open(res.url, "_blank", "noopener");
      await refetch();
      toast.success("Таблица готова");
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  const onPush = async () => {
    setBusy(true);
    try {
      await push({ data: { id: quoteId } });
      await refetch();
      toast.success("Состав выгружен в таблицу");
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  const onApply = async () => {
    setBusy(true);
    try {
      const res = await apply({ data: { id: quoteId, rowIds: picked } });
      toast.success(`Применено изменений: ${res.applied}`);
      setOpen(false);
      setPicked([]);
      await qc.invalidateQueries({ queryKey: ["admin-quote", quoteId] });
      await refetch();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="rounded-xl border p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Table2 className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Google Таблица</span>
        {data?.syncedAt && (
          <span className="text-xs text-muted-foreground">
            синхронизировано {new Date(data.syncedAt).toLocaleString("ru-RU")}
          </span>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={onOpenSheet} disabled={busy}>
            <ExternalLink className="h-4 w-4 mr-1.5" />
            {data?.connected ? "Открыть таблицу" : "Открыть в Google Таблицах"}
          </Button>
          {data?.connected && (
            <>
              <Button size="sm" variant="outline" onClick={onPush} disabled={busy}>
                <Upload className="h-4 w-4 mr-1.5" />Обновить таблицу
              </Button>
              <Button size="sm" variant="ghost" onClick={() => refetch()} disabled={isFetching}>
                <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              </Button>
            </>
          )}
        </div>
      </div>

      {data?.error && (
        <p className="text-xs text-destructive flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5" />{data.error}
        </p>
      )}

      {diff.length > 0 && (
        <button
          type="button"
          onClick={() => { setPicked(diff.map((d) => d.id)); setOpen(true); }}
          className="w-full text-left rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-xs text-amber-700"
        >
          В таблице есть изменения: {diff.length} строк(и) — нажмите, чтобы сравнить и применить
        </button>
      )}

      {data?.connected && diff.length === 0 && !data.error && (
        <p className="text-xs text-muted-foreground">Расхождений с таблицей нет.</p>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Изменения из Google Таблицы</DialogTitle>
            <DialogDescription>Отметьте строки, которые нужно применить к составу КП.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[55vh] overflow-y-auto space-y-2">
            {diff.map((row) => (
              <label key={row.id} className="flex items-start gap-3 rounded-lg border p-2.5 cursor-pointer">
                <Checkbox
                  checked={picked.includes(row.id)}
                  onCheckedChange={(v) =>
                    setPicked((prev) => (v ? [...new Set([...prev, row.id])] : prev.filter((x) => x !== row.id)))
                  }
                />
                <div className="min-w-0 flex-1">
                  <Badge variant={row.kind === "removed" ? "destructive" : "secondary"} className="mb-1 text-[10px]">
                    {KIND_LABEL[row.kind]}
                  </Badge>
                  <RowSummary row={row} />
                </div>
              </label>
            ))}
            {diff.length === 0 && <p className="text-sm text-muted-foreground">Изменений нет.</p>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Отмена</Button>
            <Button onClick={onApply} disabled={busy || picked.length === 0}>
              Применить ({picked.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
