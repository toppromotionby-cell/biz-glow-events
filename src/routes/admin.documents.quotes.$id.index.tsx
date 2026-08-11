import { useRoles } from "@/hooks/use-roles";
import { DocFontSelect } from "@/components/admin/documents/DocFontSelect";
import { DetachedPreviewButton } from "@/components/admin/documents/DetachedPreviewButton";
import { QuoteSheetPanel } from "@/components/admin/documents/QuoteSheetPanel";
// Редактор коммерческого предложения: вкладки слева, живое превью справа.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  AlertTriangle, ArrowLeft, CheckCircle2, Download, ExternalLink, History, Plus, Search, Send,
  Settings2, Eye, BookmarkPlus, FileCheck2, MoreHorizontal, Brain, Presentation,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CompanyOverridesEditor } from "@/components/admin/CompanyOverridesEditor";
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
import { saveEstimateTemplate } from "@/lib/estimate-templates.functions";
import { createPresentation } from "@/lib/presentations.functions";

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
import { VatSettings } from "@/components/admin/VatSettings";
import { LogoHeaderDesigner } from "@/components/admin/LogoHeaderDesigner";
import { PrintPresetEditor } from "@/components/admin/documents/PrintPresetEditor";
import { CompanySelect } from "@/components/admin/documents/CompanySelect";
import { printOverridesToDesign, resolvePrintPreset } from "@/lib/documents/print-preset";
import { BlockEditDialog, type DocEditTarget } from "@/components/admin/documents/BlockEditDialog";
import { blockIssueMap, checkQuoteDocument, itemIssueMap } from "@/lib/documents/quote-checks";


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
  const saveSample = useServerFn(saveEstimateTemplate);

  const markSent = useServerFn(markQuoteSent);
  const sendToClient = useServerFn(sendQuoteToClient);
  const makeOrder = useServerFn(createOrderFromQuote);
  const makePresentation = useServerFn(createPresentation);

  const { data, isLoading, error } = useQuery({ queryKey: ["admin-quote", id], queryFn: () => load({ data: { id } }) });
  const activeCompanyId = data?.quote?.company_id ?? null;
  const { data: settings = DEFAULT_DOCUMENT_SETTINGS } = useQuery({
    queryKey: ["admin-quote-settings", activeCompanyId],
    queryFn: () => loadSettings({ data: { companyId: activeCompanyId } }),
  });
  const { data: versions = [] } = useQuery({ queryKey: ["admin-quote-versions", id], queryFn: () => loadVersions({ data: { quoteId: id } }) });

  const [quote, setQuote] = useState<Quote | null>(null);
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [state, setState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pending, setPending] = useState<string[]>([]);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogType, setCatalogType] = useState("all");
  const [catalogTerm, setCatalogTerm] = useState("");
  const { can } = useRoles();
  const canCost = can("documents.cost_margin");
  const [showCostRaw, setShowCost] = useState(true);
  const showCost = showCostRaw && canCost;
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const dirtyRef = useRef(false);
  const previewRef = useRef<HTMLIFrameElement>(null);
  const [inlineEdit, setInlineEdit] = useState(true);
  const [edit, setEdit] = useState<DocEditTarget | null>(null);

  // Двойной клик по блоку в превью открывает диалог редактирования этого блока.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== previewRef.current?.contentWindow) return;
      const d = e.data as { source?: string; type?: string; target?: string; id?: string | null };
      if (d?.source !== "doc-preview" || d.type !== "doc-edit" || !d.target) return;
      setEdit({ target: d.target, id: d.id ?? null });
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

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
  const checks = useMemo(
    () => (quote ? checkQuoteDocument(quote, items, settings) : []),
    [quote, items, settings],
  );
  const errorsCount = checks.filter((c) => c.level === "error").length;
  const warnsCount = checks.filter((c) => c.level === "warn").length;
  const itemIssues = useMemo(() => itemIssueMap(checks), [checks]);
  const blockIssues = useMemo(() => blockIssueMap(checks), [checks]);
  const [tab, setTab] = useState("items");

  // Переход от замечания к полю, которое его вызвало.
  const gotoCheck = (c: { scope?: string; refId?: string }) => {
    const target = c.scope === "item" ? "items" : c.scope === "client" ? "client" : c.scope === "totals" ? "money" : c.scope === "block" ? "doc" : "doc";
    setTab(target);
    if (!c.refId) return;
    setTimeout(() => {
      const el = document.querySelector(c.scope === "item" ? `[data-item-id="${c.refId}"]` : `#block-${c.refId}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
  };

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
              vat_mode: quote.vat_mode, vat_rate: num(quote.vat_rate), vat_as_line: quote.vat_as_line,
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
    () =>
      quote && totals
        ? buildQuoteHtmlDoc({ ...quote, total: totals.total }, items, settings, {
            editable: inlineEdit,
            checks,
          })
        : "",
    [quote, items, settings, totals, inlineEdit, checks],
  );


  if (isLoading) return <div className="p-8 text-muted-foreground">Загрузка…</div>;
  if (error || !quote || !totals) return <div className="p-8 text-destructive">{(error as Error)?.message ?? "КП не найдено"}</div>;

  const printPreset = resolvePrintPreset(quote.template, settings.quote_print_presets, quote.design);


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

  const onSaveSample = async () => {
    try {
      await saveSample({
        data: { source: "quote", docId: id, name: templateName.trim() || quote.title || "Образец сметы" },
      });
      setTemplateOpen(false);
      setTemplateName("");
      toast.success("Образец сметы сохранён");
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



  // Этап 5: собрать презентацию по позициям этого КП.
  const onBuildPresentation = async () => {
    try {
      const res = await makePresentation({
        data: {
          title: `Презентация · КП ${quoteNumberDisplay(quote)}`,
          companyId: quote.company_id ?? null,
          template: "light",
          quoteId: id,
        },
      });
      toast.success("Презентация создана по позициям КП");
      navigate({ to: "/admin/documents/presentations/$id", params: { id: res.id } });
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button asChild variant="ghost" size="icon"><Link to="/admin/documents"><ArrowLeft className="h-4 w-4" /></Link></Button>
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
          <QuoteShareActions
            share={shareState}
            onSend={onSendToClient}
            issues={checks.filter((c) => c.level === "error").map((c) => c.message)}
          />
          <Button size="sm" onClick={() => viewer.openDocument(`/admin/documents/quotes/${id}/render?format=pdf`, { name: "КП.pdf" })}>
            <Download className="h-4 w-4 mr-1.5" />PDF
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm"><MoreHorizontal className="h-4 w-4 mr-1.5" />Ещё</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuItem onClick={onMarkSent}>
                <Send className="mr-2 h-4 w-4" />Отметить «Отправлено»
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onCreateOrder}>
                <FileCheck2 className="mr-2 h-4 w-4" />{quote.order_id ? "Открыть заказ" : "Создать заказ"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onBuildPresentation}>
                <Presentation className="mr-2 h-4 w-4" />Собрать презентацию
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => viewer.openDocument(`/admin/documents/quotes/${id}/render`, { name: "КП.html" })}
              >
                <ExternalLink className="mr-2 h-4 w-4" />HTML-версия
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setTemplateOpen(true)}>
                <BookmarkPlus className="mr-2 h-4 w-4" />Сохранить в шаблоны
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/admin/documents/knowledge"><Brain className="mr-2 h-4 w-4" />База знаний подсказок</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* ЛЕВО: вкладки */}
        <div className="space-y-3">
          <DocStatusBar checks={checks} onGoto={gotoCheck} />
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="w-full justify-start overflow-x-auto">
              <TabsTrigger value="items">Состав ({items.length})</TabsTrigger>
              <TabsTrigger value="client">Клиент</TabsTrigger>
              <TabsTrigger value="money">Финансы</TabsTrigger>
              <TabsTrigger value="doc">Оформление</TabsTrigger>
            </TabsList>



            <TabsContent value="items" className="space-y-3 pt-3">
              <QuoteSheetPanel quoteId={id} />
              {canCost && (
                <label className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm">
                  Показывать себестоимость и маржу
                  <Switch checked={showCost} onCheckedChange={setShowCost} />
                </label>
              )}
              <QuoteItemsPanel
                items={items}
                onChange={patchItems}
                issues={itemIssues}
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
              <VatSettings
                value={{ mode: quote.vat_mode, rate: quote.vat_rate, asLine: quote.vat_as_line }}
                onChange={(v) =>
                  patch({
                    ...(v.mode !== undefined ? { vat_mode: v.mode } : {}),
                    ...(v.rate !== undefined ? { vat_rate: v.rate } : {}),
                    ...(v.asLine !== undefined ? { vat_as_line: v.asLine } : {}),
                  })
                }
              />
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
                    <QuoteBlocksEditor template={quote.template} blocks={quote.blocks} onChange={(p) => patch(p)} issues={blockIssues} />
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
                    <DocFontSelect
                      value={quote.font_family}
                      onChange={(font_family) => patch({ font_family })}
                    />
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

                    <div className="rounded-xl border border-border/60 p-3">
                      <p className="mb-2 text-sm font-medium">Печать: поля и интервалы</p>
                      <PrintPresetEditor
                        value={printPreset}
                        hint="Значения по умолчанию берутся из шаблона в настройках документов. Здесь — только для этого КП."
                        resetLabel="Вернуть настройки шаблона"
                        onReset={() => patch({ design: { ...quote.design, ...printOverridesToDesign(null) } })}
                        onChange={(next) => patch({ design: { ...quote.design, ...printOverridesToDesign(next) } })}
                      />
                    </div>

                    <LogoHeaderDesigner
                      label="Логотип"
                      hint="Любой формат — обрежем поля, подгоним размер и вставим в шапку КП (HTML и PDF)."
                      logoUrl={quote.logo_url}
                      onLogoChange={(v) => patch({ logo_url: v })}
                      layout={quote.logo_layout}
                      onLayoutChange={(l) => patch({ logo_layout: l })}
                      brand={quote.company_overrides.company_brand || settings.company_brand}
                      legalLine={`${quote.company_overrides.company_legal_name || settings.company_legal_name} · ${quote.company_overrides.company_address || settings.company_address}`}
                      accent={quote.design.accent_color || settings.accent_color}
                      docNum={quote.quote_number || "000"}
                    />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <ImageField label="Подпись" value={quote.signature_url} onChange={(v) => patch({ signature_url: v })} />
                      <ImageField label="Печать" value={quote.stamp_url} onChange={(v) => patch({ stamp_url: v })} />
                    </div>

                    <CompanySelect
                      value={quote.company_id}
                      onChange={(companyId) => patch({ company_id: companyId })}
                    />

                    <CompanyOverridesEditor
                      value={quote.company_overrides}
                      onChange={(v) => patch({ company_overrides: v })}
                      settings={settings}
                    />

                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="versions" className="border border-border/60 rounded-xl px-3">
                  <AccordionTrigger className="text-sm font-medium">
                    <span className="flex items-center gap-2"><History className="h-4 w-4" />История версий</span>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-2 pb-4">
                    <Button size="sm" variant="outline" onClick={onCreateVersion}>Сохранить версию</Button>
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
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

            </TabsContent>

          </Tabs>
        </div>

        {/* ПРАВО: живое превью */}
        <div className="xl:sticky xl:top-4 h-[calc(100vh-8rem)] rounded-xl border border-border/60 overflow-hidden bg-background">
          <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-2"><Eye className="h-3.5 w-3.5" /> Живое превью документа</span>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <Switch checked={inlineEdit} onCheckedChange={setInlineEdit} />
                <span>Редактирование двойным кликом</span>
              </label>
              <DetachedPreviewButton html={previewHtml} title={`Превью · ${quote.title || "КП"}`} />
            </div>
          </div>
          <iframe ref={previewRef} title="Превью КП" srcDoc={previewHtml} className="w-full h-[calc(100%-2.25rem)] bg-white" />
        </div>
      </div>

      <BlockEditDialog
        edit={edit}
        quote={quote}
        items={items}
        settings={settings}
        onClose={() => setEdit(null)}
        onSaveQuote={(p) => { patch(p); toast.success("Блок обновлён"); }}
        onSaveItems={(next) => { patchItems(next); toast.success("Позиция обновлена"); }}
      />

      <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Сохранить как шаблон</DialogTitle></DialogHeader>
          <Field label="Название шаблона">
            <Input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="Например: Корпоратив под ключ" />
          </Field>
          <p className="text-xs text-muted-foreground">
            Образец сметы доступен при создании любого документа — и КП, и КП промо.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateOpen(false)}>Отмена</Button>
            <Button variant="outline" onClick={onSaveSample}>Сохранить как образец</Button>
            <Button onClick={onSaveTemplate}>Сохранить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
