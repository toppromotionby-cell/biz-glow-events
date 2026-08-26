// Общая панель синхронизации документа с Google Таблицей.
// Используется и обычным КП, и промо-КП: различаются только серверные функции,
// подписи и способ показать строку изменения.
import { useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ExternalLink, RefreshCw, Table2, Upload, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type SheetSyncRow = { id: string; kind: "added" | "changed" | "removed" };

export type SheetSyncState<Row extends SheetSyncRow> = {
  connected?: boolean;
  syncedAt?: string | null;
  error?: string | null;
  diff?: Row[];
};

export type SheetSyncPanelProps<Row extends SheetSyncRow> = {
  /** Ключ кэша для состояния синхронизации. */
  queryKey: unknown[];
  /** Загрузка расхождений между документом и таблицей. */
  loadDiff: () => Promise<SheetSyncState<Row>>;
  /** Создать/получить таблицу, вернуть ссылку. */
  ensureSheet: () => Promise<{ url: string }>;
  /** Выгрузить состав документа в таблицу. */
  pushSheet: () => Promise<unknown>;
  /** Применить выбранные строки к документу. */
  applyRows: (rowIds: string[]) => Promise<{ applied: number }>;
  /** Кэши, которые нужно сбросить после применения изменений. */
  invalidateKeys?: readonly (readonly unknown[])[];
  /** Подписи строк изменений. */
  kindLabel: Record<SheetSyncRow["kind"], string>;
  /** Рендер краткого описания строки. */
  renderRow: (row: Row) => ReactNode;
  /** Подпись кнопки создания таблицы, когда таблицы ещё нет. */
  createLabel?: string;
  /** Текст успешного создания таблицы. */
  createdToast?: string;
  /** Описание под шапкой панели. */
  hint?: ReactNode;
  /** Текст диалога сравнения. */
  compareDescription?: string;
};

export function SheetSyncPanel<Row extends SheetSyncRow>({
  queryKey,
  loadDiff,
  ensureSheet,
  pushSheet,
  applyRows,
  invalidateKeys = [],
  kindLabel,
  renderRow,
  createLabel = "Создать таблицу",
  createdToast = "Таблица готова",
  hint,
  compareDescription = "Отметьте строки, которые нужно применить к составу документа.",
}: SheetSyncPanelProps<Row>) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [compare, setCompare] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);

  const { data, refetch, isFetching } = useQuery({
    queryKey,
    queryFn: () => loadDiff(),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const diff = useMemo(() => data?.diff ?? [], [data]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const onOpenSheet = () => {
    // Вкладку открываем синхронно, в момент клика: если сделать это после
    // await, браузер посчитает окно «не пользовательским» и молча заблокирует.
    const win = typeof window !== "undefined" ? window.open("", "_blank", "noopener") : null;
    return run(async () => {
      try {
        const res = await ensureSheet();
        if (win && !win.closed) win.location.href = res.url;
        else window.open(res.url, "_blank", "noopener");
        await refetch();
        toast.success(createdToast);
      } catch (e) {
        if (win && !win.closed) win.close();
        setLocalError((e as Error).message);
        throw e;
      }
    });
  };


  const onPush = () =>
    run(async () => {
      await pushSheet();
      await refetch();
      toast.success("Таблица обновлена");
    });

  const onApply = () =>
    run(async () => {
      const res = await applyRows(picked);
      toast.success(`Применено изменений: ${res.applied}`);
      setCompare(false);
      setPicked([]);
      for (const key of invalidateKeys) await qc.invalidateQueries({ queryKey: key });
      await refetch();
    });

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
            {data?.connected ? "Открыть таблицу" : createLabel}
          </Button>
          {data?.connected && (
            <>
              <Button size="sm" variant="outline" onClick={onPush} disabled={busy}>
                <Upload className="h-4 w-4 mr-1.5" />Обновить таблицу
              </Button>
              <Button size="sm" variant="ghost" onClick={() => refetch()} disabled={isFetching} aria-label="Обновить состояние">
                <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              </Button>
            </>
          )}
        </div>
      </div>

      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}

      {data?.error && (
        <p className="text-xs text-destructive flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5" />{data.error}
        </p>
      )}

      {diff.length > 0 && (
        <button
          type="button"
          onClick={() => { setPicked(diff.map((d) => d.id)); setCompare(true); }}
          className="w-full text-left rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-xs text-amber-700"
        >
          В таблице есть изменения: {diff.length} строк(и) — нажмите, чтобы сравнить и применить
        </button>
      )}

      {data?.connected && diff.length === 0 && !data.error && (
        <p className="text-xs text-muted-foreground">Расхождений с таблицей нет.</p>
      )}

      <Dialog open={compare} onOpenChange={setCompare}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Изменения из Google Таблицы</DialogTitle>
            <DialogDescription>{compareDescription}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[55vh] overflow-y-auto space-y-2 scroll-visible">
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
                    {kindLabel[row.kind]}
                  </Badge>
                  {renderRow(row)}
                </div>
              </label>
            ))}
            {diff.length === 0 && <p className="text-sm text-muted-foreground">Изменений нет.</p>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCompare(false)}>Отмена</Button>
            <Button onClick={onApply} disabled={busy || picked.length === 0}>
              Применить ({picked.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function sheetMoney(v: number) {
  return `${v.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} BYN`;
}
