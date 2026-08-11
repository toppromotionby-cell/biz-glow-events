// Общие примитивы форм документов (КП и промо-КП): одинаковый вид сводок,
// денежного формата, редактора «Что входит» и оболочки диалога.
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/admin/Field";

/** Мягкий парс числа: «1 234,5» → 1234.5, мусор → 0. */
export function parseNum(v: string): number {
  const x = Number(String(v).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(x) ? x : 0;
}

/** Единый денежный формат документов. */
export const money = (v: number, currency = "BYN") =>
  `${new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0)} ${currency}`;

export type SummaryRow = [string, string, boolean?];

/** Сводка «как в превью»: только чтение. */
export function Summary({ rows }: { rows: SummaryRow[] }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm">
      {rows.map(([k, v, strong]) => (
        <div key={k} className={`flex justify-between gap-4 py-0.5 ${strong ? "font-semibold" : ""}`}>
          <span className="text-muted-foreground">{k}</span>
          <span className="tabular-nums">{v}</span>
        </div>
      ))}
    </div>
  );
}

export type IncludeLine = { text: string; note: string };

export const includesToText = (list: Array<{ text: string; note?: string }> | null | undefined) =>
  (list ?? []).map((i) => (i.note ? `${i.text} — ${i.note}` : i.text)).join("\n");

export const textToIncludes = (value: string): IncludeLine[] =>
  value
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [text, ...rest] = l.split(" — ");
      return { text: (text ?? "").trim(), note: rest.join(" — ").trim() };
    });

/** Редактор списка «Что входит» — одинаковый в КП и промо-КП. */
export function IncludesEditor({
  value,
  onChange,
  rows = 4,
  className = "sm:col-span-2",
}: {
  value: Array<{ text: string; note?: string }> | null | undefined;
  onChange: (next: IncludeLine[]) => void;
  rows?: number;
  className?: string;
}) {
  return (
    <Field label="Что входит" className={className} hint="По строке на пункт, пояснение через « — »">
      <Textarea rows={rows} value={includesToText(value)} onChange={(e) => onChange(textToIncludes(e.target.value))} />
    </Field>
  );
}

/** Оболочка диалога редактирования блока документа. */
export function DocDialogShell({
  title,
  onClose,
  onSubmit,
  children,
}: {
  title: string;
  onClose: () => void;
  onSubmit: () => void;
  children: ReactNode;
}) {
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">{children}</div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={onSubmit}>Сохранить</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
