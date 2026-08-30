// Гигиена данных: поиск дублей и незаполненных карточек по всему порталу.
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminKeys } from "@/lib/query-keys";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ShieldCheck, RefreshCw, EyeOff, Trash2, AlertTriangle } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import {
  scanHygieneFn, hideHygieneRecords, deleteHygieneRecords,
  type HygieneReport, type HygieneTable,
} from "@/lib/data-hygiene.functions";

export const Route = createFileRoute("/admin/settings/hygiene")({ component: Page });

const REASON: Record<string, string> = {
  title: "Одинаковое название",
  slug: "Одинаковый адрес (slug)",
  image: "Одинаковое изображение",
};

function Page() {
  const qc = useQueryClient();
  const { confirm, dialog } = useConfirm();
  const scan = useServerFn(scanHygieneFn);
  const hide = useServerFn(hideHygieneRecords);
  const remove = useServerFn(deleteHygieneRecords);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const { data, isFetching, refetch } = useQuery<HygieneReport>({
    queryKey: adminKeys.hygiene,
    queryFn: () => scan() as Promise<HygieneReport>,
    staleTime: 5 * 60_000,
  });

  const invalidate = () => { setSelected({}); qc.invalidateQueries({ queryKey: adminKeys.hygiene }); };

  const hideMut = useMutation({
    mutationFn: (v: { table: HygieneTable; ids: string[] }) => hide({ data: v }),
    onSuccess: (r) => { toast.success(`Скрыто карточек: ${r.affected}`); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (v: { table: HygieneTable; ids: string[] }) => remove({ data: v }),
    onSuccess: (r) => { toast.success(`Удалено карточек: ${r.affected}`); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const totals = data?.totals;
  const cleanIndex = totals && totals.records
    ? Math.max(0, Math.round(100 - ((totals.duplicateRecords + totals.incomplete) / totals.records) * 100))
    : 100;

  const toggle = (id: string) => setSelected((p) => ({ ...p, [id]: !p[id] }));
  const idsOf = (ids: string[]) => ids.filter((id) => selected[id]);

  const act = async (kind: "hide" | "delete", table: HygieneTable, ids: string[]) => {
    const picked = idsOf(ids);
    if (!picked.length) { toast.error("Отметьте карточки"); return; }
    const ok = await confirm({
      title: kind === "hide" ? "Скрыть выбранные карточки?" : "Удалить выбранные карточки?",
      description: kind === "hide"
        ? "Карточки перестанут показываться на сайте, данные сохранятся."
        : "Действие необратимо: карточки будут удалены из базы.",
      confirmText: kind === "hide" ? "Скрыть" : "Удалить",
      destructive: kind === "delete",
    });
    if (!ok) return;
    (kind === "hide" ? hideMut : delMut).mutate({ table, ids: picked });
  };

  return (
    <div className="space-y-6">
      {dialog}
      <AdminPageHeader
        icon={<ShieldCheck className="h-5 w-5" />}
        title="Чистка данных"
        help="settings-hygiene"
        subtitle="Проверка сайта и админки на дубли, одинаковые карточки и незаполненный контент."
        action={
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            Проверить сейчас
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Индекс чистоты" value={`${cleanIndex}%`} />
        <Stat label="Всего карточек" value={String(totals?.records ?? 0)} />
        <Stat label="Групп дублей" value={String(totals?.duplicateGroups ?? 0)} />
        <Stat label="Незаполненных" value={String(totals?.incomplete ?? 0)} />
      </div>

      <Tabs defaultValue="dupes">
        <TabsList>
          <TabsTrigger value="dupes">Дубли</TabsTrigger>
          <TabsTrigger value="incomplete">Незаполненные</TabsTrigger>
        </TabsList>

        <TabsContent value="dupes" className="mt-4 space-y-4">
          {!data?.groups.length && !isFetching && (
            <p className="text-sm text-muted-foreground">Дублей не найдено — портал чистый.</p>
          )}
          {(data?.groups ?? []).map((g) => (
            <Card key={`${g.table}-${g.reason}-${g.key}`}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{g.label}</Badge>
                  <span>{g.records[0]?.title}</span>
                  <Badge variant="secondary" className="font-normal">{REASON[g.reason]}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <ul className="space-y-2">
                  {g.records.map((r, i) => (
                    <li key={r.id} className="flex items-start gap-3 text-sm">
                      <Checkbox
                        checked={!!selected[r.id]}
                        onCheckedChange={() => toggle(r.id)}
                        aria-label="Выбрать карточку"
                        className="mt-0.5"
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium truncate">{r.title}</span>
                          {i === 0 && <Badge className="text-[10px]">Основная</Badge>}
                          {!r.published && <Badge variant="outline" className="text-[10px]">Скрыта</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          /{r.slug || "—"} · {r.hasDescription ? "есть описание" : "нет описания"} ·{" "}
                          {r.hasImage ? "есть фото" : "нет фото"}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => act("hide", g.table, g.records.map((r) => r.id))}
                  >
                    <EyeOff className="h-4 w-4 mr-2" /> Скрыть выбранные
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => act("delete", g.table, g.records.map((r) => r.id))}
                  >
                    <Trash2 className="h-4 w-4 mr-2" /> Удалить выбранные
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="incomplete" className="mt-4 space-y-4">
          {!data?.incomplete.length && !isFetching && (
            <p className="text-sm text-muted-foreground">Все карточки заполнены.</p>
          )}
          {(data?.incomplete ?? []).map((block) => (
            <Card key={block.table}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  {block.label}
                  <Badge variant="secondary">{block.records.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm">
                  {block.records.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center gap-2">
                      <span className="truncate max-w-[320px]">{r.title}</span>
                      {!r.hasDescription && <Badge variant="outline" className="text-[10px]">нет описания</Badge>}
                      {!r.hasImage && <Badge variant="outline" className="text-[10px]">нет фото</Badge>}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
