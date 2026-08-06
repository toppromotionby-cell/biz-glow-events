// Редактор коммерческого предложения: вкладки слева, живое превью справа.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  AlertTriangle, ArrowLeft, CheckCircle2, Download, ExternalLink, History, Plus, Search, Send,
  Settings2, Eye, BookmarkPlus, FileCheck2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SaveStatus, type SaveState } from "@/components/admin/SaveStatus";
import { Field } from "@/components/admin/Field";
import { BRAND_ACCENTS } from "@/lib/documents/brand";

import {
  getQuote, saveQuote, searchCatalogForQuote, getQuoteDocSettings,
  listQuoteVersions, createQuoteVersion, restoreQuoteVersion,
  saveQuoteAsTemplate, markQuoteSent, sendQuoteToClient, createOrderFromQuote,
} from "@/lib/quotes.functions";
import {
  checkQuote, computeTotals, emptyQuoteItem, num, quotePatchSchema, normalizeTime, QUOTE_STATUSES, QUOTE_STATUS_LABELS,
  type Quote, type QuoteItem, type QuoteStatus,
} from "@/lib/quotes-model";
import { friendlyZodMessage } from "@/lib/admin/zod-message";
import { buildQuoteHtmlDoc, quoteNumberDisplay } from "@/lib/documents/quote-html";
import { QuoteBlocksEditor } from "@/components/admin/quotes/QuoteBlocksEditor";
import { QuoteItemsPanel } from "@/components/admin/quotes/QuoteItemsPanel";
import { QuoteShareActions, QuoteShareStatus, type ShareState } from "@/components/admin/quotes/QuoteShareActions";
import { DEFAULT_DOCUMENT_SETTINGS } from "@/lib/document-settings.functions";
import { fmtMoney } from "@/lib/formatters";
import { useDocumentViewer } from "@/hooks/use-document-viewer";
import { supabase } from "@/integrations/supabase/client";
import { SuggestInput } from "@/components/admin/SuggestInput";
import { useDocSuggest } from "@/hooks/use-doc-suggest";

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

const PATCH_LABELS: Record<string, string> = {
  event_time_start: "Время начала",
  event_time_end: "Время окончания",
  doc_date: "Дата документа",
  event_date: "Дата мероприятия",
  client_email: "E-mail",
};

/**
 * Отбрасывает поля с промежуточным/некорректным значением, чтобы автосохранение
 * не падало целиком, пока пользователь дописывает время или дату.
 */
