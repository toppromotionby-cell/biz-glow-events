// Диалог импорта состава КП из Excel: выбор файла, предпросмотр и режим (добавить/заменить).
import { useRef, useState } from "react";
import { toast } from "sonner";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import type { ImportResult } from "@/lib/documents/quote-xlsx-import.browser";
import type { QuoteItem } from "@/lib/quotes-model";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  quoteId: string;
  currentCount: number;
  onImport: (items: QuoteItem[], mode: "append" | "replace") => void;
};

export function QuoteImportXlsxDialog({ open, onOpenChange, quoteId, currentCount, onImport }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [fileName, setFileName] = useState("");
  const [mode, setMode] = useState<"append" | "replace">(currentCount ? "append" : "replace");

  const pick = async (file: File) => {
    setBusy(true);
    try {
      const { parseQuoteXlsx } = await import("@/lib/documents/quote-xlsx-import.browser");
      const res = await parseQuoteXlsx(file);
      if (!res.rows.length) throw new Error("В файле не найдено ни одной позиции");
      setResult(res);
      setFileName(file.name);
    } catch (e) {
      setResult(null);
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!result) return;
    const { toQuoteItems } = await import("@/lib/documents/quote-xlsx-import.browser");
    onImport(toQuoteItems(result.rows, quoteId, mode === "append" ? currentCount : 0), mode);
    toast.success(`Импортировано позиций: ${result.rows.length}`);
    setResult(null);
    setFileName("");
    onOpenChange(false);
  };

  const total = (result?.rows ?? []).reduce((s, r) => s + r.qty * r.price, 0);

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setResult(null); setFileName(""); } }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Импорт состава из Excel</DialogTitle>
          <DialogDescription>
            Подойдёт файл с колонками «Наименование», «Ед.», «Кол-во», «Цена» (и, при наличии, «Раздел»,
            «Себестоимость», «Примечание»). Итоговые суммы пересчитаются автоматически.
          </DialogDescription>
        </DialogHeader>

        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xlsm"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void pick(f); e.target.value = ""; }}
        />

        <div className="space-y-3">
          <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
            {fileName || "Выбрать файл .xlsx"}
          </Button>

          {result && (
            <>
              <div className="rounded-lg border p-3 text-xs text-muted-foreground space-y-1">
                <div>Заголовок найден в строке {result.headerRow}. Распознано позиций: {result.rows.length}
                  {result.skipped ? `, пропущено строк: ${result.skipped}` : ""}.</div>
                <div>Колонки: {Object.values(result.mapped).join(", ")}</div>
                <div>Предварительная сумма: {total.toLocaleString("ru-RU", { maximumFractionDigits: 2 })}</div>
              </div>

              <div className="max-h-[38vh] overflow-auto rounded-lg border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/60">
                    <tr>
                      <th className="p-2 text-left">Раздел</th>
                      <th className="p-2 text-left">Наименование</th>
                      <th className="p-2 text-right">Кол-во</th>
                      <th className="p-2 text-right">Цена</th>
                      <th className="p-2 text-right">Сумма</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.slice(0, 60).map((r, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-2 text-muted-foreground">{r.section}</td>
                        <td className="p-2">{r.title}</td>
                        <td className="p-2 text-right">{r.qty} {r.unit}</td>
                        <td className="p-2 text-right">{r.price.toLocaleString("ru-RU")}</td>
                        <td className="p-2 text-right">{(r.qty * r.price).toLocaleString("ru-RU")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <RadioGroup value={mode} onValueChange={(v) => setMode(v as "append" | "replace")} className="gap-2">
                <Label className="flex items-center gap-2 rounded-lg border p-2.5 text-sm">
                  <RadioGroupItem value="append" />
                  Добавить к текущему составу ({currentCount})
                </Label>
                <Label className="flex items-center gap-2 rounded-lg border p-2.5 text-sm">
                  <RadioGroupItem value="replace" />
                  Заменить весь состав
                </Label>
              </RadioGroup>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button onClick={confirm} disabled={!result || busy}>Импортировать</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
