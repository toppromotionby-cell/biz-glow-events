// Редактор промо-КП: вкладки-формы слева, живое превью и итоги справа, автосохранение и Undo.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft, Download, FileSpreadsheet, Save, Loader2, Info, Undo2, History, Send,
  AlertTriangle, CheckCircle2, Eye, Percent,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusPill } from "@/components/admin/StatusPill";
import { PromoItemsTable } from "@/components/admin/promo/PromoItemsTable";
import { PromoItemsToolbar } from "@/components/admin/promo/PromoItemsToolbar";
import { PromoTotalsPanel } from "@/components/admin/promo/PromoTotalsPanel";
import {
  createPromoVersion, getPromoQuote, listPromoVersions, markPromoSent, restorePromoVersion,
  savePromoQuote, savePromoSnippet, savePromoTemplate,
} from "@/lib/promo-quotes.functions";
import {
  PROMO_STATUS_LABELS, PROMO_STATUSES, checkPromoQuote, computePromoTotals, promoNumberDisplay,
  promoValidityState, type PromoDiscountType, type PromoItem, type PromoQuote, type PromoStatus,
} from "@/lib/promo-quote-model";
import { buildPromoQuoteBody, PROMO_DOC_CSS } from "@/lib/documents/promo-quote-html";
import { downloadAuthedFile } from "@/lib/authed-fetch";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/documents/promo/$id/")({ component: EditorPage });

type Snapshot = { quote: PromoQuote; items: PromoItem[] };

function Hint({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Info className="h-3.5 w-3.5 text-muted-foreground" />
      </TooltipTrigger>
      <TooltipContent className="max-w-[260px]">{text}</TooltipContent>
    </Tooltip>
  );
}

