// Реестр приказов: группировка по годам, фильтры по журналу, виду и работнику,
// экспорт в CSV для сверки с бумажными журналами регистрации.
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusPill } from "@/components/admin/StatusPill";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { fmtDate } from "@/lib/formatters";
import { adminKeys } from "@/lib/query-keys";
import { PW_STATUS_LABELS, type PwStatus } from "@/lib/paperwork/model";
import { listOrderJournal } from "@/lib/paperwork-orders.functions";
import {
  ORDER_JOURNALS,
  ORDER_JOURNAL_LABELS,
  ORDER_JOURNAL_SHORT,
  ORDER_KINDS,
  orderKindLabel,
} from "@/lib/paperwork/orders/registry";

type Props = {
  onOpen: (id: string) => void;
  onDelete: (id: string, title: string) => void;
};

const TONE: Record<string, "muted" | "info" | "success"> = {
  draft: "muted",
  ready: "success",
  archived: "info",
};

export function OrderJournalTable({ onOpen, onDelete }: Props) {
  const [journal, setJournal] = useState("all");
  const [kind, setKind] = useState("all");
  const [year, setYear] = useState("all");
  const [search, setSearch] = useState("");
  const term = useDebouncedValue(search, 300);

  const list = useServerFn(listOrderJournal);
  const q = useQuery({
    queryKey: [...adminKeys.paperwork, "orders", journal, kind, year, term],
    queryFn: () =>
      list({
        data: {
          journal,
          kind,
          year: year === "all" ? null : Number(year),
          search: term,
        },
      }),
  });

  const rows = q.data?.rows ?? [];
  const years = q.data?.years ?? [];

  const kinds = useMemo(
    () => (journal === "all" ? ORDER_KINDS : ORDER_KINDS.filter((k) => k.journal === journal)),
    [journal],
  );

  // Группировка по годам — так же, как хранятся бумажные журналы.
  const groups = useMemo(() => {
    const map = new Map<number, typeof rows>();
    for (const r of rows) {
      const y = r.order_year ?? Number(r.doc_date.slice(0, 4)) ?? 0;
      map.set(y, [...(map.get(y) ?? []), r]);
    }
    return [...map.entries()].sort((a, b) => b[0] - a[0]);
  }, [rows]);

  const exportCsv = () => {
    const head = ["Год", "Журнал", "Номер", "Дата", "Вид", "Работник", "Название", "Статус"];
    const body = rows.map((r) => [
      String(r.order_year ?? ""),
      ORDER_JOURNAL_SHORT[r.order_journal as keyof typeof ORDER_JOURNAL_SHORT] ?? r.order_journal,
      r.doc_number,
      r.doc_date,
      orderKindLabel(r.order_kind),
      r.employee_name,
      r.title,
      PW_STATUS_LABELS[r.status as PwStatus] ?? r.status,
    ]);
    const csv = [head, ...body]
      .map((line) => line.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "журнал-приказов.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по номеру или названию"
            className="pl-9"
          />
        </div>
        <Select
          value={journal}
          onValueChange={(v) => {
            setJournal(v);
            setKind("all");
          }}
        >
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все журналы</SelectItem>
            {ORDER_JOURNALS.map((j) => (
              <SelectItem key={j} value={j}>
                {ORDER_JOURNAL_LABELS[j]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={kind} onValueChange={setKind}>
          <SelectTrigger className="w-60">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все виды</SelectItem>
            {kinds.map((k) => (
              <SelectItem key={k.code} value={k.code}>
                {k.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все годы</SelectItem>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={exportCsv} disabled={!rows.length}>
          <Download className="mr-1 h-4 w-4" /> Экспорт
        </Button>
      </div>

      {groups.map(([y, list]) => (
        <div key={y} className="overflow-hidden rounded-lg border border-border">
          <div className="flex items-center justify-between bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{y || "Без года"}</span>
            <span>{list.length} приказов</span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs text-muted-foreground">
              <tr>
                <th className="w-24 p-3 text-left">Номер</th>
                <th className="w-28 p-3 text-left">Дата</th>
                <th className="p-3 text-left">Вид</th>
                <th className="p-3 text-left">Работник</th>
                <th className="w-28 p-3 text-left">Статус</th>
                <th className="w-14 p-3" />
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                  <td className="p-3 font-medium">
                    <button className="hover:underline" onClick={() => onOpen(r.id)}>
                      № {r.doc_number || "—"}
                    </button>
                  </td>
                  <td className="p-3 text-muted-foreground">{fmtDate(r.doc_date)}</td>
                  <td className="p-3">
                    <button className="text-left hover:underline" onClick={() => onOpen(r.id)}>
                      {orderKindLabel(r.order_kind) || r.title}
                    </button>
                  </td>
                  <td className="p-3 text-muted-foreground">{r.employee_name || "—"}</td>
                  <td className="p-3">
                    <StatusPill tone={TONE[r.status] ?? "muted"}>
                      {PW_STATUS_LABELS[r.status as PwStatus] ?? r.status}
                    </StatusPill>
                  </td>
                  <td className="p-3 text-right">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Удалить"
                      onClick={() => onDelete(r.id, r.title)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {!q.isLoading && !rows.length && (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Приказов пока нет — нажмите «Создать приказ».
        </p>
      )}
    </section>
  );
}
