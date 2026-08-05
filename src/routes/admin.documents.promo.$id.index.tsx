// Редактор промо-КП: форма слева, живое превью справа, автосохранение.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft, Download, FileSpreadsheet, GripVertical, Plus, Save, Trash2, Loader2, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { StatusPill } from "@/components/admin/StatusPill";
import { getPromoQuote, savePromoQuote, savePromoTemplate } from "@/lib/promo-quotes.functions";
import {
  PROMO_STATUS_LABELS, PROMO_STATUSES, computePromoTotals, formatMoney, lineTotal,
  promoNumberDisplay, validatePromoQuote, type PromoItem, type PromoQuote, type PromoStatus,
} from "@/lib/promo-quote-model";
import { buildPromoQuoteBody, PROMO_DOC_CSS } from "@/lib/documents/promo-quote-html";
import { downloadAuthedFile } from "@/lib/authed-fetch";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/documents/promo/$id/")({ component: EditorPage });

function newItem(section = ""): PromoItem {
  return {
    id: crypto.randomUUID(),
    quote_id: "",
    section,
    title: "",
    unit: "услуга",
    qty: 1,
    multiplier: 1,
    price: 0,
    note: "",
    exclude_from_commission: false,
    sort_order: 0,
  };
}

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

  const { data, isLoading, error } = useQuery({
    queryKey: ["promo-quote", id],
    queryFn: () => get({ data: { id } }),
  });

  const [quote, setQuote] = useState<PromoQuote | null>(null);
  const [items, setItems] = useState<PromoItem[]>([]);
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (data) {
      setQuote(data.quote);
      setItems(data.items);
      setDirty(false);
    }
  }, [data]);

  const saveMut = useMutation({
    mutationFn: async (payload: { quote: PromoQuote; items: PromoItem[] }) => {
      const { id: _id, doc_number, created_at, updated_at, total, ...patch } = payload.quote;
      void _id; void doc_number; void created_at; void updated_at; void total;
      return save({
        data: {
          id,
          patch: patch as unknown as Record<string, unknown>,
          items: payload.items.map((it) => ({
            section: it.section, title: it.title, unit: it.unit, qty: it.qty,
            multiplier: it.multiplier, price: it.price, note: it.note,
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

  // автосохранение
  const scheduleSave = useCallback((q: PromoQuote, list: PromoItem[]) => {
    setDirty(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => saveMut.mutate({ quote: q, items: list }), 1200);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const patchQuote = (p: Partial<PromoQuote>) => {
    setQuote((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...p };
      scheduleSave(next, items);
      return next;
    });
  };
  const patchItems = (next: PromoItem[]) => {
    setItems(next);
    if (quote) scheduleSave(quote, next);
  };
  const patchItem = (idx: number, p: Partial<PromoItem>) =>
    patchItems(items.map((it, i) => (i === idx ? { ...it, ...p } : it)));

  const totals = useMemo(
    () => (quote ? computePromoTotals(quote, items) : null),
    [quote, items],
  );
  const problems = useMemo(
    () => (quote ? validatePromoQuote(quote, items) : []),
    [quote, items],
  );
  const previewHtml = useMemo(
    () => (quote ? buildPromoQuoteBody(quote, items) : ""),
    [quote, items],
  );

  const uploadLogo = async (file: File, field: "logo_url" | "client_logo_url") => {
    const path = `promo-quotes/${id}/${field}-${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
    const { error: upErr } = await supabase.storage.from("catalog-media").upload(path, file, { upsert: true });
    if (upErr) return toast.error(upErr.message);
    const { data: pub } = supabase.storage.from("catalog-media").getPublicUrl(path);
    patchQuote({ [field]: pub.publicUrl } as Partial<PromoQuote>);
    toast.success("Логотип загружен");
  };

  if (isLoading) return <div className="p-8 text-muted-foreground">Загрузка…</div>;
  if (error || !quote) return <div className="p-8 text-destructive">{(error as Error)?.message ?? "Документ не найден"}</div>;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        {/* header */}
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/admin/documents/promo"><ArrowLeft className="mr-1 h-4 w-4" />К списку</Link>
          </Button>
          <div className="mr-auto">
            <div className="font-semibold">{quote.project || "Без названия"}</div>
            <div className="text-xs text-muted-foreground">
              № {promoNumberDisplay(quote)} ·{" "}
              {saveMut.isPending ? "сохранение…" : dirty ? "есть несохранённые изменения" : savedAt ? `сохранено ${savedAt.toLocaleTimeString("ru-RU")}` : "все изменения сохранены"}
            </div>
          </div>
          <StatusPill tone={quote.status === "accepted" ? "success" : quote.status === "rejected" ? "danger" : quote.status === "sent" ? "info" : "muted"}>
            {PROMO_STATUS_LABELS[quote.status]}
          </StatusPill>
          <Button
            size="sm"
            variant="outline"
            onClick={() => saveMut.mutate({ quote, items })}
            disabled={saveMut.isPending}
          >
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
        </div>

        {problems.length > 0 && (
          <div className="rounded-lg border border-amber-400/40 bg-amber-500/10 p-3 text-sm text-amber-200">
            {problems.map((p) => <div key={p}>• {p}</div>)}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          {/* ЛЕВО: форма */}
          <div className="space-y-3">
            <Accordion type="multiple" defaultValue={["main", "items", "money"]} className="space-y-2">
              <AccordionItem value="main" className="rounded-xl border border-border px-3">
                <AccordionTrigger>Проект и клиент</AccordionTrigger>
                <AccordionContent className="space-y-3 pb-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Проект"><Input value={quote.project} onChange={(e) => patchQuote({ project: e.target.value })} /></Field>
                    <Field label="Клиент"><Input value={quote.client_name} onChange={(e) => patchQuote({ client_name: e.target.value })} /></Field>
                    <Field label="Период"><Input value={quote.period} onChange={(e) => patchQuote({ period: e.target.value })} placeholder="01.09 – 30.09.2026" /></Field>
                    <Field label="Место проведения"><Input value={quote.venue} onChange={(e) => patchQuote({ venue: e.target.value })} /></Field>
                    <Field label="Контактное лицо"><Input value={quote.contact_name} onChange={(e) => patchQuote({ contact_name: e.target.value })} /></Field>
                    <Field label="Должность"><Input value={quote.contact_role} onChange={(e) => patchQuote({ contact_role: e.target.value })} /></Field>
                    <Field label="Телефон"><Input value={quote.contact_phone} onChange={(e) => patchQuote({ contact_phone: e.target.value })} /></Field>
                    <Field label="E-mail"><Input value={quote.contact_email} onChange={(e) => patchQuote({ contact_email: e.target.value })} /></Field>
                  </div>
                  <Field label="Статус">
                    <Select value={quote.status} onValueChange={(v) => patchQuote({ status: v as PromoStatus })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PROMO_STATUSES.map((s) => <SelectItem key={s} value={s}>{PROMO_STATUS_LABELS[s]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="items" className="rounded-xl border border-border px-3">
                <AccordionTrigger>Позиции ({items.length})</AccordionTrigger>
                <AccordionContent className="space-y-2 pb-4">
                  {items.map((it, idx) => (
                    <div key={it.id} className="rounded-lg border border-border/70 p-2">
                      <div className="mb-2 flex items-center gap-2">
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                        <Input
                          value={it.section}
                          onChange={(e) => patchItem(idx, { section: e.target.value })}
                          placeholder="Раздел (напр. Персонал)"
                          className="h-8 max-w-[220px] text-xs"
                        />
                        <span className="ml-auto text-sm tabular-nums">{formatMoney(lineTotal(it), quote.currency)}</span>
                        <Button size="icon" variant="ghost" onClick={() => patchItems(items.filter((_, i) => i !== idx))}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-[1fr_110px_80px_80px_120px]">
                        <Input value={it.title} onChange={(e) => patchItem(idx, { title: e.target.value })} placeholder="Наименование" />
                        <Input value={it.unit} onChange={(e) => patchItem(idx, { unit: e.target.value })} placeholder="Ед. изм." />
                        <Input type="number" min={0} value={it.qty} onChange={(e) => patchItem(idx, { qty: Number(e.target.value) })} placeholder="Кол-во" />
                        <Input type="number" min={0} value={it.multiplier} onChange={(e) => patchItem(idx, { multiplier: Number(e.target.value) })} placeholder="×" />
                        <Input type="number" min={0} step="0.01" value={it.price} onChange={(e) => patchItem(idx, { price: Number(e.target.value) })} placeholder="Цена" />
                      </div>
                      <Textarea
                        value={it.note}
                        onChange={(e) => patchItem(idx, { note: e.target.value })}
                        placeholder="Примечание"
                        className="mt-2 min-h-[38px] text-xs"
                      />
                      <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <Switch checked={it.exclude_from_commission} onCheckedChange={(v) => patchItem(idx, { exclude_from_commission: v })} />
                        Не учитывать в комиссии
                      </label>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => patchItems([...items, newItem(items.at(-1)?.section ?? "")])}>
                    <Plus className="mr-1 h-4 w-4" />Добавить позицию
                  </Button>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="money" className="rounded-xl border border-border px-3">
                <AccordionTrigger>Расчёты и надбавки</AccordionTrigger>
                <AccordionContent className="space-y-3 pb-4">
                  <Row>
                    <span className="flex items-center gap-1">Комиссия агентства <Hint text="Процент считается от суммы позиций, кроме отмеченных «не учитывать в комиссии»." /></span>
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
                    <span className="flex items-center gap-1">Управление проектом <Hint text="Фиксированная сумма за менеджмент проекта — попадает отдельной строкой." /></span>
                    <Switch checked={quote.management_enabled} onCheckedChange={(v) => patchQuote({ management_enabled: v })} />
                  </Row>
                  {quote.management_enabled && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Field label="Название строки"><Input value={quote.management_label} onChange={(e) => patchQuote({ management_label: e.target.value })} /></Field>
                      <Field label="Сумма"><Input type="number" min={0} step="0.01" value={quote.management_amount} onChange={(e) => patchQuote({ management_amount: Number(e.target.value) })} /></Field>
                    </div>
                  )}
                  <Separator />
                  <Row>
                    <span>НДС</span>
                    <Switch checked={quote.vat_enabled} onCheckedChange={(v) => patchQuote({ vat_enabled: v })} />
                  </Row>
                  {quote.vat_enabled && (
                    <Field label="Ставка НДС, %"><Input type="number" min={0} max={30} step="0.1" value={quote.vat_rate} onChange={(e) => patchQuote({ vat_rate: Number(e.target.value) })} /></Field>
                  )}
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="view" className="rounded-xl border border-border px-3">
                <AccordionTrigger>Вид документа и брендинг</AccordionTrigger>
                <AccordionContent className="space-y-3 pb-4">
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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const name = window.prompt("Название шаблона", quote.project || "Шаблон промо-КП");
                      if (!name) return;
                      await saveTpl({ data: { id, name } });
                      toast.success("Шаблон сохранён");
                    }}
                  >
                    Сохранить как шаблон
                  </Button>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          {/* ПРАВО: превью */}
          <div className="space-y-3 lg:sticky lg:top-4 lg:self-start">
            {totals && (
              <div className="rounded-xl border border-border p-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Позиции</span><span className="tabular-nums">{formatMoney(totals.itemsSum, quote.currency)}</span></div>
                {quote.commission_enabled && <div className="flex justify-between"><span className="text-muted-foreground">{quote.commission_label}</span><span className="tabular-nums">{formatMoney(totals.commission, quote.currency)}</span></div>}
                {quote.management_enabled && <div className="flex justify-between"><span className="text-muted-foreground">{quote.management_label}</span><span className="tabular-nums">{formatMoney(totals.management, quote.currency)}</span></div>}
                {quote.vat_enabled && <div className="flex justify-between"><span className="text-muted-foreground">НДС {quote.vat_rate}%</span><span className="tabular-nums">{formatMoney(totals.vat, quote.currency)}</span></div>}
                <Separator className="my-2" />
                <div className="flex justify-between font-semibold"><span>Итого</span><span className="tabular-nums">{formatMoney(totals.totalWithVat, quote.currency)}</span></div>
              </div>
            )}
            <div className="max-h-[75vh] overflow-auto rounded-xl border border-border bg-white p-4">
              <style>{PROMO_DOC_CSS}</style>
              <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
            </div>
          </div>
        </div>
      </div>
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
