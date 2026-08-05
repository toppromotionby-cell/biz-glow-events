// Редактор коммерческого предложения: форма слева, живое превью справа.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft, Download, ExternalLink, GripVertical, Plus, Search, Trash2, Eye, Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SaveStatus, type SaveState } from "@/components/admin/SaveStatus";
import { Field } from "@/components/admin/Field";
import { getQuote, saveQuote, searchCatalogForQuote, getQuoteDocSettings } from "@/lib/quotes.functions";
import {
  computeTotals, num, QUOTE_STATUSES, QUOTE_STATUS_LABELS,
  type Quote, type QuoteItem, type QuoteStatus,
} from "@/lib/quotes-model";
import { buildQuoteHtmlDoc, quoteNumberDisplay } from "@/lib/documents/quote-html";
import { DEFAULT_DOCUMENT_SETTINGS } from "@/lib/document-settings.functions";
import { fmtMoney } from "@/lib/formatters";
import { downloadAuthedFile, openAuthedDocument } from "@/lib/authed-fetch";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/documents/quotes/$id/")({ component: Page });

const CATALOG_TYPES = [
  { value: "all", label: "Весь каталог" },
  { value: "zones", label: "Зоны" },
  { value: "tech_equipment", label: "Техника" },
  { value: "services", label: "Услуги" },
  { value: "production_items", label: "Продакшн" },
];

function uid() {
  return globalThis.crypto?.randomUUID?.() ?? `tmp-${Math.random().toString(36).slice(2)}`;
}

function ImageField({ label, value, onChange }: { label: string; value: string | null; onChange: (v: string | null) => void }) {
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setBusy(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `documents/quotes/${uid()}.${ext}`;
      const { error } = await supabase.storage.from("catalog-media").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("catalog-media").getPublicUrl(path);
      onChange(data.publicUrl);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2">
        {value && <img src={value} alt={label} className="h-10 w-16 object-contain rounded border border-border/60 bg-background" />}
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? "Загрузка…" : value ? "Заменить" : "Загрузить"}
        </Button>
        {value && <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>Убрать</Button>}
        <input
          ref={inputRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }}
        />
      </div>
    </div>
  );
}

