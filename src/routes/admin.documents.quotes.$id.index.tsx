import { useRoles } from "@/hooks/use-roles";
import { DetachedPreviewButton } from "@/components/admin/documents/DetachedPreviewButton";
import { LivePreviewFrame } from "@/components/admin/documents/LivePreviewFrame";
import { useInlineDocEdit } from "@/hooks/use-inline-doc-edit";
import { QuoteSheetPanel } from "@/components/admin/documents/QuoteSheetPanel";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import { deleteDocument } from "@/lib/documents-overview.functions";
// Редактор коммерческого предложения: вкладки слева, живое превью справа.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { signatureAvailability } from "@/lib/documents/signature";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminKeys } from "@/lib/query-keys";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Download, ExternalLink, History, Plus, Search, Send, ListTree, User, Wallet, ShieldCheck,
  Settings2, Eye, BookmarkPlus, FileCheck2, MoreHorizontal, Brain, Presentation, Trash2, Calculator,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SendToTelegramButton } from "@/components/admin/SendToTelegramButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SaveStatus } from "@/components/admin/SaveStatus";
import { useEditorSave } from "@/hooks/use-editor-save";

import { Field } from "@/components/admin/Field";
import { EconomicsPanel } from "@/components/admin/documents/EconomicsPanel";
import { quoteEconRows } from "@/lib/documents/economics-source";
import { buildEconomicsSheetDoc } from "@/lib/documents/economics-sheet";
import { normalizeCostMode } from "@/lib/documents/economics";
import { DocEditorShell } from "@/components/admin/editor/DocEditorShell";
import type { EditorSection } from "@/components/admin/editor/EditorSidebar";

import {
  getQuote, saveQuote, searchCatalogForQuote, getQuoteDocSettings,
  listQuoteVersions, createQuoteVersion, restoreQuoteVersion,
  saveQuoteAsTemplate, markQuoteSent, sendQuoteToClient, createOrderFromQuote,
} from "@/lib/quotes.functions";
import { saveEstimateTemplate } from "@/lib/estimate-templates.functions";
import { QuoteStoryboardDialog } from "@/components/admin/presentations/QuoteStoryboardDialog";

