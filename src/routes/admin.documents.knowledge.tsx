// Информационная база документов: просмотр, поиск и удаление накопленных данных.
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Brain, Search, Trash2, Eraser, RefreshCw } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import { fmtDate, fmtMoney } from "@/lib/formatters";
import {
  listKnowledgeRows, deleteKnowledgeRows, countStaleKnowledge, pruneStaleKnowledge, syncCatalogKnowledgeFn,
  knowledgeHealthFn, runKnowledgeHygieneFn, mergeKnowledgeDuplicatesFn,
  type KbRow, type KbSort, type KbTable, type KnowledgeHealth,
} from "@/lib/doc-knowledge.functions";

export const Route = createFileRoute("/admin/documents/knowledge")({ component: Page });

const PAGE_SIZE = 50;

const TEXT_KIND_LABELS: Record<string, string> = {
  note: "Примечание",
  footer: "Футер",
  section: "Раздел",
  venue: "Площадка",
  event_format: "Формат",
  term: "Условие",
};

const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
const num = (v: unknown) => (v == null ? 0 : Number(v));

function Page() {
  const [tab, setTab] = useState<KbTable>("contacts");
  const syncCatalog = useServerFn(syncCatalogKnowledgeFn);
  const syncMut = useMutation({
    mutationFn: (): Promise<{ synced: number }> => syncCatalog() as Promise<{ synced: number }>,
    onSuccess: (r) => toast.success(`Синхронизировано позиций каталога: ${r.synced}`),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        icon={<Brain className="h-5 w-5" />}
        title="Информационная база"
        help="infobase-what"
        subtitle="Данные, накопленные из КП, КП промо, заказов, презентаций и каталога сайта. Удаление не меняет сами документы."
        action={
          <Button variant="outline" onClick={() => syncMut.mutate()} disabled={syncMut.isPending}>
            <RefreshCw className={`h-4 w-4 mr-2 ${syncMut.isPending ? "animate-spin" : ""}`} />
            Синхронизировать с каталогом
          </Button>
        }
      />

      <HealthPanel />

      <Tabs value={tab} onValueChange={(v) => setTab(v as KbTable)}>
        <TabsList>
          <TabsTrigger value="contacts">Контрагенты</TabsTrigger>
          <TabsTrigger value="items">Позиции</TabsTrigger>
          <TabsTrigger value="texts">Тексты</TabsTrigger>
        </TabsList>
        <TabsContent value="contacts" className="mt-4"><KbPanel table="contacts" /></TabsContent>
        <TabsContent value="items" className="mt-4"><KbPanel table="items" /></TabsContent>
        <TabsContent value="texts" className="mt-4"><KbPanel table="texts" /></TabsContent>
      </Tabs>
    </div>
  );
}

const KB_LABEL: Record<KbTable, string> = { contacts: "Контрагенты", items: "Позиции", texts: "Тексты" };

/** Сводка и автоматическая уборка: остаются только часто используемые данные. */
function HealthPanel() {
  const qc = useQueryClient();
  const health = useServerFn(knowledgeHealthFn);
  const runHygiene = useServerFn(runKnowledgeHygieneFn);
  const mergeDupes = useServerFn(mergeKnowledgeDuplicatesFn);
  const [minUsage, setMinUsage] = useState(2);
  const [months, setMonths] = useState(6);

  const { data } = useQuery<KnowledgeHealth[]>({
    queryKey: ["admin-kb-health", minUsage, months],
    queryFn: () => health({ data: { minUsage, months } }) as Promise<KnowledgeHealth[]>,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-kb-health"] });
    qc.invalidateQueries({ queryKey: ["admin-kb"] });
  };

  const hygieneMut = useMutation({
    mutationFn: () => runHygiene({ data: { minUsage, months } }),
    onSuccess: (r) => { toast.success(`Слито дублей: ${r.merged}, удалено мусора: ${r.pruned}`); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const mergeMut = useMutation({
    mutationFn: (table: KbTable) => mergeDupes({ data: { table } }),
    onSuccess: (r) => { toast.success(`Слито дублей: ${r.merged}`); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = data ?? [];
  const junk = rows.reduce((a, r) => a + r.junk, 0);
  const dupes = rows.reduce((a, r) => a + r.duplicates, 0);

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium">Состояние базы</p>
          <p className="text-sm text-muted-foreground">
            Хранятся записи с {minUsage}+ использованиями или использованные за последние {months} мес.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={String(minUsage)} onValueChange={(v) => setMinUsage(Number(v))}>
            <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 5].map((n) => (
                <SelectItem key={n} value={String(n)}>Минимум использований: {n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(months)} onValueChange={(v) => setMonths(Number(v))}>
            <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[3, 6, 12, 24].map((n) => (
                <SelectItem key={n} value={String(n)}>Срок хранения: {n} мес.</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => hygieneMut.mutate()} disabled={hygieneMut.isPending}>
            <Eraser className="h-4 w-4 mr-2" /> Очистить портал
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {rows.map((r) => (
          <div key={r.table} className="rounded-md border p-3 text-sm">
            <p className="font-medium">{KB_LABEL[r.table]}</p>
            <p className="text-muted-foreground">Записей: {r.total}</p>
            <p className="text-muted-foreground">Дублей: {r.duplicates} · Мусора: {r.junk}</p>
            {r.duplicates > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={() => mergeMut.mutate(r.table)}
                disabled={mergeMut.isPending}
              >
                Слить дубли
              </Button>
            )}
          </div>
        ))}
      </div>

      {(junk > 0 || dupes > 0) && (
        <p className="text-xs text-muted-foreground">
          Кандидатов на удаление: {junk}. Дублей к слиянию: {dupes}. Уборка выполняется и автоматически раз в сутки.
        </p>
      )}
    </div>
  );
}

function KbPanel({ table }: { table: KbTable }) {
  const qc = useQueryClient();
  const { confirm, dialog } = useConfirm();

  const [termInput, setTermInput] = useState("");
  const [term, setTerm] = useState("");
  const [sort, setSort] = useState<KbSort>("usage");
  const [kind, setKind] = useState("all");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    const id = setTimeout(() => { setTerm(termInput.trim()); setPage(0); }, 300);
    return () => clearTimeout(id);
  }, [termInput]);

  const list = useServerFn(listKnowledgeRows);
  const remove = useServerFn(deleteKnowledgeRows);
  const countStale = useServerFn(countStaleKnowledge);
  const prune = useServerFn(pruneStaleKnowledge);

  const key = ["admin-kb", table, term, sort, kind, page] as const;
  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: () => list({
      data: {
        table, term, sort, page, pageSize: PAGE_SIZE,
        ...(table === "texts" && kind !== "all" ? { kind } : {}),
      },
    }),
  });

  const rows: KbRow[] = data?.rows ?? [];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => { setSelected([]); }, [table, term, sort, kind, page]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-kb", table] });

  const delMut = useMutation({
    mutationFn: (ids: string[]) => remove({ data: { table, ids } }),
    onSuccess: ({ deleted }) => { toast.success(`Удалено записей: ${deleted}`); setSelected([]); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const pruneMut = useMutation({
    mutationFn: () => prune({ data: { table, months: 6 } }),
    onSuccess: ({ deleted }) => { toast.success(`Удалено неиспользуемых: ${deleted}`); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const askDelete = async (ids: string[]) => {
    const ok = await confirm({
      title: ids.length > 1 ? `Удалить ${ids.length} записей?` : "Удалить запись?",
      description: "Запись исчезнет из подсказок. Документы и заказы не изменятся — при новом вводе запись создастся заново.",
      confirmText: "Удалить",
      destructive: true,
    });
    if (ok) delMut.mutate(ids);
  };

  const askPrune = async () => {
    const { count } = await countStale({ data: { table, months: 6 } });
    if (!count) { toast.info("Неиспользуемых записей нет"); return; }
    const ok = await confirm({
      title: `Удалить неиспользуемые: ${count}?`,
      description: "Записи, использованные не более одного раза и не встречавшиеся последние 6 месяцев.",
      confirmText: "Удалить",
      destructive: true,
    });
    if (ok) pruneMut.mutate();
  };

  const allChecked = rows.length > 0 && selected.length === rows.length;
  const toggleAll = () => setSelected(allChecked ? [] : rows.map((r) => r.id));
  const toggleOne = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const columns = useMemo(() => {
    if (table === "contacts") return ["Имя", "Компания", "УНП", "Телефон", "Email", "Адрес"];
    if (table === "items") return ["Раздел", "Название", "Ед.", "Цена", "Себестоимость"];
    return ["Тип", "Текст"];
  }, [table]);

  return (
    <div className="space-y-4">
      {dialog}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Поиск…"
            value={termInput}
            onChange={(e) => setTermInput(e.target.value)}
          />
        </div>

        {table === "texts" && (
          <Select value={kind} onValueChange={(v) => { setKind(v); setPage(0); }}>
            <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все типы</SelectItem>
              {Object.entries(TEXT_KIND_LABELS).map(([k, label]) => (
                <SelectItem key={k} value={k}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select value={sort} onValueChange={(v) => { setSort(v as KbSort); setPage(0); }}>
          <SelectTrigger className="w-[210px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="usage">Сначала частые</SelectItem>
            <SelectItem value="recent">Сначала недавние</SelectItem>
            <SelectItem value="alpha">По алфавиту</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline" onClick={askPrune} disabled={pruneMut.isPending}>
          <Eraser className="h-4 w-4 mr-2" />Удалить неиспользуемые
        </Button>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Всего записей: {total}</span>
        {selected.length > 0 && (
          <Button size="sm" variant="destructive" onClick={() => askDelete(selected)} disabled={delMut.isPending}>
            <Trash2 className="h-4 w-4 mr-2" />Удалить выбранные ({selected.length})
          </Button>
        )}
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox checked={allChecked} onCheckedChange={toggleAll} aria-label="Выделить все" />
              </TableHead>
              {columns.map((c) => <TableHead key={c}>{c}</TableHead>)}
              <TableHead className="text-center w-24">Исп.</TableHead>
              <TableHead className="w-32">Последний раз</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={columns.length + 4} className="text-center py-10 text-muted-foreground">Загрузка…</TableCell></TableRow>
            )}
            {!isLoading && rows.length === 0 && (
              <TableRow><TableCell colSpan={columns.length + 4} className="text-center py-10 text-muted-foreground">
                {term ? "Ничего не найдено" : "Пока нет накопленных данных"}
              </TableCell></TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id} data-state={selected.includes(r.id) ? "selected" : undefined}>
                <TableCell>
                  <Checkbox checked={selected.includes(r.id)} onCheckedChange={() => toggleOne(r.id)} aria-label="Выбрать" />
                </TableCell>
                {table === "contacts" && (
                  <>
                    <TableCell className="font-medium">{str(r["name"]) || "—"}</TableCell>
                    <TableCell>{str(r["company"]) || "—"}</TableCell>
                    <TableCell>{str(r["unp"]) || "—"}</TableCell>
                    <TableCell>{str(r["phone"]) || "—"}</TableCell>
                    <TableCell>{str(r["email"]) || "—"}</TableCell>
                    <TableCell className="max-w-[240px] truncate">{str(r["address"]) || "—"}</TableCell>
                  </>
                )}
                {table === "items" && (
                  <>
                    <TableCell>{str(r["section"]) || "—"}</TableCell>
                    <TableCell className="font-medium max-w-[320px] truncate">{str(r["title"]) || "—"}</TableCell>
                    <TableCell>{str(r["unit"]) || "—"}</TableCell>
                    <TableCell>{fmtMoney(num(r["price"]))}</TableCell>
                    <TableCell>{fmtMoney(num(r["cost"]))}</TableCell>
                  </>
                )}
                {table === "texts" && (
                  <>
                    <TableCell>{TEXT_KIND_LABELS[str(r["kind"])] ?? str(r["kind"])}</TableCell>
                    <TableCell className="max-w-[520px] truncate">{str(r["value"])}</TableCell>
                  </>
                )}
                <TableCell className="text-center tabular-nums">{num(r["usage_count"])}</TableCell>
                <TableCell className="text-muted-foreground">{fmtDate(str(r["last_used_at"]))}</TableCell>
                <TableCell>
                  <Button size="icon" variant="ghost" onClick={() => askDelete([r.id])} aria-label="Удалить">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Назад</Button>
          <span className="text-sm text-muted-foreground">Страница {page + 1} из {pages}</span>
          <Button variant="outline" size="sm" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>Вперёд</Button>
        </div>
      )}
    </div>
  );
}