function Page() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const load = useServerFn(getQuote);
  const save = useServerFn(saveQuote);
  const searchCatalog = useServerFn(searchCatalogForQuote);
  const loadSettings = useServerFn(getQuoteDocSettings);

  const { data, isLoading, error } = useQuery({ queryKey: ["admin-quote", id], queryFn: () => load({ data: { id } }) });
  const { data: settings = DEFAULT_DOCUMENT_SETTINGS } = useQuery({ queryKey: ["admin-quote-settings"], queryFn: () => loadSettings() });

  const [quote, setQuote] = useState<Quote | null>(null);
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [state, setState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogType, setCatalogType] = useState("all");
  const [catalogTerm, setCatalogTerm] = useState("");
  const dirtyRef = useRef(false);

  useEffect(() => {
    if (data) { setQuote(data.quote); setItems(data.items); dirtyRef.current = false; setState("idle"); }
  }, [data]);

  const { data: hits = [] } = useQuery({
    queryKey: ["admin-quote-catalog", catalogTerm, catalogType],
    queryFn: () => searchCatalog({ data: { q: catalogTerm, type: catalogType === "all" ? undefined : catalogType } }),
    enabled: catalogOpen,
  });

  const totals = useMemo(
    () => (quote ? computeTotals(quote, items) : { subtotal: 0, discount: 0, delivery: 0, total: 0, prepayment: 0, balance: 0 }),
    [quote, items],
  );

  const patch = (p: Partial<Quote>) => { dirtyRef.current = true; setState("dirty"); setQuote((q) => (q ? { ...q, ...p } : q)); };
  const patchItems = (next: QuoteItem[]) => { dirtyRef.current = true; setState("dirty"); setItems(next); };

  // Автосохранение с дебаунсом.
  useEffect(() => {
    if (!quote || !dirtyRef.current) return;
    const t = setTimeout(async () => {
      setState("saving");
      try {
        await save({
          data: {
            id,
            patch: {
              status: quote.status, title: quote.title, doc_date: quote.doc_date, validity_days: quote.validity_days,
              client_name: quote.client_name ?? "", client_company: quote.client_company ?? "", client_unp: quote.client_unp ?? "",
              client_phone: quote.client_phone ?? "", client_email: quote.client_email ?? "", client_address: quote.client_address ?? "",
              event_date: quote.event_date, event_time_start: quote.event_time_start ?? "", event_time_end: quote.event_time_end ?? "",
              venue: quote.venue ?? "", guests_count: quote.guests_count, event_format: quote.event_format ?? "",
              setup_note: quote.setup_note ?? "", event_notes: quote.event_notes ?? "",
              company_overrides: quote.company_overrides as Record<string, string>,
              logo_url: quote.logo_url, signature_url: quote.signature_url, stamp_url: quote.stamp_url,
              texts: quote.texts as unknown as Record<string, string>,
              design: quote.design as unknown as Record<string, string | boolean>,
              discount_type: quote.discount_type, discount_value: num(quote.discount_value),
              prepayment_type: quote.prepayment_type, prepayment_value: num(quote.prepayment_value),
              delivery_amount: num(quote.delivery_amount), vat_note: quote.vat_note ?? "",
            },
            items: items.map((it, i) => ({
              section: it.section ?? "", title: it.title || "Позиция", description: it.description ?? "",
              qty: num(it.qty), unit: it.unit || "шт.", price: num(it.price), sort_order: i,
              entity_type: it.entity_type, entity_id: it.entity_id,
            })),
          },
        });
        dirtyRef.current = false;
        setState("saved");
        setSaveError(null);
        qc.invalidateQueries({ queryKey: ["admin-quotes"] });
      } catch (e) {
        setState("error");
        setSaveError((e as Error).message);
      }
    }, 1200);
    return () => clearTimeout(t);
  }, [quote, items, id, save, qc]);

  const previewHtml = useMemo(
    () => (quote ? buildQuoteHtmlDoc({ ...quote, total: totals.total }, items, settings) : ""),
    [quote, items, settings, totals.total],
  );

  if (isLoading) return <div className="p-8 text-muted-foreground">Загрузка…</div>;
  if (error || !quote) return <div className="p-8 text-destructive">{(error as Error)?.message ?? "КП не найдено"}</div>;

  const addItem = (init?: Partial<QuoteItem>) =>
    patchItems([
      ...items,
      {
        id: uid(), quote_id: id, section: "", title: "", description: "", qty: 1, unit: "шт.", price: 0,
        sort_order: items.length, entity_type: null, entity_id: null, ...init,
      },
    ]);

  const move = (index: number, dir: -1 | 1) => {
    const next = [...items];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    const a = next[index]!;
    next[index] = next[target]!;
    next[target] = a;
    patchItems(next);
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button asChild variant="ghost" size="icon"><Link to="/admin/documents/quotes"><ArrowLeft className="h-4 w-4" /></Link></Button>
          <div className="min-w-0">
            <h1 className="admin-h1 truncate">КП №{quoteNumberDisplay(quote)}</h1>
            <p className="text-xs text-muted-foreground truncate">{quote.client_company || quote.client_name || "Без клиента"} · {fmtMoney(totals.total)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <SaveStatus state={state} errorMessage={saveError} />
          <Select value={quote.status} onValueChange={(v) => patch({ status: v as QuoteStatus })}>
            <SelectTrigger className="w-[150px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {QUOTE_STATUSES.map((s) => <SelectItem key={s} value={s}>{QUOTE_STATUS_LABELS[s]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => openAuthedDocument(`/admin/documents/quotes/${id}/render`).catch((e) => toast.error((e as Error).message))}>
            <ExternalLink className="h-4 w-4 mr-1.5" />HTML
          </Button>
          <Button size="sm" onClick={() => downloadAuthedFile(`/admin/documents/quotes/${id}/render?format=pdf`).catch((e) => toast.error((e as Error).message))}>
            <Download className="h-4 w-4 mr-1.5" />PDF
          </Button>
        </div>
      </header>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* ЛЕВО: форма */}
        <div className="space-y-3">
          <Accordion type="multiple" defaultValue={["main", "client", "event", "items", "money"]} className="space-y-2">
            <AccordionItem value="main" className="border border-border/60 rounded-xl px-3">
              <AccordionTrigger className="text-sm font-medium">Документ</AccordionTrigger>
              <AccordionContent className="space-y-3 pb-4">
                <Field label="Тема предложения">
                  <Input value={quote.title ?? ""} onChange={(e) => patch({ title: e.target.value })} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Дата документа">
                    <Input type="date" value={quote.doc_date ?? ""} onChange={(e) => patch({ doc_date: e.target.value })} />
                  </Field>
                  <Field label="Срок действия, дней">
                    <Input type="number" min={0} max={365} value={quote.validity_days ?? 0}
                      onChange={(e) => patch({ validity_days: Math.trunc(num(e.target.value)) })} />
                  </Field>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="client" className="border border-border/60 rounded-xl px-3">
              <AccordionTrigger className="text-sm font-medium">Заказчик</AccordionTrigger>
              <AccordionContent className="grid grid-cols-2 gap-3 pb-4">
                <Field label="Компания"><Input value={quote.client_company ?? ""} onChange={(e) => patch({ client_company: e.target.value })} /></Field>
                <Field label="Контактное лицо"><Input value={quote.client_name ?? ""} onChange={(e) => patch({ client_name: e.target.value })} /></Field>
                <Field label="УНП"><Input value={quote.client_unp ?? ""} onChange={(e) => patch({ client_unp: e.target.value })} /></Field>
                <Field label="Телефон"><Input value={quote.client_phone ?? ""} onChange={(e) => patch({ client_phone: e.target.value })} /></Field>
                <Field label="E-mail"><Input value={quote.client_email ?? ""} onChange={(e) => patch({ client_email: e.target.value })} /></Field>
                <Field label="Адрес"><Input value={quote.client_address ?? ""} onChange={(e) => patch({ client_address: e.target.value })} /></Field>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="event" className="border border-border/60 rounded-xl px-3">
              <AccordionTrigger className="text-sm font-medium">Мероприятие</AccordionTrigger>
              <AccordionContent className="grid grid-cols-2 gap-3 pb-4">
                <Field label="Дата"><Input type="date" value={quote.event_date ?? ""} onChange={(e) => patch({ event_date: e.target.value || null })} /></Field>
                <Field label="Гостей">
                  <Input type="number" min={0} value={quote.guests_count ?? ""} onChange={(e) => patch({ guests_count: e.target.value === "" ? null : Math.trunc(num(e.target.value)) })} />
                </Field>
                <Field label="Время начала"><Input placeholder="18:00" value={quote.event_time_start ?? ""} onChange={(e) => patch({ event_time_start: e.target.value })} /></Field>
                <Field label="Время окончания"><Input placeholder="23:00" value={quote.event_time_end ?? ""} onChange={(e) => patch({ event_time_end: e.target.value })} /></Field>
                <Field label="Площадка" className="col-span-2"><Input value={quote.venue ?? ""} onChange={(e) => patch({ venue: e.target.value })} /></Field>
                <Field label="Формат" className="col-span-2"><Input placeholder="Корпоратив, свадьба, конференция…" value={quote.event_format ?? ""} onChange={(e) => patch({ event_format: e.target.value })} /></Field>
                <Field label="Монтаж / демонтаж" className="col-span-2"><Input value={quote.setup_note ?? ""} onChange={(e) => patch({ setup_note: e.target.value })} /></Field>
                <Field label="Комментарий" className="col-span-2"><Textarea rows={3} value={quote.event_notes ?? ""} onChange={(e) => patch({ event_notes: e.target.value })} /></Field>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="items" className="border border-border/60 rounded-xl px-3">
              <AccordionTrigger className="text-sm font-medium">Состав ({items.length})</AccordionTrigger>
              <AccordionContent className="space-y-2 pb-4">
                <div className="flex gap-2">
                  <Dialog open={catalogOpen} onOpenChange={setCatalogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm"><Search className="h-4 w-4 mr-1.5" />Из каталога</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader><DialogTitle>Добавить из каталога</DialogTitle></DialogHeader>
                      <div className="flex gap-2">
                        <Input placeholder="Поиск по названию" value={catalogTerm} onChange={(e) => setCatalogTerm(e.target.value)} />
                        <Select value={catalogType} onValueChange={setCatalogType}>
                          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {CATALOG_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="max-h-96 overflow-auto divide-y divide-border/60 rounded-md border border-border/60">
                        {hits.map((h) => (
                          <button key={`${h.entity_type}-${h.entity_id}`} type="button"
                            className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors"
                            onClick={() => { addItem({ title: h.title, price: h.price, unit: h.unit, description: h.description, entity_type: h.entity_type, entity_id: h.entity_id }); toast.success("Позиция добавлена"); }}>
                            <div className="text-sm font-medium">{h.title}</div>
                            <div className="text-xs text-muted-foreground">{fmtMoney(h.price)} / {h.unit}</div>
                          </button>
                        ))}
                        {!hits.length && <div className="p-4 text-sm text-muted-foreground">Ничего не найдено</div>}
                      </div>
                    </DialogContent>
                  </Dialog>
                  <Button variant="outline" size="sm" onClick={() => addItem()}><Plus className="h-4 w-4 mr-1.5" />Своя позиция</Button>
                </div>

                {items.map((it, i) => (
                  <div key={it.id} className="rounded-lg border border-border/60 p-2.5 space-y-2 bg-card/40">
                    <div className="flex items-start gap-2">
                      <div className="flex flex-col pt-1.5 text-muted-foreground">
                        <button type="button" className="hover:text-foreground" onClick={() => move(i, -1)} aria-label="Выше">▲</button>
                        <GripVertical className="h-3 w-3 opacity-40" />
                        <button type="button" className="hover:text-foreground" onClick={() => move(i, 1)} aria-label="Ниже">▼</button>
                      </div>
                      <div className="flex-1 space-y-2">
                        <Input placeholder="Название позиции" value={it.title}
                          onChange={(e) => patchItems(items.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
                        <Textarea rows={2} placeholder="Описание (необязательно)" value={it.description}
                          onChange={(e) => patchItems(items.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} />
                        <div className="grid grid-cols-4 gap-2">
                          <Input type="number" min={0} placeholder="Кол-во" value={it.qty}
                            onChange={(e) => patchItems(items.map((x, j) => (j === i ? { ...x, qty: num(e.target.value) } : x)))} />
                          <Input placeholder="Ед." value={it.unit}
                            onChange={(e) => patchItems(items.map((x, j) => (j === i ? { ...x, unit: e.target.value } : x)))} />
                          <Input type="number" min={0} placeholder="Цена" value={it.price}
                            onChange={(e) => patchItems(items.map((x, j) => (j === i ? { ...x, price: num(e.target.value) } : x)))} />
                          <div className="flex items-center justify-end text-sm tabular-nums font-medium">{fmtMoney(num(it.qty) * num(it.price))}</div>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => patchItems(items.filter((_, j) => j !== i))} aria-label="Удалить">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
                {!items.length && <p className="text-sm text-muted-foreground py-3">Позиции не добавлены</p>}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="money" className="border border-border/60 rounded-xl px-3">
              <AccordionTrigger className="text-sm font-medium">Скидка, доставка, предоплата</AccordionTrigger>
              <AccordionContent className="space-y-3 pb-4">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Тип скидки">
                    <Select value={quote.discount_type} onValueChange={(v) => patch({ discount_type: v as Quote["discount_type"] })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Без скидки</SelectItem>
                        <SelectItem value="percent">Процент</SelectItem>
                        <SelectItem value="amount">Сумма</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Значение скидки">
                    <Input type="number" min={0} disabled={quote.discount_type === "none"} value={quote.discount_value}
                      onChange={(e) => patch({ discount_value: num(e.target.value) })} />
                  </Field>
                  <Field label="Тип предоплаты">
                    <Select value={quote.prepayment_type} onValueChange={(v) => patch({ prepayment_type: v as Quote["prepayment_type"] })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Без предоплаты</SelectItem>
                        <SelectItem value="percent">Процент</SelectItem>
                        <SelectItem value="amount">Сумма</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Значение предоплаты">
                    <Input type="number" min={0} disabled={quote.prepayment_type === "none"} value={quote.prepayment_value}
                      onChange={(e) => patch({ prepayment_value: num(e.target.value) })} />
                  </Field>
                  <Field label="Доставка и логистика, BYN">
                    <Input type="number" min={0} value={quote.delivery_amount} onChange={(e) => patch({ delivery_amount: num(e.target.value) })} />
                  </Field>
                  <Field label="Примечание по НДС">
                    <Input value={quote.vat_note ?? ""} onChange={(e) => patch({ vat_note: e.target.value })} />
                  </Field>
                </div>
                <div className="rounded-lg bg-muted/40 p-3 text-sm space-y-1 tabular-nums">
                  <div className="flex justify-between"><span className="text-muted-foreground">Позиции</span><span>{fmtMoney(totals.subtotal)}</span></div>
                  {!!totals.discount && <div className="flex justify-between"><span className="text-muted-foreground">Скидка</span><span>− {fmtMoney(totals.discount)}</span></div>}
                  {!!totals.delivery && <div className="flex justify-between"><span className="text-muted-foreground">Доставка</span><span>{fmtMoney(totals.delivery)}</span></div>}
                  <div className="flex justify-between font-semibold text-base"><span>Итого</span><span>{fmtMoney(totals.total)}</span></div>
                  {!!totals.prepayment && (
                    <>
                      <div className="flex justify-between"><span className="text-muted-foreground">Предоплата</span><span>{fmtMoney(totals.prepayment)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Остаток</span><span>{fmtMoney(totals.balance)}</span></div>
                    </>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="texts" className="border border-border/60 rounded-xl px-3">
              <AccordionTrigger className="text-sm font-medium">Тексты документа</AccordionTrigger>
              <AccordionContent className="space-y-3 pb-4">
                {([
                  ["intro", "Вступление"],
                  ["included", "Что входит (по строке на пункт)"],
                  ["excluded", "Не входит (по строке на пункт)"],
                  ["timeline", "Сроки и логистика"],
                  ["terms", "Условия"],
                  ["footer", "Подпись внизу документа"],
                ] as const).map(([key, label]) => (
                  <Field key={key} label={label}>
                    <Textarea rows={key === "intro" ? 3 : 4} value={quote.texts[key] ?? ""}
                      onChange={(e) => patch({ texts: { ...quote.texts, [key]: e.target.value } })} />
                  </Field>
                ))}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="brand" className="border border-border/60 rounded-xl px-3">
              <AccordionTrigger className="text-sm font-medium"><span className="flex items-center gap-2"><Settings2 className="h-4 w-4" />Оформление и реквизиты</span></AccordionTrigger>
              <AccordionContent className="space-y-4 pb-4">
                <div className="grid grid-cols-2 gap-3">
                  {([
                    ["show_cover", "Титульный блок"],
                    ["show_requisites", "Реквизиты"],
                    ["show_signature", "Подписи"],
                    ["show_stamp", "Печать"],
                    ["show_logo", "Логотип"],
                    ["show_about", "Блок о компании"],
                  ] as const).map(([key, label]) => (
                    <label key={key} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm">
                      {label}
                      <Switch checked={!!quote.design[key]} onCheckedChange={(v) => patch({ design: { ...quote.design, [key]: v } })} />
                    </label>
                  ))}
                </div>
                <Field label="Акцентный цвет (HEX)">
                  <Input placeholder={settings.accent_color} value={quote.design.accent_color}
                    onChange={(e) => patch({ design: { ...quote.design, accent_color: e.target.value } })} />
                </Field>
                <div className="grid gap-3 sm:grid-cols-3">
                  <ImageField label="Логотип" value={quote.logo_url} onChange={(v) => patch({ logo_url: v })} />
                  <ImageField label="Подпись" value={quote.signature_url} onChange={(v) => patch({ signature_url: v })} />
                  <ImageField label="Печать" value={quote.stamp_url} onChange={(v) => patch({ stamp_url: v })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    ["company_legal_name", "Юр. название"],
                    ["company_brand", "Бренд"],
                    ["company_unp", "УНП"],
                    ["company_address", "Адрес"],
                    ["company_phone", "Телефон"],
                    ["company_email", "E-mail"],
                    ["bank_name", "Банк"],
                    ["bank_bic", "БИК"],
                    ["bank_account", "Расчётный счёт"],
                    ["signer_name", "Подписант"],
                    ["signer_title", "Должность подписанта"],
                  ] as const).map(([key, label]) => (
                    <Field key={key} label={label}>
                      <Input
                        placeholder={String(settings[key] ?? "")}
                        value={quote.company_overrides[key] ?? ""}
                        onChange={(e) => patch({ company_overrides: { ...quote.company_overrides, [key]: e.target.value } })}
                      />
                    </Field>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">Пустые поля берутся из общих настроек документов.</p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        {/* ПРАВО: живое превью */}
        <div className="xl:sticky xl:top-4 h-[calc(100vh-8rem)] rounded-xl border border-border/60 overflow-hidden bg-background">
          <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2 text-xs text-muted-foreground">
            <Eye className="h-3.5 w-3.5" /> Живое превью документа
          </div>
          <iframe title="Превью КП" srcDoc={previewHtml} className="w-full h-[calc(100%-2.25rem)] bg-white" />
        </div>
      </div>
    </div>
  );
}