function EditorPage() {
  const { id } = Route.useParams();
  const get = useServerFn(getPromoQuote);
  const save = useServerFn(savePromoQuote);
  const saveTpl = useServerFn(savePromoTemplate);
  const saveSnippet = useServerFn(savePromoSnippet);
  const listVersions = useServerFn(listPromoVersions);
  const makeVersion = useServerFn(createPromoVersion);
  const restoreVersion = useServerFn(restorePromoVersion);
  const markSent = useServerFn(markPromoSent);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["promo-quote", id],
    queryFn: () => get({ data: { id } }),
  });

  const [quote, setQuote] = useState<PromoQuote | null>(null);
  const [items, setItems] = useState<PromoItem[]>([]);
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [showCost, setShowCost] = useState(false);
  const [snippetDraft, setSnippetDraft] = useState<{ name: string; section: string; items: PromoItem[] } | null>(null);
  const history = useRef<Snapshot[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (data) {
      setQuote(data.quote);
      setItems(data.items);
      history.current = [];
      setDirty(false);
    }
  }, [data]);

  const saveMut = useMutation({
    mutationFn: async (payload: Snapshot) => {
      const { id: _id, doc_number, created_at, updated_at, total, sent_at, ...patch } = payload.quote;
      void _id; void doc_number; void created_at; void updated_at; void total; void sent_at;
      return save({
        data: {
          id,
          patch: patch as unknown as Record<string, unknown>,
          items: payload.items.map((it) => ({
            section: it.section, title: it.title, unit: it.unit, qty: it.qty,
            multiplier: it.multiplier, price: it.price, cost: it.cost, note: it.note,
            exclude_from_commission: it.exclude_from_commission,
          })) as unknown[],
        },
      });
    },
    onSuccess: () => {
      setSavedAt(new Date());
      setDirty(false);
    },
    onError: (e: Error) => toast.error(`Не сохранено: ${e.message}`),
  });

  const scheduleSave = useCallback((q: PromoQuote, list: PromoItem[]) => {
    setDirty(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => saveMut.mutate({ quote: q, items: list }), 1200);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pushHistory = useCallback((snap: Snapshot) => {
    history.current = [...history.current.slice(-29), snap];
  }, []);

  const patchQuote = (p: Partial<PromoQuote>) => {
    setQuote((prev) => {
      if (!prev) return prev;
      pushHistory({ quote: prev, items });
      const next = { ...prev, ...p };
      scheduleSave(next, items);
      return next;
    });
  };

  const patchItems = (next: PromoItem[]) => {
    if (quote) pushHistory({ quote, items });
    setItems(next);
    if (quote) scheduleSave(quote, next);
  };

  const undo = useCallback(() => {
    const prev = history.current.pop();
    if (!prev) return toast.info("Отменять нечего");
    setQuote(prev.quote);
    setItems(prev.items);
    scheduleSave(prev.quote, prev.items);
    toast.success("Действие отменено");
  }, [scheduleSave]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        const t = e.target as HTMLElement | null;
        if (t && /input|textarea/i.test(t.tagName)) return;
        e.preventDefault();
        undo();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (quote) saveMut.mutate({ quote, items });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, quote, items, saveMut]);

  const totals = useMemo(() => (quote ? computePromoTotals(quote, items) : null), [quote, items]);
  const checks = useMemo(() => (quote ? checkPromoQuote(quote, items) : []), [quote, items]);
  const errors = checks.filter((c) => c.level === "error");
  const warnings = checks.filter((c) => c.level === "warn");
  const previewHtml = useMemo(() => (quote ? buildPromoQuoteBody(quote, items) : ""), [quote, items]);

  const versions = useQuery({
    queryKey: ["promo-versions", id],
    queryFn: () => listVersions({ data: { quoteId: id } }),
  });

  const uploadLogo = async (file: File, field: "logo_url" | "client_logo_url") => {
    const path = `promo-quotes/${id}/${field}-${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
    const { error: upErr } = await supabase.storage.from("catalog-media").upload(path, file, { upsert: true });
    if (upErr) return toast.error(upErr.message);
    const { data: pub } = supabase.storage.from("catalog-media").getPublicUrl(path);
    patchQuote({ [field]: pub.publicUrl } as Partial<PromoQuote>);
    toast.success("Логотип загружен");
  };

  if (isLoading) return <div className="p-8 text-muted-foreground">Загрузка…</div>;
  if (error || !quote || !totals) {
    return <div className="p-8 text-destructive">{(error as Error)?.message ?? "Документ не найден"}</div>;
  }

  const validity = promoValidityState(quote);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        {/* Шапка */}
        <div className="sticky top-0 z-20 -mx-2 flex flex-wrap items-center gap-2 bg-background/95 px-2 py-2 backdrop-blur">
          <Button asChild variant="ghost" size="sm">
            <Link to="/admin/documents/promo"><ArrowLeft className="mr-1 h-4 w-4" />К списку</Link>
          </Button>
          <div className="mr-auto">
            <div className="font-semibold">{quote.project || "Без названия"}</div>
            <div className="text-xs text-muted-foreground">
              № {promoNumberDisplay(quote)} ·{" "}
              {saveMut.isPending
                ? "сохранение…"
                : dirty
                  ? "есть несохранённые изменения"
                  : savedAt
                    ? `сохранено ${savedAt.toLocaleTimeString("ru-RU")}`
                    : "все изменения сохранены"}
            </div>
          </div>

          {validity === "expired" && <StatusPill tone="danger">Срок истёк</StatusPill>}
          <StatusPill
            tone={
              quote.status === "accepted" ? "success"
                : quote.status === "rejected" ? "danger"
                  : quote.status === "sent" ? "info" : "muted"
            }
          >
            {PROMO_STATUS_LABELS[quote.status]}
          </StatusPill>

          <Button size="sm" variant="ghost" onClick={undo} title="Отменить (Ctrl+Z)">
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => saveMut.mutate({ quote, items })} disabled={saveMut.isPending}>
            {saveMut.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
            Сохранить
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              const { exportPromoQuoteXlsx } = await import("@/lib/documents/promo-xlsx.browser");
              await exportPromoQuoteXlsx(quote, items).catch((e: Error) => toast.error(e.message));
            }}
          >
            <FileSpreadsheet className="mr-1 h-4 w-4" />XLSX
          </Button>
          <Button
            size="sm"
            onClick={() =>
              downloadAuthedFile(`/admin/documents/promo/${id}/render?format=pdf`, "КП.pdf").catch((e: Error) =>
                toast.error(e.message),
              )
            }
          >
            <Download className="mr-1 h-4 w-4" />PDF
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline"><History className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[280px]">
              <DropdownMenuLabel>Версии</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={async () => {
                  await makeVersion({ data: { quoteId: id, label: `Снимок ${new Date().toLocaleString("ru-RU")}` } });
                  void versions.refetch();
                  toast.success("Версия сохранена");
                }}
              >
                Сохранить текущую версию
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {versions.data?.length === 0 && (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">Версий пока нет</div>
              )}
              {versions.data?.map((v) => (
                <DropdownMenuItem
                  key={v.id}
                  onClick={async () => {
                    if (!window.confirm("Восстановить эту версию? Текущие данные будут заменены.")) return;
                    await restoreVersion({ data: { versionId: v.id } });
                    await refetch();
                    toast.success("Версия восстановлена");
                  }}
                >
                  <span className="truncate">{v.label}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={async () => {
                  await markSent({ data: { id } });
                  await refetch();
                  toast.success("Отмечено как отправленное");
                }}
              >
                <Send className="mr-2 h-4 w-4" />Отметить «Отправлено»
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={async () => {
                  const name = window.prompt("Название шаблона", quote.project || "Шаблон промо-КП");
                  if (!name) return;
                  await saveTpl({ data: { id, name } });
                  toast.success("Шаблон сохранён");
                }}
              >
                Сохранить как шаблон
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Проверки */}
        {(errors.length > 0 || warnings.length > 0) && (
          <div className="space-y-1 rounded-lg border border-border p-3 text-sm">
            {errors.map((c, i) => (
              <div key={`e${i}`} className="flex items-start gap-2 text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{c.message}
              </div>
            ))}
            {warnings.map((c, i) => (
              <div key={`w${i}`} className="flex items-start gap-2 text-muted-foreground">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />{c.message}
              </div>
            ))}
          </div>
        )}
        {errors.length === 0 && warnings.length === 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-border p-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />Документ готов к отправке
          </div>
        )}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          {/* ЛЕВО: форма */}
          <Tabs defaultValue="items" className="space-y-3">
            <TabsList>
              <TabsTrigger value="items">Позиции ({items.length})</TabsTrigger>
              <TabsTrigger value="main">Проект</TabsTrigger>
              <TabsTrigger value="money">Финансы</TabsTrigger>
              <TabsTrigger value="view">Вид</TabsTrigger>
            </TabsList>

            <TabsContent value="items" className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <PromoItemsToolbar items={items} onChange={patchItems} />
                <Label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Switch checked={showCost} onCheckedChange={setShowCost} />
                  Себестоимость и маржа
                </Label>
              </div>
              <PromoItemsTable
                items={items}
                currency={quote.currency}
                showCost={showCost}
                showNotes={quote.show_notes}
                onChange={patchItems}
                onSaveSectionAsSnippet={(section, list) =>
                  setSnippetDraft({ name: section || "Блок", section, items: list })
                }
              />
            </TabsContent>

            <TabsContent value="main" className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Проект"><Input value={quote.project} onChange={(e) => patchQuote({ project: e.target.value })} /></Field>
                <Field label="Клиент"><Input value={quote.client_name} onChange={(e) => patchQuote({ client_name: e.target.value })} /></Field>
                <Field label="Период"><Input value={quote.period} onChange={(e) => patchQuote({ period: e.target.value })} placeholder="01.09 – 30.09.2026" /></Field>
                <Field label="Место проведения"><Input value={quote.venue} onChange={(e) => patchQuote({ venue: e.target.value })} /></Field>
                <Field label="Контактное лицо"><Input value={quote.contact_name} onChange={(e) => patchQuote({ contact_name: e.target.value })} /></Field>
                <Field label="Должность"><Input value={quote.contact_role} onChange={(e) => patchQuote({ contact_role: e.target.value })} /></Field>
                <Field label="Телефон"><Input value={quote.contact_phone} onChange={(e) => patchQuote({ contact_phone: e.target.value })} /></Field>
                <Field label="E-mail"><Input value={quote.contact_email} onChange={(e) => patchQuote({ contact_email: e.target.value })} /></Field>
                <Field label="Статус">
                  <Select value={quote.status} onValueChange={(v) => patchQuote({ status: v as PromoStatus })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PROMO_STATUSES.map((s) => <SelectItem key={s} value={s}>{PROMO_STATUS_LABELS[s]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Действительно до">
                  <Input
                    type="date"
                    value={quote.valid_until ?? ""}
                    onChange={(e) => patchQuote({ valid_until: e.target.value || null })}
                  />
                </Field>
              </div>
            </TabsContent>

            <TabsContent value="money" className="space-y-3">
              <Row>
                <span className="flex items-center gap-1">Комиссия агентства <Hint text="Процент считается от суммы позиций, кроме отмеченных «без комиссии»." /></span>
                <Switch checked={quote.commission_enabled} onCheckedChange={(v) => patchQuote({ commission_enabled: v })} />
              </Row>
              {quote.commission_enabled && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <Field label="Название строки"><Input value={quote.commission_label} onChange={(e) => patchQuote({ commission_label: e.target.value })} /></Field>
                  <Field label="Ставка, %"><Input type="number" min={0} max={100} step="0.1" value={quote.commission_rate} onChange={(e) => patchQuote({ commission_rate: Number(e.target.value) })} /></Field>
                </div>
              )}
              <Separator />
              <Row>
                <span className="flex items-center gap-1">Управление проектом <Hint text="Фиксированная сумма за менеджмент проекта — отдельной строкой." /></span>
                <Switch checked={quote.management_enabled} onCheckedChange={(v) => patchQuote({ management_enabled: v })} />
              </Row>
              {quote.management_enabled && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <Field label="Название строки"><Input value={quote.management_label} onChange={(e) => patchQuote({ management_label: e.target.value })} /></Field>
                  <Field label="Сумма"><Input type="number" min={0} step="0.01" value={quote.management_amount} onChange={(e) => patchQuote({ management_amount: Number(e.target.value) })} /></Field>
                </div>
              )}
              <Separator />
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="Скидка">
                  <Select value={quote.discount_type} onValueChange={(v) => patchQuote({ discount_type: v as PromoDiscountType })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Без скидки</SelectItem>
                      <SelectItem value="percent">Процент</SelectItem>
                      <SelectItem value="fixed">Фиксированная сумма</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                {quote.discount_type !== "none" && (
                  <Field label={quote.discount_type === "percent" ? "Размер, %" : `Сумма, ${quote.currency}`}>
                    <div className="relative">
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={quote.discount_value}
                        onChange={(e) => patchQuote({ discount_value: Number(e.target.value) })}
                      />
                      {quote.discount_type === "percent" && (
                        <Percent className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </Field>
                )}
              </div>
              <Separator />
              <Row>
                <span>НДС</span>
                <Switch checked={quote.vat_enabled} onCheckedChange={(v) => patchQuote({ vat_enabled: v })} />
              </Row>
              {quote.vat_enabled && (
                <Field label="Ставка НДС, %">
                  <Input type="number" min={0} max={30} step="0.1" value={quote.vat_rate} onChange={(e) => patchQuote({ vat_rate: Number(e.target.value) })} />
                </Field>
              )}
            </TabsContent>

            <TabsContent value="view" className="space-y-3">
              <Row><span className="flex items-center gap-1">Колонка «Кол-во» <Hint text="Скройте, если позиции без количества (пакетные услуги)." /></span>
                <Switch checked={quote.show_qty} onCheckedChange={(v) => patchQuote({ show_qty: v })} /></Row>
              <Row><span className="flex items-center gap-1">Колонка «Всего» <Hint text="Кол-во × множитель — например, человек × дней." /></span>
                <Switch checked={quote.show_total_qty} onCheckedChange={(v) => patchQuote({ show_total_qty: v })} /></Row>
              <Row><span>Колонка «Примечания»</span>
                <Switch checked={quote.show_notes} onCheckedChange={(v) => patchQuote({ show_notes: v })} /></Row>
              <Field label="Акцентный цвет">
                <Input type="color" value={quote.accent_color} onChange={(e) => patchQuote({ accent_color: e.target.value })} className="h-10 w-20 p-1" />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Логотип агентства">
                  <Input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadLogo(f, "logo_url"); }} />
                </Field>
                <Field label="Логотип клиента">
                  <Input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadLogo(f, "client_logo_url"); }} />
                </Field>
              </div>
              <Field label="Примечание в подвале">
                <Textarea value={quote.footer_note} onChange={(e) => patchQuote({ footer_note: e.target.value })} className="min-h-[80px]" />
              </Field>
            </TabsContent>
          </Tabs>

          {/* ПРАВО: итоги и превью */}
          <div className="space-y-3 xl:sticky xl:top-20 xl:self-start">
            <PromoTotalsPanel quote={quote} totals={totals} showMargin={showCost} />
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Eye className="h-3.5 w-3.5" />Превью документа
            </div>
            <div className="max-h-[70vh] overflow-auto rounded-xl border border-border bg-white p-4">
              <style>{PROMO_DOC_CSS}</style>
              <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
            </div>
          </div>
        </div>
      </div>

      <Dialog open={!!snippetDraft} onOpenChange={(o) => !o && setSnippetDraft(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Сохранить блок в библиотеку</DialogTitle></DialogHeader>
          <Field label="Название блока">
            <Input
              value={snippetDraft?.name ?? ""}
              onChange={(e) => setSnippetDraft((d) => (d ? { ...d, name: e.target.value } : d))}
            />
          </Field>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSnippetDraft(null)}>Отмена</Button>
            <Button
              onClick={async () => {
                if (!snippetDraft?.name.trim()) return toast.error("Введите название");
                await saveSnippet({
                  data: {
                    name: snippetDraft.name.trim(),
                    description: "",
                    section: snippetDraft.section,
                    items: snippetDraft.items.map((it) => ({
                      section: it.section, title: it.title, unit: it.unit, qty: it.qty,
                      multiplier: it.multiplier, price: it.price, cost: it.cost, note: it.note,
                      exclude_from_commission: it.exclude_from_commission, sort_order: it.sort_order,
                    })) as unknown[],
                  },
                });
                setSnippetDraft(null);
                toast.success("Блок сохранён");
              }}
            >
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-3 text-sm">{children}</div>;
}