function sanitizeQuotePatch(raw: Record<string, unknown>): { patch: Record<string, unknown>; skipped: string[] } {
  const patch: Record<string, unknown> = {};
  const skipped: string[] = [];
  const shape = (quotePatchSchema as unknown as { shape: Record<string, { safeParse: (v: unknown) => { success: boolean } }> }).shape;
  for (const [key, value] of Object.entries(raw)) {
    const field = shape[key];
    if (field && !field.safeParse(value).success) {
      skipped.push(PATCH_LABELS[key] ?? key);
      continue;
    }
    patch[key] = value;
  }
  return { patch, skipped };
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
  const viewer = useDocumentViewer();
  const { id } = Route.useParams();
  const navigate = Route.useNavigate();
  const qc = useQueryClient();
  const load = useServerFn(getQuote);
  const save = useServerFn(saveQuote);
  const searchCatalog = useServerFn(searchCatalogForQuote);
  const loadSettings = useServerFn(getQuoteDocSettings);
  const loadVersions = useServerFn(listQuoteVersions);
  const makeVersion = useServerFn(createQuoteVersion);
  const rollback = useServerFn(restoreQuoteVersion);
  const makeTemplate = useServerFn(saveQuoteAsTemplate);
  const markSent = useServerFn(markQuoteSent);
  const sendToClient = useServerFn(sendQuoteToClient);
  const makeOrder = useServerFn(createOrderFromQuote);

  const { data, isLoading, error } = useQuery({ queryKey: ["admin-quote", id], queryFn: () => load({ data: { id } }) });
  const { data: settings = DEFAULT_DOCUMENT_SETTINGS } = useQuery({ queryKey: ["admin-quote-settings"], queryFn: () => loadSettings() });
  const { data: versions = [] } = useQuery({ queryKey: ["admin-quote-versions", id], queryFn: () => loadVersions({ data: { quoteId: id } }) });

  const [quote, setQuote] = useState<Quote | null>(null);
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [state, setState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pending, setPending] = useState<string[]>([]);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogType, setCatalogType] = useState("all");
  const [catalogTerm, setCatalogTerm] = useState("");
  const [showCost, setShowCost] = useState(true);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
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
    () => (quote ? computeTotals(quote, items) : null),
    [quote, items],
  );
  const checks = useMemo(() => (quote ? checkQuote(quote, items) : []), [quote, items]);
  const errorsCount = checks.filter((c) => c.level === "error").length;

  const patch = (p: Partial<Quote>) => { dirtyRef.current = true; setState("dirty"); setQuote((q) => (q ? { ...q, ...p } : q)); };
  const patchItems = (next: QuoteItem[]) => { dirtyRef.current = true; setState("dirty"); setItems(next); };
  const { fetchContacts } = useDocSuggest();

  // Автосохранение с дебаунсом.
  useEffect(() => {
    if (!quote || !dirtyRef.current) return;
    const t = setTimeout(async () => {
      setState("saving");
      try {
        const rawPatch: Record<string, unknown> = {
              status: quote.status, title: quote.title, doc_date: quote.doc_date, validity_days: quote.validity_days,
              quote_number: quote.quote_number ?? "", valid_until_override: quote.valid_until_override ?? null,
              client_name: quote.client_name ?? "", client_company: quote.client_company ?? "", client_unp: quote.client_unp ?? "",
              client_phone: quote.client_phone ?? "", client_email: quote.client_email ?? "", client_address: quote.client_address ?? "",
              event_date: quote.event_date, event_time_start: quote.event_time_start ?? "", event_time_end: quote.event_time_end ?? "",
              venue: quote.venue ?? "", guests_count: quote.guests_count, event_format: quote.event_format ?? "",
              setup_note: quote.setup_note ?? "", event_notes: quote.event_notes ?? "",
              company_overrides: quote.company_overrides as Record<string, string>,
              logo_url: quote.logo_url, signature_url: quote.signature_url, stamp_url: quote.stamp_url,
              texts: quote.texts as unknown as Record<string, string>,
              design: quote.design as unknown as Record<string, string | boolean>,
              template: quote.template, blocks: quote.blocks,
              discount_type: quote.discount_type, discount_value: num(quote.discount_value),
              prepayment_type: quote.prepayment_type, prepayment_value: num(quote.prepayment_value),
              delivery_amount: num(quote.delivery_amount), vat_note: quote.vat_note ?? "",
        };
        // Промежуточный ввод (например «18:0» или недописанная дата) не отправляем —
        // остальные поля сохраняются, а поле подсветится в списке проверок.
        const { patch, skipped } = sanitizeQuotePatch(rawPatch);
        await save({
          data: {
            id,
            patch,
            items: items.map((it, i) => ({
              section: it.section ?? "", title: it.title || "Позиция", description: it.description ?? "",
              includes: (it.includes ?? []).filter((x) => x.text.trim()),
              qty: num(it.qty), unit: it.unit || "шт.", price: num(it.price), cost: num(it.cost), sort_order: i,
              entity_type: it.entity_type, entity_id: it.entity_id,
            })),
          },
        });
        dirtyRef.current = false;
        setState("saved");
        setSaveError(null);
        setPending(skipped);
        qc.invalidateQueries({ queryKey: ["admin-quotes"] });
        // Пустой номер = автономер: перечитываем КП, чтобы подтянуть присвоенный БД номер.
        if (!String(patch.quote_number ?? "").trim()) qc.invalidateQueries({ queryKey: ["admin-quote", id] });
      } catch (e) {
        setState("error");
        setSaveError(friendlyZodMessage(e));
      }
    }, 1200);
    return () => clearTimeout(t);
  }, [quote, items, id, save, qc]);

  const previewHtml = useMemo(
    () => (quote && totals ? buildQuoteHtmlDoc({ ...quote, total: totals.total }, items, settings) : ""),
    [quote, items, settings, totals],
  );

  if (isLoading) return <div className="p-8 text-muted-foreground">Загрузка…</div>;
  if (error || !quote || !totals) return <div className="p-8 text-destructive">{(error as Error)?.message ?? "КП не найдено"}</div>;

  const addItem = (init?: Partial<QuoteItem>) =>
    patchItems([
      ...items,
      emptyQuoteItem(id, items.length, init),
    ]);

  const onCreateVersion = async () => {
    try {
      await makeVersion({ data: { quoteId: id, label: `Версия от ${new Date().toLocaleString("ru-RU")}` } });
      qc.invalidateQueries({ queryKey: ["admin-quote-versions", id] });
      toast.success("Версия сохранена");
    } catch (e) { toast.error((e as Error).message); }
  };

  const onRestore = async (versionId: string) => {
    try {
      await rollback({ data: { versionId } });
      await qc.invalidateQueries({ queryKey: ["admin-quote", id] });
      toast.success("Версия восстановлена");
    } catch (e) { toast.error((e as Error).message); }
  };

  const onSaveTemplate = async () => {
    try {
      await makeTemplate({ data: { id, name: templateName.trim() || quote.title || "Шаблон КП" } });
      setTemplateOpen(false);
      setTemplateName("");
      qc.invalidateQueries({ queryKey: ["admin-quotes"] });
      toast.success("Шаблон сохранён");
    } catch (e) { toast.error((e as Error).message); }
  };

  const onMarkSent = async () => {
    try {
      const res = await markSent({ data: { id } });
      setQuote((q) => (q ? { ...q, status: "sent", sent_at: res.sent_at } : q));
      qc.invalidateQueries({ queryKey: ["admin-quotes"] });
      toast.success("Отмечено как отправленное");
    } catch (e) { toast.error((e as Error).message); }
  };

  const shareState: ShareState = {
    token: quote.public_token,
    email: quote.client_email,
    sentAt: quote.sent_at,
    viewedAt: quote.viewed_at,
    clientResponse: quote.client_response,
    clientComment: quote.client_comment,
  };

  const onSendToClient = async (input: { email: string; note: string; attachPdf: boolean }) => {
    await sendToClient({ data: { id, ...input } });
    setQuote((q) => (q ? { ...q, sent_at: new Date().toISOString(), status: q.status === "draft" ? "sent" : q.status } : q));
    qc.invalidateQueries({ queryKey: ["admin-quotes"] });
  };

  const onCreateOrder = async () => {
    try {
      const res = await makeOrder({ data: { id } });
      setQuote((q) => (q ? { ...q, order_id: res.orderId } : q));
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      navigate({ to: "/admin/orders/$id", params: { id: res.orderId } });
    } catch (e) { toast.error((e as Error).message); }
  };



  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button asChild variant="ghost" size="icon"><Link to="/admin/documents/quotes"><ArrowLeft className="h-4 w-4" /></Link></Button>
          <div className="min-w-0">
            <h1 className="admin-h1 truncate">КП №{quoteNumberDisplay(quote)}</h1>
            <p className="text-xs text-muted-foreground truncate">
              {quote.client_company || quote.client_name || "Без клиента"} · {fmtMoney(totals.total)}
              {quote.sent_at ? ` · отправлено ${new Date(quote.sent_at).toLocaleDateString("ru-RU")}` : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SaveStatus state={state} errorMessage={saveError} />
          {pending.length > 0 && state !== "error" && (
            <span className="text-xs text-amber-500">Не сохранено (допишите значение): {pending.join(", ")}</span>
          )}
          <QuoteShareStatus share={shareState} />
          <Select value={quote.status} onValueChange={(v) => patch({ status: v as QuoteStatus })}>
            <SelectTrigger className="w-[150px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {QUOTE_STATUSES.map((s) => <SelectItem key={s} value={s}>{QUOTE_STATUS_LABELS[s]}</SelectItem>)}
            </SelectContent>
          </Select>
          <QuoteShareActions share={shareState} onSend={onSendToClient} />
          <Button variant="outline" size="sm" onClick={onMarkSent}><Send className="h-4 w-4 mr-1.5" />Отправлено</Button>
          <Button variant="outline" size="sm" onClick={() => setTemplateOpen(true)}><BookmarkPlus className="h-4 w-4 mr-1.5" />В шаблоны</Button>
          <Button variant="outline" size="sm" onClick={onCreateOrder}>
            <FileCheck2 className="h-4 w-4 mr-1.5" />{quote.order_id ? "Открыть заказ" : "Создать заказ"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => viewer.openDocument(`/admin/documents/quotes/${id}/render`, { name: "КП.html" })}>
            <ExternalLink className="h-4 w-4 mr-1.5" />HTML
          </Button>
          <Button size="sm" onClick={() => viewer.openDocument(`/admin/documents/quotes/${id}/render?format=pdf`, { name: "КП.pdf" })}>
            <Download className="h-4 w-4 mr-1.5" />PDF
          </Button>
        </div>
      </header>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* ЛЕВО: вкладки */}
        <div className="space-y-3">
          <Tabs defaultValue="items">
            <TabsList className="w-full justify-start overflow-x-auto">
              <TabsTrigger value="items">Состав ({items.length})</TabsTrigger>
              <TabsTrigger value="client">Клиент и событие</TabsTrigger>
              <TabsTrigger value="money">Финансы</TabsTrigger>
              <TabsTrigger value="doc">Документ</TabsTrigger>
              <TabsTrigger value="checks">
                Проверки
                {errorsCount > 0 && <Badge variant="destructive" className="ml-1.5 h-4 px-1 text-[10px]">{errorsCount}</Badge>}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="items" className="space-y-3 pt-3">
              <label className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm">
                Показывать себестоимость и маржу
                <Switch checked={showCost} onCheckedChange={setShowCost} />
              </label>
              <QuoteItemsPanel
                items={items}
                onChange={patchItems}
                showCost={showCost}
                toolbar={
                  <>
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
                  </>
                }
              />
            </TabsContent>

            <TabsContent value="client" className="space-y-4 pt-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Компания">
                  <SuggestInput
                    value={quote.client_company ?? ""}
                    onChange={(v) => patch({ client_company: v })}
                    fetcher={fetchContacts}
                    onPick={(h) => patch({
                      client_company: h.company || quote.client_company || "",
                      client_name: h.name || quote.client_name || "",
                      client_unp: h.unp || quote.client_unp || "",
                      client_phone: h.phone || quote.client_phone || "",
                      client_email: h.email || quote.client_email || "",
                      client_address: h.address || quote.client_address || "",
                    })}
                    render={(h) => (
                      <>
                        <div className="font-medium">{h.company || h.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {[h.name && h.company ? h.name : null, h.unp && `УНП ${h.unp}`, h.phone, h.email].filter(Boolean).join(" · ")}
                        </div>
                      </>
                    )}
                  />
                </Field>
                <Field label="Контактное лицо">
                  <SuggestInput
                    value={quote.client_name ?? ""}
                    onChange={(v) => patch({ client_name: v })}
                    fetcher={fetchContacts}
                    onPick={(h) => patch({
                      client_company: h.company || quote.client_company || "",
                      client_name: h.name || quote.client_name || "",
                      client_unp: h.unp || quote.client_unp || "",
                      client_phone: h.phone || quote.client_phone || "",
                      client_email: h.email || quote.client_email || "",
                      client_address: h.address || quote.client_address || "",
                    })}
                    render={(h) => (
                      <>
                        <div className="font-medium">{h.name || h.company}</div>
                        <div className="text-xs text-muted-foreground">{[h.company, h.phone, h.email].filter(Boolean).join(" · ")}</div>
                      </>
                    )}
                  />
                </Field>
                <Field label="УНП"><Input value={quote.client_unp ?? ""} onChange={(e) => patch({ client_unp: e.target.value })} /></Field>
                <Field label="Телефон"><Input value={quote.client_phone ?? ""} onChange={(e) => patch({ client_phone: e.target.value })} /></Field>
                <Field label="E-mail"><Input value={quote.client_email ?? ""} onChange={(e) => patch({ client_email: e.target.value })} /></Field>
                <Field label="Адрес"><Input value={quote.client_address ?? ""} onChange={(e) => patch({ client_address: e.target.value })} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Дата мероприятия"><Input type="date" value={quote.event_date ?? ""} onChange={(e) => patch({ event_date: e.target.value || null })} /></Field>
                <Field label="Гостей">
                  <Input type="number" min={0} value={quote.guests_count ?? ""} onChange={(e) => patch({ guests_count: e.target.value === "" ? null : Math.trunc(num(e.target.value)) })} />
                </Field>
                <Field label="Время начала">
                  <Input type="time" step={300} value={quote.event_time_start ?? ""}
                    onChange={(e) => patch({ event_time_start: e.target.value })}
                    onBlur={(e) => patch({ event_time_start: normalizeTime(e.target.value) })} />
                </Field>
                <Field label="Время окончания">
                  <Input type="time" step={300} value={quote.event_time_end ?? ""}
                    onChange={(e) => patch({ event_time_end: e.target.value })}
                    onBlur={(e) => patch({ event_time_end: normalizeTime(e.target.value) })} />
                </Field>
                <Field label="Площадка" className="col-span-2"><Input value={quote.venue ?? ""} onChange={(e) => patch({ venue: e.target.value })} /></Field>
                <Field label="Формат" className="col-span-2"><Input placeholder="Корпоратив, свадьба, конференция…" value={quote.event_format ?? ""} onChange={(e) => patch({ event_format: e.target.value })} /></Field>
                <Field label="Монтаж / демонтаж" className="col-span-2"><Input value={quote.setup_note ?? ""} onChange={(e) => patch({ setup_note: e.target.value })} /></Field>
                <Field label="Комментарий" className="col-span-2"><Textarea rows={3} value={quote.event_notes ?? ""} onChange={(e) => patch({ event_notes: e.target.value })} /></Field>
              </div>
            </TabsContent>

            <TabsContent value="money" className="space-y-3 pt-3">
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
                {showCost && totals.cost > 0 && (
                  <div className="mt-2 border-t border-border/60 pt-2 space-y-1">
                    <div className="flex justify-between"><span className="text-muted-foreground">Себестоимость</span><span>{fmtMoney(totals.cost)}</span></div>
                    <div className="flex justify-between font-medium">
                      <span>Маржа</span>
                      <span className={totals.marginPct < 15 ? "text-destructive" : ""}>
                        {fmtMoney(totals.margin)} · {totals.marginPct.toFixed(1)}%
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">Себестоимость видна только в админке и не попадает в документ.</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="doc" className="pt-3">
              <Accordion type="multiple" defaultValue={["main", "layout"]} className="space-y-2">
                <AccordionItem value="main" className="border border-border/60 rounded-xl px-3">
                  <AccordionTrigger className="text-sm font-medium">Шапка документа</AccordionTrigger>
                  <AccordionContent className="space-y-3 pb-4">
                    <Field label="Тема предложения">
                      <Input value={quote.title ?? ""} onChange={(e) => patch({ title: e.target.value })} />
                    </Field>
                    <Field label="Номер КП">
                      <div className="flex items-center gap-2">
                        <Input value={quote.quote_number ?? ""} placeholder="Присвоится автоматически"
                          onChange={(e) => patch({ quote_number: e.target.value })} />
                        <Button type="button" size="sm" variant="outline" className="shrink-0"
                          onClick={() => patch({ quote_number: "" })}>Автономер</Button>
                      </div>
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
                    <Field label="Действительно до (вручную)">
                      <div className="flex items-center gap-2">
                        <Input type="date" value={quote.valid_until_override ?? ""}
                          onChange={(e) => patch({ valid_until_override: e.target.value || null })} />
                        {quote.valid_until_override && (
                          <Button type="button" size="sm" variant="ghost" className="shrink-0"
                            onClick={() => patch({ valid_until_override: null })}>Сбросить</Button>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">Пусто — считается от даты документа и срока действия.</p>
                    </Field>
                  </AccordionContent>

                </AccordionItem>

                <AccordionItem value="layout" className="border border-border/60 rounded-xl px-3">
                  <AccordionTrigger className="text-sm font-medium">Шаблон и блоки документа</AccordionTrigger>
                  <AccordionContent className="pb-4">
                    <QuoteBlocksEditor template={quote.template} blocks={quote.blocks} onChange={(p) => patch(p)} />
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
                      <div className="flex items-center gap-2">
                        <Input placeholder={settings.accent_color} value={quote.design.accent_color}
                          onChange={(e) => patch({ design: { ...quote.design, accent_color: e.target.value } })} />
                        <div className="flex items-center gap-1.5 shrink-0">
                          {BRAND_ACCENTS.map((c) => (
                            <button key={c.hex} type="button" title={`${c.label} ${c.hex}`}
                              onClick={() => patch({ design: { ...quote.design, accent_color: c.hex } })}
                              className="h-7 w-7 rounded-full border border-border/60 transition hover:scale-110"
                              style={{ background: c.hex }} />
                          ))}
                        </div>
                      </div>
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
                        ["company_website", "Сайт"],
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
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">Пустые поля берутся из общих настроек документов.</p>
                      <Button type="button" size="sm" variant="ghost" className="shrink-0"
                        onClick={() => patch({ company_overrides: {} })}>Сбросить реквизиты</Button>
                    </div>

                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </TabsContent>

            <TabsContent value="checks" className="space-y-4 pt-3">
              <div className="rounded-xl border border-border/60 p-3 space-y-2">
                <h2 className="text-sm font-medium">Проверка перед отправкой</h2>
                {!checks.length && (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />Всё заполнено, можно отправлять клиенту
                  </p>
                )}
                {checks.map((c, i) => (
                  <p key={i} className={`flex items-start gap-2 text-sm ${c.level === "error" ? "text-destructive" : "text-muted-foreground"}`}>
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{c.message}
                  </p>
                ))}
              </div>

              <div className="rounded-xl border border-border/60 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-sm font-medium"><History className="h-4 w-4" />История версий</h2>
                  <Button size="sm" variant="outline" onClick={onCreateVersion}>Сохранить версию</Button>
                </div>
                {!versions.length && <p className="text-sm text-muted-foreground">Версий пока нет</p>}
                {versions.map((v) => (
                  <div key={v.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/50 px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <div className="truncate">{v.label || new Date(v.created_at).toLocaleString("ru-RU")}</div>
                      <div className="text-xs text-muted-foreground tabular-nums">{fmtMoney(v.total)}</div>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => onRestore(v.id)}>Восстановить</Button>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* ПРАВО: живое превью */}
        <div className="xl:sticky xl:top-4 h-[calc(100vh-8rem)] rounded-xl border border-border/60 overflow-hidden bg-background">
          <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2 text-xs text-muted-foreground">
            <Eye className="h-3.5 w-3.5" /> Живое превью документа
          </div>
          <iframe title="Превью КП" srcDoc={previewHtml} className="w-full h-[calc(100%-2.25rem)] bg-white" />
        </div>
      </div>

      <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Сохранить как шаблон</DialogTitle></DialogHeader>
          <Field label="Название шаблона">
            <Input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="Например: Корпоратив под ключ" />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateOpen(false)}>Отмена</Button>
            <Button onClick={onSaveTemplate}>Сохранить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
