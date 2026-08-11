// Панель синхронизации промо-КП с Google Таблицей и Google Документом.
// Оба источника выглядят как превью документа и читаются обратно.
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ExternalLink, FileText, RefreshCw, Table2, Upload, AlertTriangle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  applyPromoSheetDiff,
  ensurePromoSheet,
  getPromoSheetDiff,
  pushPromoToSheet,
  type PromoSheetDiffRow,
} from "@/lib/promo-sheets.functions";
import { applyPromoDocDiff, exportPromoToGoogleDoc, getPromoDocDiff } from "@/lib/promo-gdocs.functions";

const KIND_LABEL: Record<PromoSheetDiffRow["kind"], string> = {
  added: "Новая позиция",
  changed: "Изменено",
  removed: "Удалена в источнике",
};

function money(v: number) {
  return `${v.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} BYN`;
}

function RowSummary({ row }: { row: PromoSheetDiffRow }) {
  const it = row.after ?? row.before;
  if (!it) return null;
  const lineTotal = (r: NonNullable<PromoSheetDiffRow["after"]>) => r.qty * r.multiplier * r.price;
  return (
    <div className="min-w-0">
      <div className="truncate font-medium">{it.title || "Без названия"}</div>
      <div className="text-xs text-muted-foreground truncate">
        {it.section || "Без раздела"} · {it.qty} {it.unit} × {it.multiplier} × {money(it.price)}
        {!it.included && " · не в итог"}
        {it.exclude_from_commission && " · без комиссии"}
        {it.is_info && " · справочно"}
      </div>
      {row.kind === "changed" && row.before && row.after && (
        <div className="mt-1 text-xs text-amber-600">
          {row.fields.join(", ")}: {money(lineTotal(row.before))} → {money(lineTotal(row.after))}
        </div>
      )}
    </div>
  );
}

export function PromoSheetPanel({ quoteId }: { quoteId: string }) {
  const qc = useQueryClient();
  const ensure = useServerFn(ensurePromoSheet);
  const push = useServerFn(pushPromoToSheet);
  const loadDiff = useServerFn(getPromoSheetDiff);
  const apply = useServerFn(applyPromoSheetDiff);
  const toDoc = useServerFn(exportPromoToGoogleDoc);
  const loadDocDiff = useServerFn(getPromoDocDiff);
  const applyDoc = useServerFn(applyPromoDocDiff);

  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState<"sheet" | "doc" | null>(null);
  const [picked, setPicked] = useState<string[]>([]);

  const { data, refetch, isFetching } = useQuery({
    queryKey: ["promo-sheet", quoteId],
    queryFn: () => loadDiff({ data: { id: quoteId } }),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
  const doc = useQuery({
    queryKey: ["promo-gdoc", quoteId],
    queryFn: () => loadDocDiff({ data: { id: quoteId } }),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const sheetDiff = useMemo(() => data?.diff ?? [], [data]);
  const docDiff = useMemo(() => doc.data?.diff ?? [], [doc.data]);
  const activeDiff = source === "doc" ? docDiff : sheetDiff;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  const onOpenSheet = () =>
    run(async () => {
      const res = await ensure({ data: { id: quoteId } });
      window.open(res.url, "_blank", "noopener");
      await refetch();
      toast.success("Таблица оформлена как КП");
    });

  const onPush = () =>
    run(async () => {
      await push({ data: { id: quoteId } });
      await refetch();
      toast.success("Таблица обновлена");
    });

  const onExportDoc = () =>
    run(async () => {
      const res = await toDoc({ data: { id: quoteId } });
      window.open(res.url, "_blank", "noopener");
      await doc.refetch();
      toast.success("Документ обновлён");
    });

  const onApply = () =>
    run(async () => {
      const res =
        source === "doc"
          ? await applyDoc({ data: { id: quoteId, rowIds: picked } })
          : await apply({ data: { id: quoteId, rowIds: picked } });
      toast.success(`Применено изменений: ${res.applied}`);
      setSource(null);
      setPicked([]);
      await qc.invalidateQueries({ queryKey: ["promo-quote", quoteId] });
      await qc.invalidateQueries({ queryKey: ["admin-promo-quote", quoteId] });
      await Promise.all([refetch(), doc.refetch()]);
    });

  const changesBanner = (kind: "sheet" | "doc", count: number, label: string) =>
    count > 0 ? (
      <button
        type="button"
        onClick={() => {
          const list = kind === "doc" ? docDiff : sheetDiff;
          setPicked(list.map((d) => d.id));
          setSource(kind);
        }}
        className="w-full text-left rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-xs text-amber-700"
      >
        {label}: {count} строк(и) — нажмите, чтобы сравнить и применить
      </button>
    ) : null;

  return (
    <div className="rounded-xl border p-3 space-y-3">
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
            {data?.connected ? "Открыть таблицу" : "Создать таблицу"}
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

      <p className="text-xs text-muted-foreground">
        Таблица повторяет превью: шапка, разделы, итоги и живые формулы («Всего» = кол-во × кол-во 2 × цена).
        Служебные поля (ID, себестоимость, флаги) спрятаны в скрытых колонках — правьте видимые ячейки, а затем
        заберите изменения обратно.
      </p>

      {data?.error && (
        <p className="text-xs text-destructive flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5" />{data.error}
        </p>
      )}
      {changesBanner("sheet", sheetDiff.length, "В таблице есть изменения")}
      {data?.connected && sheetDiff.length === 0 && !data.error && (
        <p className="text-xs text-muted-foreground">Расхождений с таблицей нет.</p>
      )}

      <div className="border-t pt-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Google Документ</span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={onExportDoc} disabled={busy}>
              <ExternalLink className="h-4 w-4 mr-1.5" />
              {doc.data?.connected ? "Открыть и обновить" : "Создать документ"}
            </Button>
            {doc.data?.connected && (
              <Button size="sm" variant="ghost" onClick={() => doc.refetch()} disabled={doc.isFetching}>
                <Download className={`h-4 w-4 ${doc.isFetching ? "animate-pulse" : ""}`} />
              </Button>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Документ собирается по вёрстке превью: логотипы, реквизиты, мета-блок, таблица с акцентной шапкой,
          разделы и итоги. Правки в документе можно забрать обратно — после применения документ перерисовывается.
        </p>
        {doc.data?.error && (
          <p className="text-xs text-destructive flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" />{doc.data.error}
          </p>
        )}
        {changesBanner("doc", docDiff.length, "В документе есть изменения")}
        {doc.data?.connected && docDiff.length === 0 && !doc.data.error && (
          <p className="text-xs text-muted-foreground">Расхождений с документом нет.</p>
        )}
      </div>

      <Dialog open={source !== null} onOpenChange={(v) => !v && setSource(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Изменения из {source === "doc" ? "Google Документа" : "Google Таблицы"}
            </DialogTitle>
            <DialogDescription>Отметьте строки, которые нужно применить к составу промо-КП.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[55vh] overflow-y-auto space-y-2">
            {activeDiff.map((row) => (
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
            {activeDiff.length === 0 && <p className="text-sm text-muted-foreground">Изменений нет.</p>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSource(null)}>Отмена</Button>
            <Button onClick={onApply} disabled={busy || picked.length === 0}>
              Применить ({picked.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