import {
  checkQuote, computeTotals, emptyQuoteItem, num, quotePatchSchema, normalizeTime, QUOTE_STATUSES, QUOTE_STATUS_LABELS,
  type Quote, type QuoteItem, type QuoteStatus,
} from "@/lib/quotes-model";
import { friendlyZodMessage } from "@/lib/admin/zod-message";
import { buildQuoteHtmlDoc, quoteNumberDisplay } from "@/lib/documents/quote-html";
import { buildMarginCols } from "@/lib/documents/margin-cols";
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
import { printOverridesToDesign, resolvePrintPreset } from "@/lib/documents/print-preset";
import { BlockEditDialog, type DocEditTarget } from "@/components/admin/documents/BlockEditDialog";
import { blockIssueMap, checkQuoteDocument, itemIssueMap } from "@/lib/documents/quote-checks";
import { DocStatusBar } from "@/components/admin/documents/DocStatusBar";
import { DocVersionsPanel } from "@/components/admin/documents/DocVersionsPanel";
import { SaveToLibraryDialog } from "@/components/admin/documents/SaveToLibraryDialog";
import { DocAppearanceSection } from "@/components/admin/documents/DocAppearanceSection";




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
  const { confirm, dialog: confirmDialog } = useConfirm();
  const removeDoc = useServerFn(deleteDocument);
  const onDeleteDocument = async () => {
    const ok = await confirm({
      title: "Удалить КП?",
      description: "КП и его позиции будут удалены безвозвратно.",
    });
    if (!ok) return;
    try {
      await removeDoc({ data: { kind: "quote", id } });
      toast.success("КП удалено");
      void navigate({ to: "/admin/documents" });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
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
  const [storyboardOpen, setStoryboardOpen] = useState(false);

  const { data, isLoading, error } = useQuery({ queryKey: adminKeys.quote(id), queryFn: () => load({ data: { id } }) });
  const activeCompanyId = data?.quote?.company_id ?? null;
  const { data: settings = DEFAULT_DOCUMENT_SETTINGS } = useQuery({
    queryKey: ["admin-quote-settings", activeCompanyId],
    queryFn: () => loadSettings({ data: { companyId: activeCompanyId } }),
  });
  const { data: versions = [] } = useQuery({ queryKey: adminKeys.quoteVersions(id), queryFn: () => loadVersions({ data: { quoteId: id } }) });

  const [quote, setQuote] = useState<Quote | null>(null);
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [pending, setPending] = useState<string[]>([]);

  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogType, setCatalogType] = useState("all");
  const [catalogTerm, setCatalogTerm] = useState("");
  const { can } = useRoles();
  const canCost = can("documents.cost_margin");
  const [showCostRaw, setShowCost] = useState(true);
  const [internalView, setInternalView] = useState(false);
  // Альбомный лист с колонками «Себестоимость / Прибыль / %» прямо в КП.
  const [wideMargin, setWideMargin] = useState(false);
  const showCost = showCostRaw && canCost;
  const [templateOpen, setTemplateOpen] = useState(false);
  const dirtyRef = useRef(false);
  const previewRef = useRef<HTMLIFrameElement>(null);
  const [inlineEdit, setInlineEdit] = useState(true);
  const [edit, setEdit] = useState<DocEditTarget | null>(null);

  // Двойной клик по блоку в превью открывает диалог редактирования этого блока.
  useInlineDocEdit({ enabled: inlineEdit, onEdit: (hit) => setEdit(hit), frameRef: previewRef });

  useEffect(() => {
    if (data) { setQuote(data.quote); setItems(data.items); dirtyRef.current = false; saverRef.current.reset(); }
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
  // Подпись и печать предлагаем только когда картинка загружена в КП или карточке компании.
  const quoteSign = useMemo(
    () =>
      signatureAvailability({
        docSignatureUrl: quote?.signature_url ?? null,
        docStampUrl: quote?.stamp_url ?? null,
        companySignatureUrl: (settings as { signature_url?: string | null }).signature_url ?? null,
        companyStampUrl: (settings as { stamp_url?: string | null }).stamp_url ?? null,
      }),
    [quote?.signature_url, quote?.stamp_url, settings],
  );
  const [tab, setTab] = useState<string | null>("items");


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

  const patch = (p: Partial<Quote>) => { dirtyRef.current = true; saverRef.current.markDirty(); setQuote((q) => (q ? { ...q, ...p } : q)); };
  const patchItems = (next: QuoteItem[]) => { dirtyRef.current = true; saverRef.current.markDirty(); setItems(next); };

  const { fetchContacts } = useDocSuggest();

  // Автосохранение: общий хук (дебаунс, Ctrl+S, защита от ухода со страницы).
  const quoteRef = useRef<Quote | null>(quote);
  quoteRef.current = quote;
  const itemsRef = useRef<QuoteItem[]>(items);
  itemsRef.current = items;

  const saver = useEditorSave(async () => {
    const q = quoteRef.current;
    if (!q) return;
    const list = itemsRef.current;
    const rawPatch: Record<string, unknown> = {
      status: q.status, title: q.title, doc_date: q.doc_date, validity_days: q.validity_days,
      quote_number: q.quote_number ?? "", valid_until_override: q.valid_until_override ?? null,
      client_name: q.client_name ?? "", client_company: q.client_company ?? "", client_unp: q.client_unp ?? "",
      client_phone: q.client_phone ?? "", client_email: q.client_email ?? "", client_address: q.client_address ?? "",
      event_date: q.event_date, event_time_start: q.event_time_start ?? "", event_time_end: q.event_time_end ?? "",
      venue: q.venue ?? "", guests_count: q.guests_count, event_format: q.event_format ?? "",
      setup_note: q.setup_note ?? "", event_notes: q.event_notes ?? "",
      company_overrides: q.company_overrides as Record<string, string>,
      logo_url: q.logo_url, signature_url: q.signature_url, stamp_url: q.stamp_url,
      texts: q.texts as unknown as Record<string, string>,
      design: q.design as unknown as Record<string, string | boolean>,
      template: q.template, blocks: q.blocks,
      discount_type: q.discount_type, discount_value: num(q.discount_value),
      prepayment_type: q.prepayment_type, prepayment_value: num(q.prepayment_value),
      delivery_amount: num(q.delivery_amount), vat_note: q.vat_note ?? "",
      vat_mode: q.vat_mode, vat_rate: num(q.vat_rate), vat_as_line: q.vat_as_line,
      management_type: q.management_type, management_value: num(q.management_value),
      agency_fee_type: q.agency_fee_type, agency_fee_value: num(q.agency_fee_value),
    };
    // Промежуточный ввод (например «18:0» или недописанная дата) не отправляем —
    // остальные поля сохраняются, а поле подсветится в списке проверок.
    const { patch: safePatch, skipped } = sanitizeQuotePatch(rawPatch);
    try {
      await save({
        data: {
          id,
          patch: safePatch,
          items: list.map((it, i) => ({
            section: it.section ?? "", title: it.title || "Позиция", description: it.description ?? "",
            includes: (it.includes ?? []).filter((x) => x.text.trim()),
            qty: num(it.qty), unit: it.unit || "шт.", price: num(it.price), cost: num(it.cost), sort_order: i,
            entity_type: it.entity_type, entity_id: it.entity_id,
          })),
        },
      });
    } catch (e) {
      throw new Error(friendlyZodMessage(e));
    }
    dirtyRef.current = false;
    setPending(skipped);
    qc.invalidateQueries({ queryKey: adminKeys.quotesAll });
    qc.invalidateQueries({ queryKey: adminKeys.documents });
    // Пустой номер = автономер: перечитываем КП, чтобы подтянуть присвоенный БД номер.
    if (!String(safePatch.quote_number ?? "").trim()) qc.invalidateQueries({ queryKey: adminKeys.quote(id) });
  });
  const saverRef = useRef(saver);
  saverRef.current = saver;


  // Только что добавленные пустые строки не подсвечиваем в превью —
  // замечания по ним остаются во вкладке «Проверки».
  const previewChecks = useMemo(() => {
    const pristine = new Set(
      items
        .filter(
          (it) =>
            !it.title.trim() && !it.description?.trim() && !num(it.price) && !num(it.cost) && !it.includes.length,
        )
        .map((it) => it.id),
    );
    return checks.filter((c) => !(c.refId && pristine.has(c.refId)));
  }, [checks, items]);

  const clientHtml = useMemo(
    () =>
      quote && totals
        ? buildQuoteHtmlDoc({ ...quote, total: totals.total }, items, settings, {
            editable: inlineEdit,
            checks: previewChecks,
            ...(canCost && wideMargin && !internalView
              ? { margin: buildMarginCols(quoteEconRows(items)), landscape: true }
              : {}),
          })
        : "",
    [quote, items, settings, totals, inlineEdit, previewChecks, canCost, wideMargin, internalView],
  );
  // Внутренний вид превью: себестоимость и прибыль по каждой строке.
  const internalHtml = useMemo(
    () =>
      quote && totals && canCost && internalView
        ? buildEconomicsSheetDoc(
            {
              docLabel: `КП №${quoteNumberDisplay(quote)}`,
              client: quote.client_company || quote.client_name || undefined,
            },
            quoteEconRows(items),
            totals.net,
          )
        : "",
    [quote, items, totals, canCost, internalView],
  );
  const showInternal = canCost && internalView;
  const previewHtml = showInternal ? internalHtml : clientHtml;


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
      qc.invalidateQueries({ queryKey: adminKeys.quoteVersions(id) });
      toast.success("Версия сохранена");
    } catch (e) { toast.error((e as Error).message); }
  };

  const onRestore = async (versionId: string) => {
    try {
      await rollback({ data: { versionId } });
      await qc.invalidateQueries({ queryKey: adminKeys.quote(id) });
      toast.success("Версия восстановлена");
    } catch (e) { toast.error((e as Error).message); }
  };

  const onSaveToLibrary = async (name: string, scope: "shared" | "type") => {
    try {
      if (scope === "shared") {
        await saveSample({ data: { source: "quote", docId: id, name } });
        toast.success("Образец сметы сохранён");
      } else {
        await makeTemplate({ data: { id, name } });
        qc.invalidateQueries({ queryKey: adminKeys.quotesAll });
    qc.invalidateQueries({ queryKey: adminKeys.documents });
        toast.success("Шаблон сохранён");
      }
    } catch (e) { toast.error((e as Error).message); }
  };

  const onMarkSent = async () => {
    try {
      const res = await markSent({ data: { id } });
      setQuote((q) => (q ? { ...q, status: "sent", sent_at: res.sent_at } : q));
      qc.invalidateQueries({ queryKey: adminKeys.quotesAll });
    qc.invalidateQueries({ queryKey: adminKeys.documents });
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
    qc.invalidateQueries({ queryKey: adminKeys.quotesAll });
    qc.invalidateQueries({ queryKey: adminKeys.documents });
  };

  const onCreateOrder = async () => {
    try {
      const res = await makeOrder({ data: { id } });
      setQuote((q) => (q ? { ...q, order_id: res.orderId } : q));
      qc.invalidateQueries({ queryKey: adminKeys.ordersAll });
      navigate({ to: "/admin/orders/$id", params: { id: res.orderId } });
    } catch (e) { toast.error((e as Error).message); }
  };



  // Сборка презентации из КП — через окно сценария (сториборд).

  const sections: EditorSection[] = [
    {
      id: "items",
      label: "Состав",
      Icon: ListTree,
      wide: true,
      dot: !!itemIssues.size,
      content: (
        <div className="space-y-3">
          <QuoteSheetPanel quoteId={id} />
          {canCost && (
            <label className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm">
              Себестоимость и маржа
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
        </div>
      ),
    },
    {
      id: "client",
      label: "Клиент",
      Icon: User,
      content: (
        <div className="space-y-4">
          <div className="grid-fields">


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
              <div className="grid-fields">
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
        </div>
      ),
    },
    ...(canCost
      ? [{
          id: "economics",
          label: "Экономика",
          Icon: Calculator,
          wide: true,
          content: (
            <EconomicsPanel
              docTitle={`КП ${quoteNumberDisplay(quote)}`}
              netRevenue={totals?.net}
              rows={items.map((it) => ({
                id: it.id,
                section: it.section,
                title: it.title,
                qty: num(it.qty),
                qtyLabel: `${num(it.qty)} ${it.unit}`,
                price: num(it.price),
                unitCost: num(it.cost),
                costMode: normalizeCostMode(it.cost_mode),
                costInput: num(it.cost_input),
              }))}
            />
          ),
        } as EditorSection]
      : []),
    {
      id: "money",
      label: "Финансы",
      Icon: Wallet,
      content: (
        <div className="space-y-3">
          <div className="grid-fields">

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
                <Field label="Менеджмент">
                  <Select value={quote.management_type} onValueChange={(v) => patch({ management_type: v as Quote["management_type"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Не начисляется</SelectItem>
                      <SelectItem value="percent">Процент</SelectItem>
                      <SelectItem value="amount">Сумма</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label={quote.management_type === "percent" ? "Менеджмент, %" : "Менеджмент, BYN"}>
                  <Input type="number" min={0} disabled={quote.management_type === "none"} value={quote.management_value}
                    onChange={(e) => patch({ management_value: num(e.target.value) })} />
                </Field>
                <Field label="Комиссия агентства">
                  <Select value={quote.agency_fee_type} onValueChange={(v) => patch({ agency_fee_type: v as Quote["agency_fee_type"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Не начисляется</SelectItem>
                      <SelectItem value="percent">Процент</SelectItem>
                      <SelectItem value="amount">Сумма</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label={quote.agency_fee_type === "percent" ? "Комиссия, %" : "Комиссия, BYN"}>
                  <Input type="number" min={0} disabled={quote.agency_fee_type === "none"} value={quote.agency_fee_value}
                    onChange={(e) => patch({ agency_fee_value: num(e.target.value) })} />
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
                {totals.feeLines.map((f) => (
                  <div key={f.key} className="flex justify-between">
                    <span className="text-muted-foreground">{f.label}<span className="ml-1 text-[11px] opacity-70">{f.hint}</span></span>
                    <span>{fmtMoney(f.amount)}</span>
                  </div>
                ))}
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
        </div>
      ),
    },
    {
      id: "doc",
      label: "Оформление",
      Icon: Settings2,
      dot: !!blockIssues.size,
      content: (
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
                    <div className="grid-fields">
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
                    <DocAppearanceSection
                      toggles={([
                        ["show_cover", "Титульный блок"],
                        ["show_requisites", "Реквизиты"],
                        ["show_signature", "Блок подписи"],
                        ["show_stamp", "Накладывать печать"],
                        ["show_logo", "Логотип"],
                        ["show_about", "Блок о компании"],
                      ] as const)
                        // Печать предлагаем только когда её изображение реально загружено.
                        .filter(([key]) => (key === "show_stamp" ? quoteSign.hasStamp : true))

                        .map(([key, label]) => ({
                        key, label,
                        value: !!quote.design[key],
                        onChange: (v: boolean) => patch({ design: { ...quote.design, [key]: v } }),
                      }))}

                      fontFamily={quote.font_family}
                      onFontChange={(font_family) => patch({ font_family })}
                      accent={quote.design.accent_color}
                      accentPlaceholder={settings.accent_color}
                      onAccentChange={(accent_color) => patch({ design: { ...quote.design, accent_color } })}
                      print={{
                        value: printPreset,
                        onReset: () => patch({ design: { ...quote.design, ...printOverridesToDesign(null) } }),
                        onChange: (next) => patch({ design: { ...quote.design, ...printOverridesToDesign(next) } }),
                      }}
                      logo={{
                        label: "Логотип",
                        hint: "Любой формат — обрежем поля, подгоним размер и вставим в шапку КП (HTML и PDF).",
                        url: quote.logo_url,
                        onChange: (v) => patch({ logo_url: v }),
                        layout: quote.logo_layout,
                        onLayoutChange: (l) => patch({ logo_layout: l }),
                        brand: quote.company_overrides.company_brand || settings.company_brand,
                        legalLine: `${quote.company_overrides.company_legal_name || settings.company_legal_name} · ${quote.company_overrides.company_address || settings.company_address}`,
                        docNum: quote.quote_number || "000",
                      }}
                      companyId={quote.company_id}
                      onCompanyChange={(companyId) => patch({ company_id: companyId })}
                      overrides={quote.company_overrides}
                      onOverridesChange={(v) => patch({ company_overrides: v })}
                      settings={settings}
                      extra={
                        <div className="grid gap-3 sm:grid-cols-2">
                          <ImageField label="Подпись" value={quote.signature_url} onChange={(v) => patch({ signature_url: v })} />
                          <ImageField label="Печать" value={quote.stamp_url} onChange={(v) => patch({ stamp_url: v })} />
                        </div>
                      }
                    />


                  </AccordionContent>
                </AccordionItem>

              </Accordion>
      ),
    },
    {
      id: "checks",
      label: "Проверка",
      Icon: ShieldCheck,
      dot: errorsCount + warnsCount > 0,
      content: <DocStatusBar checks={checks} onGoto={gotoCheck} />,
    },
    {
      id: "versions",
      label: "История",
      Icon: History,
      content: (
        <DocVersionsPanel
          versions={versions.map((v) => ({
            id: v.id,
            label: v.label || new Date(v.created_at).toLocaleString("ru-RU"),
            subtitle: fmtMoney(v.total),
          }))}
          onCreate={onCreateVersion}
          onRestore={onRestore}
        />
      ),
    },
  ];

  return (
    <DocEditorShell
      sections={sections}
      active={tab}
      onActiveChange={setTab}
      hint="Двойной клик по блоку в листе открывает его редактирование"
      title={
        <Input
          value={quote.title ?? ""}
          onChange={(e) => patch({ title: e.target.value })}
          placeholder={`КП №${quoteNumberDisplay(quote)}`}
          className="h-8 max-w-[380px] border-transparent bg-transparent px-1 text-base font-semibold shadow-none focus-visible:border-input"
        />
      }
      subtitle={
        <>
          <span>КП №{quoteNumberDisplay(quote)}</span>
          <span>·</span>
          <span>{quote.client_company || quote.client_name || "Без клиента"}</span>
          <span>·</span>
          <span className="tabular-nums">{fmtMoney(totals.total)}</span>
          <SaveStatus state={saver.state} errorMessage={saver.error} />
          {pending.length > 0 && saver.state !== "error" && (

            <span className="text-amber-500">Не сохранено (допишите значение): {pending.join(", ")}</span>
          )}
          <QuoteShareStatus share={shareState} />
        </>
      }
      actions={
        <>
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
              <SendToTelegramButton kind="quote" id={id} asMenuItem label="Отправить в Telegram" />
              <DropdownMenuItem onClick={onMarkSent}>
                <Send className="mr-2 h-4 w-4" />Отметить «Отправлено»
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onCreateOrder}>
                <FileCheck2 className="mr-2 h-4 w-4" />{quote.order_id ? "Открыть заказ" : "Создать заказ"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStoryboardOpen(true)}>
                <Presentation className="mr-2 h-4 w-4" />Собрать презентацию
              </DropdownMenuItem>
              {canCost && (
                <DropdownMenuItem
                  onClick={() =>
                    viewer.openDocument(`/admin/documents/quotes/${id}/render?internal=1&format=pdf`, {
                      name: "КП-внутренний.pdf",
                    })
                  }
                >
                  <Calculator className="mr-2 h-4 w-4" />Внутренний PDF (себестоимость)
                </DropdownMenuItem>
              )}
              {canCost && (
                <SendToTelegramButton kind="quote-internal" id={id} asMenuItem label="Внутренний PDF в Telegram" />
              )}
              <DropdownMenuItem
                onClick={() => viewer.openDocument(`/admin/documents/quotes/${id}/render`, { name: "КП.html" })}
              >
                <ExternalLink className="mr-2 h-4 w-4" />HTML-версия
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setTemplateOpen(true)}>
                <BookmarkPlus className="mr-2 h-4 w-4" />Сохранить в библиотеку
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/admin/documents/knowledge"><Brain className="mr-2 h-4 w-4" />Информационная база</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={() => void onDeleteDocument()}>
                <Trash2 className="mr-2 h-4 w-4" />Удалить КП
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      }
      footerLeft={
        <>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <Switch checked={inlineEdit} onCheckedChange={setInlineEdit} />
            <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" />Правка двойным кликом</span>
          </label>
          {canCost && (
            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
              <Switch checked={internalView} onCheckedChange={setInternalView} />
              <span className="flex items-center gap-1"><Calculator className="h-3.5 w-3.5" />Внутренний вид (себестоимость и прибыль)</span>
            </label>
          )}
          {canCost && !internalView && (
            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
              <Switch checked={wideMargin} onCheckedChange={setWideMargin} />
              <span>Альбом + маржа</span>
            </label>
          )}
          <DetachedPreviewButton html={previewHtml} title={`Превью · ${quote.title || "КП"}`} />
        </>
      }
      sheet={({ height }) => (
        <LivePreviewFrame
          frameRef={previewRef}
          title="Превью КП"
          html={previewHtml}
          className="w-full rounded-lg bg-white"
          style={{ height: Math.max(1123, height) }}
        />
      )}
    >
      <BlockEditDialog
        edit={edit}
        quote={quote}
        items={items}
        settings={settings}
        onClose={() => setEdit(null)}
        onSaveQuote={(p) => { patch(p); toast.success("Блок обновлён"); }}
        onSaveItems={(next) => { patchItems(next); toast.success("Позиция обновлена"); }}
      />

      <SaveToLibraryDialog
        open={templateOpen}
        onOpenChange={setTemplateOpen}
        defaultName={quote.title || "Шаблон КП"}
        typeLabel="КП"
        onSave={onSaveToLibrary}
      />

      <QuoteStoryboardDialog
        open={storyboardOpen}
        onOpenChange={setStoryboardOpen}
        quoteId={id}
        defaultTitle={`Презентация · КП ${quoteNumberDisplay(quote)}`}
        companyId={quote.company_id ?? null}
        onCreated={(pid) => navigate({ to: "/admin/documents/presentations/$id", params: { id: pid } })}
      />

      {confirmDialog}
    </DocEditorShell>
  );
}

