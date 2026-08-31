import { useRoles } from "@/hooks/use-roles";
import { DetachedPreviewButton } from "@/components/admin/documents/DetachedPreviewButton";
import { DocStatusBar } from "@/components/admin/documents/DocStatusBar";
import { DocVersionsPanel } from "@/components/admin/documents/DocVersionsPanel";
import { SaveToLibraryDialog } from "@/components/admin/documents/SaveToLibraryDialog";
import { DocAppearanceSection } from "@/components/admin/documents/DocAppearanceSection";


// Редактор промо-КП: вкладки-формы слева, живое превью и итоги справа, автосохранение и Undo.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { saveStatus } from "@/lib/editor/save-state";
import { useEditorSave } from "@/hooks/use-editor-save";

import { HISTORY_LIMIT } from "@/lib/editor/history";
import { useQuery } from "@tanstack/react-query";
import { adminKeys } from "@/lib/query-keys";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Download, Info, Undo2, Redo2, History, Send, ListTree, User, Wallet, ShieldCheck, Settings2,
  Eye, Percent, Brain, MoreHorizontal, Trash2, Calculator,
} from "lucide-react";

import { useConfirm } from "@/components/admin/ConfirmDialog";
import { deleteDocument } from "@/lib/documents-overview.functions";
import { DocEditorShell } from "@/components/admin/editor/DocEditorShell";
import type { EditorSection } from "@/components/admin/editor/EditorSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SendToTelegramButton } from "@/components/admin/SendToTelegramButton";
import { StatusPill } from "@/components/admin/StatusPill";
import { QuoteShareActions, QuoteShareStatus, type ShareState } from "@/components/admin/quotes/QuoteShareActions";
import { PromoItemsTable } from "@/components/admin/promo/PromoItemsTable";
import { PromoSheetPanel } from "@/components/admin/documents/PromoSheetPanel";
import { PromoItemsToolbar } from "@/components/admin/promo/PromoItemsToolbar";
import { PromoTotalsPanel } from "@/components/admin/promo/PromoTotalsPanel";
import {
  createPromoVersion, getPromoQuote, listPromoVersions, markPromoSent, restorePromoVersion,
  sendPromoQuoteToClient,
  savePromoQuote, savePromoSnippet, savePromoTemplate,
} from "@/lib/promo-quotes.functions";
import { saveEstimateTemplate } from "@/lib/estimate-templates.functions";

import {
  PROMO_STATUS_LABELS, PROMO_STATUSES, checkPromoQuote, computePromoTotals, isPristinePromoItem, promoNumberDisplay,
  promoValidityState, type PromoDiscountType, type PromoItem, type PromoQuote, type PromoStatus,
} from "@/lib/promo-quote-model";
import { lineQty, isCounted } from "@/lib/promo-quote-model";
import { EconomicsPanel } from "@/components/admin/documents/EconomicsPanel";
import { buildEconomics, normalizeCostMode } from "@/lib/documents/economics";
import { promoEconRows } from "@/lib/documents/economics-source";
import { buildEconomicsSheetBody, ECON_SHEET_CSS } from "@/lib/documents/economics-sheet";
import { buildPromoQuoteBody, PROMO_DOC_CSS } from "@/lib/documents/promo-quote-html";
import { buildMarginCols, MARGIN_COLS_CSS } from "@/lib/documents/margin-cols";
import { sheetCss } from "@/lib/documents/sheet";
import { BASE_PRINT_PRESET } from "@/lib/documents/print-preset";
import { A4Sheet } from "@/components/admin/documents/A4Sheet";
import { useInlineDocEdit } from "@/hooks/use-inline-doc-edit";
import { useTableWidthSync } from "@/hooks/use-table-width-sync";


import { SuggestInput } from "@/components/admin/SuggestInput";
import { useDocSuggest } from "@/hooks/use-doc-suggest";
import { useDocumentViewer } from "@/hooks/use-document-viewer";
import { supabase } from "@/integrations/supabase/client";
import { friendlyZodMessage } from "@/lib/admin/zod-message";
import { VatSettings } from "@/components/admin/VatSettings";
import { PromoBlockEditDialog, type PromoEditTarget } from "@/components/admin/documents/PromoBlockEditDialog";
import { getQuoteDocSettings } from "@/lib/quotes.functions";
import { DEFAULT_DOCUMENT_SETTINGS } from "@/lib/document-settings.functions";
import { resolveCompany } from "@/lib/documents/company";


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
  const viewer = useDocumentViewer();
  const { id } = Route.useParams();
  const get = useServerFn(getPromoQuote);
  const save = useServerFn(savePromoQuote);
  const saveTpl = useServerFn(savePromoTemplate);
  const saveSample = useServerFn(saveEstimateTemplate);

  const saveSnippet = useServerFn(savePromoSnippet);
  const listVersions = useServerFn(listPromoVersions);
  const makeVersion = useServerFn(createPromoVersion);
  const restoreVersion = useServerFn(restorePromoVersion);
  const markSent = useServerFn(markPromoSent);
  const sendPromo = useServerFn(sendPromoQuoteToClient);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: adminKeys.promoQuote(id),
    queryFn: () => get({ data: { id } }),
  });

  const loadDocSettings = useServerFn(getQuoteDocSettings);
  const activeCompanyId = data?.quote?.company_id ?? null;
  const { data: settings = DEFAULT_DOCUMENT_SETTINGS } = useQuery({
    queryKey: ["admin-quote-settings", activeCompanyId],
    queryFn: () => loadDocSettings({ data: { companyId: activeCompanyId } }),
  });

  const [quote, setQuote] = useState<PromoQuote | null>(null);
  const [items, setItems] = useState<PromoItem[]>([]);
  /** Последний снимок, ожидающий записи на сервер. */
  const pending = useRef<Snapshot | null>(null);

  const { can } = useRoles();
  const canCost = can("documents.cost_margin");
  const [showCostRaw, setShowCost] = useState(false);
  const [internalView, setInternalView] = useState(false);
  // Альбомный лист с колонками «Себестоимость / Прибыль / %» прямо в КП.
  const [wideMargin, setWideMargin] = useState(false);
  const showCost = showCostRaw && canCost;
  const [snippetDraft, setSnippetDraft] = useState<{ name: string; section: string; items: PromoItem[] } | null>(null);
  const [templateOpen, setTemplateOpen] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirm();
  const navigate = useNavigate();
  const removeDoc = useServerFn(deleteDocument);
  const onDeleteDocument = async () => {
    const ok = await confirm({
      title: "Удалить КП?",
      description: "КП промо и его позиции будут удалены безвозвратно.",
    });
    if (!ok) return;
    try {
      await removeDoc({ data: { kind: "promo", id } });
      toast.success("КП удалено");
      void navigate({ to: "/admin/documents" });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  // Общая история правок (undo/redo) — один модуль с презентациями.
  const history = useRef<Snapshot[]>([]);
  const redoStack = useRef<Snapshot[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const persist = useCallback(async (payload: Snapshot) => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Общий хук: дебаунс 1200 мс, Ctrl+S, предупреждение при уходе со страницы.
  const saver = useEditorSave(async () => {
    const snap = pending.current ?? (quote ? { quote, items } : null);
    if (!snap) return;
    try {
      await persist(snap);
      pending.current = null;
    } catch (e) {
      toast.error(`Не сохранено: ${friendlyZodMessage(e as Error)}`);
      throw e;
    }
  });
  const saverRef = useRef(saver);
  saverRef.current = saver;

  useEffect(() => {
    if (data) {
      setQuote(data.quote);
      setItems(data.items);
      history.current = [];
      redoStack.current = [];
      setCanUndo(false);
      setCanRedo(false);
      pending.current = null;
      saverRef.current.reset();
    }
  }, [data]);

  const scheduleSave = useCallback((q: PromoQuote, list: PromoItem[]) => {
    pending.current = { quote: q, items: list };
    saverRef.current.markDirty();
  }, []);


  const { fetchContacts } = useDocSuggest();

  const pushHistory = useCallback((snap: Snapshot) => {
    history.current = [...history.current, snap].slice(-HISTORY_LIMIT);
    redoStack.current = [];
    setCanUndo(true);
    setCanRedo(false);
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
    setQuote((cur) => {
      setItems((curItems) => {
        if (cur) redoStack.current = [...redoStack.current, { quote: cur, items: curItems }].slice(-HISTORY_LIMIT);
        return prev.items;
      });
      return prev.quote;
    });
    setCanUndo(history.current.length > 0);
    setCanRedo(true);
    scheduleSave(prev.quote, prev.items);
    toast.success("Действие отменено");
  }, [scheduleSave]);

  const redo = useCallback(() => {
    const next = redoStack.current.pop();
    if (!next) return toast.info("Повторять нечего");
    setQuote((cur) => {
      setItems((curItems) => {
        if (cur) history.current = [...history.current, { quote: cur, items: curItems }].slice(-HISTORY_LIMIT);
        return next.items;
      });
      return next.quote;
    });
    setCanUndo(true);
    setCanRedo(redoStack.current.length > 0);
    scheduleSave(next.quote, next.items);
  }, [scheduleSave]);

  // Ctrl+S обрабатывает общий хук; здесь только undo/redo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        const t = e.target as HTMLElement | null;
        if (t && /input|textarea/i.test(t.tagName)) return;
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);


  const totals = useMemo(() => (quote ? computePromoTotals(quote, items) : null), [quote, items]);
  const checks = useMemo(() => (quote ? checkPromoQuote(quote, items) : []), [quote, items]);
  const errors = checks.filter((c) => c.level === "error");
  const warnings = checks.filter((c) => c.level === "warn");
  const [inlineEdit, setInlineEdit] = useState(true);
  const [edit, setEdit] = useState<PromoEditTarget | null>(null);
  /** Реквизиты компании — печатаются под логотипом в шапке. */
  const companyLine = useMemo(() => {
    const c = resolveCompany(quote?.company_overrides ?? null, settings);
    return [
      `${c.company_legal_name}${c.company_unp ? ` · УНП ${c.company_unp}` : ""}`.trim(),
      c.company_address,
    ]
      .filter((s) => s && s.trim() !== "")
      .join(" · ");
  }, [quote?.company_overrides, settings]);
  // В превью не показываем замечания по «нетронутым» пустым строкам —
  // они только что добавлены, документ не должен сразу краснеть.
  const previewChecks = useMemo(
    () =>
      checks.filter((c) => {
        if (c.itemIndex == null) return true;
        const it = items[c.itemIndex];
        return !it || !isPristinePromoItem(it);
      }),
    [checks, items],
  );
  const previewHtml = useMemo(
    () =>
      quote
        ? buildPromoQuoteBody(quote, items, {
            editable: inlineEdit,
            companyLine,
            checks: previewChecks,
            ...(canCost && wideMargin && !internalView ? { margin: buildMarginCols(promoEconRows(items)) } : {}),
          })
        : "",
    [quote, items, inlineEdit, companyLine, previewChecks, canCost, wideMargin, internalView],
  );
  // Внутренний вид превью: себестоимость и прибыль по каждой строке.
  const internalHtml = useMemo(
    () =>
      quote && canCost && internalView
        ? buildEconomicsSheetBody(
            {
              docLabel: `КП промо №${promoNumberDisplay(quote)}`,
              client: quote.client_name || undefined,
              netLabel: "После комиссии, скидки и НДС",
            },
            buildEconomics(promoEconRows(items), { netRevenue: computePromoTotals(quote, items).net }),
          )
        : "",
    [quote, items, canCost, internalView],
  );
  const showInternal = canCost && internalView;
  const wideLand = canCost && wideMargin && !internalView;



  /** Двойной клик по блоку превью открывает точечное редактирование. */
  const { containerRef: sheetRef, nodeRef: sheetNodeRef } = useInlineDocEdit({
    enabled: inlineEdit,
    onEdit: (hit) => setEdit(hit),
  });
  // Шапка, colgroup и ячейки таблицы держатся на одной сетке при любой
  // ширине рабочего пространства.
  useTableWidthSync(() => sheetNodeRef.current, [previewHtml]);


  const versions = useQuery({
    queryKey: adminKeys.promoQuoteVersions(id),
    queryFn: () => listVersions({ data: { quoteId: id } }),
  });




  if (isLoading) return <div className="p-8 text-muted-foreground">Загрузка…</div>;
  if (error || !quote || !totals) {
    return <div className="p-8 text-destructive">{(error as Error)?.message ?? "КП не найдено"}</div>;
  }

  const validity = promoValidityState(quote);
  const shareState: ShareState = {
    token: quote.public_token,
    email: quote.contact_email,
    sentAt: quote.sent_at,
    viewedAt: quote.viewed_at,
    clientResponse: quote.client_response,
    clientComment: quote.client_comment,
  };

  const sections: EditorSection[] = [
    {
      id: "items",
      label: "Состав",
      Icon: ListTree,
      wide: true,
      content: (
        <div className="space-y-3">
          <PromoSheetPanel quoteId={id} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <PromoItemsToolbar items={items} onChange={patchItems} />
            {canCost && (
              <Label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Switch checked={showCost} onCheckedChange={setShowCost} />
                Себестоимость и маржа
              </Label>
            )}
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
        </div>
      ),
    },
    {
      id: "main",
      label: "Клиент",
      Icon: User,
      content: (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Проект"><Input value={quote.project} onChange={(e) => patchQuote({ project: e.target.value })} /></Field>
          <Field label="Клиент">
            <SuggestInput
              value={quote.client_name}
              onChange={(v) => patchQuote({ client_name: v })}
              fetcher={fetchContacts}
              onPick={(h) => patchQuote({
                client_name: h.company || h.name,
                contact_name: h.name || quote.contact_name,
                contact_role: h.contact_role || quote.contact_role,
                contact_phone: h.phone || quote.contact_phone,
                contact_email: h.email || quote.contact_email,
              })}
              render={(h) => (
                <>
                  <div className="font-medium">{h.company || h.name}</div>
                  <div className="text-xs text-muted-foreground">{[h.name, h.phone, h.email].filter(Boolean).join(" · ")}</div>
                </>
              )}
            />
          </Field>
          <Field label="Период"><Input value={quote.period} onChange={(e) => patchQuote({ period: e.target.value })} placeholder="01.09 – 30.09.2026" /></Field>
          <Field label="Место проведения"><Input value={quote.venue} onChange={(e) => patchQuote({ venue: e.target.value })} /></Field>
          <Field label="Контактное лицо">
            <SuggestInput
              value={quote.contact_name}
              onChange={(v) => patchQuote({ contact_name: v })}
              fetcher={fetchContacts}
              onPick={(h) => patchQuote({
                client_name: h.company || quote.client_name,
                contact_name: h.name || quote.contact_name,
                contact_role: h.contact_role || quote.contact_role,
                contact_phone: h.phone || quote.contact_phone,
                contact_email: h.email || quote.contact_email,
              })}
              render={(h) => (
                <>
                  <div className="font-medium">{h.name || h.company}</div>
                  <div className="text-xs text-muted-foreground">{[h.company, h.phone, h.email].filter(Boolean).join(" · ")}</div>
                </>
              )}
            />
          </Field>
          <Field label="Должность"><Input value={quote.contact_role} onChange={(e) => patchQuote({ contact_role: e.target.value })} /></Field>
          <Field label="Телефон"><Input value={quote.contact_phone} onChange={(e) => patchQuote({ contact_phone: e.target.value })} /></Field>
          <Field label="E-mail"><Input value={quote.contact_email} onChange={(e) => patchQuote({ contact_email: e.target.value })} /></Field>
          <Field label="Действительно до">
            <Input
              type="date"
              value={quote.valid_until ?? ""}
              onChange={(e) => patchQuote({ valid_until: e.target.value || null })}
            />
          </Field>
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
              docTitle={`КП промо ${promoNumberDisplay(quote)}`}
              netRevenue={totals?.net}
              netLabel="После комиссии, скидки и НДС"
              rows={items.map((it) => ({
                id: it.id,
                section: it.section,
                title: it.title,
                qty: lineQty(it),
                qtyLabel: `${lineQty(it)} ${it.unit}`.trim(),
                price: Number(it.price) || 0,
                unitCost: Number(it.cost) || 0,
                costMode: normalizeCostMode(it.cost_mode),
                costInput: Number(it.cost_input) || 0,
                excluded: !isCounted(it),
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
          <VatSettings
            value={{ mode: quote.vat_mode, rate: quote.vat_rate, asLine: quote.vat_as_line }}
            onChange={(v) =>
              patchQuote({
                ...(v.mode !== undefined ? { vat_mode: v.mode, vat_enabled: v.mode !== "none" } : {}),
                ...(v.rate !== undefined ? { vat_rate: v.rate } : {}),
                ...(v.asLine !== undefined ? { vat_as_line: v.asLine } : {}),
              })
            }
          />
        </div>
      ),
    },
    {
      id: "view",
      label: "Оформление",
      Icon: Settings2,
      content: (
        <DocAppearanceSection
          toggles={[
            { key: "show_qty", label: "Колонка «Кол-во»", hint: <Hint text="Скройте, если позиции без количества (пакетные услуги)." />, value: quote.show_qty, onChange: (v) => patchQuote({ show_qty: v }) },
            { key: "show_total_qty", label: "Колонка «Всего»", hint: <Hint text="Кол-во × множитель — например, человек × дней." />, value: quote.show_total_qty, onChange: (v) => patchQuote({ show_total_qty: v }) },
            { key: "show_notes", label: "Колонка «Примечания»", value: quote.show_notes, onChange: (v) => patchQuote({ show_notes: v }) },
            { key: "show_item_includes", label: "Состав позиций", hint: <Hint text="Показывать в документе список «что входит» под названием позиции." />, value: quote.show_item_includes, onChange: (v) => patchQuote({ show_item_includes: v }) },
            { key: "show_section_subtotals", label: "Подытоги разделов", hint: <Hint text="Строка «Итого по разделу» после позиций раздела." />, value: quote.show_section_subtotals, onChange: (v) => patchQuote({ show_section_subtotals: v }) },
          ]}
          fontFamily={quote.font_family}
          onFontChange={(font_family) => patchQuote({ font_family })}
          accent={quote.accent_color}
          onAccentChange={(accent_color) => patchQuote({ accent_color })}
          logo={{
            label: "Логотип агентства",
            url: quote.logo_url,
            onChange: (v) => patchQuote({ logo_url: v }),
            layout: quote.logo_layout,
            onLayoutChange: (l) => patchQuote({ logo_layout: l }),
            brand: resolveCompany(quote.company_overrides, settings).company_brand,
            legalLine: `${resolveCompany(quote.company_overrides, settings).company_legal_name} · ${resolveCompany(quote.company_overrides, settings).company_address}`,
            docNum: quote.doc_number || "000",
          }}
          clientLogo={{ url: quote.client_logo_url, onChange: (v) => patchQuote({ client_logo_url: v }) }}
          companyId={quote.company_id}
          onCompanyChange={(companyId) => patchQuote({ company_id: companyId })}
          overrides={quote.company_overrides}
          onOverridesChange={(v) => patchQuote({ company_overrides: v })}
          settings={settings}
          extra={
            <Field label="Примечание в подвале">
              <Textarea value={quote.footer_note} onChange={(e) => patchQuote({ footer_note: e.target.value })} className="min-h-[80px]" />
            </Field>
          }
        />
      ),
    },
    {
      id: "checks",
      label: "Проверка",
      Icon: ShieldCheck,
      dot: errors.length + warnings.length > 0,
      content: <DocStatusBar checks={checks} />,
    },
    {
      id: "versions",
      label: "История",
      Icon: History,
      content: (
        <DocVersionsPanel
          versions={(versions.data ?? []).map((v) => ({ id: v.id, label: v.label }))}
          onCreate={async () => {
            await makeVersion({ data: { quoteId: id, label: `Снимок ${new Date().toLocaleString("ru-RU")}` } });
            void versions.refetch();
            toast.success("Версия сохранена");
          }}
          onRestore={async (versionId) => {
            await restoreVersion({ data: { versionId } });
            await refetch();
            toast.success("Версия восстановлена");
          }}
        />
      ),
    },
  ];

  return (
    <TooltipProvider delayDuration={200}>
      <DocEditorShell
        sections={sections}
        defaultSection="items"
        hint="Двойной клик по блоку в листе открывает его редактирование · Ctrl+Z — отмена"
        title={
          <Input
            value={quote.project}
            onChange={(e) => patchQuote({ project: e.target.value })}
            placeholder="Название проекта"
            className="h-8 max-w-[380px] border-transparent bg-transparent px-1 text-base font-semibold shadow-none focus-visible:border-input"
          />
        }
        subtitle={
          <>
            <span>№ {promoNumberDisplay(quote)}</span>
            <span>
              · {saveStatus(saver.state, saver.savedAt, saver.error).text}
            </span>
            {validity === "expired" && <StatusPill tone="danger">Срок истёк</StatusPill>}
            <QuoteShareStatus share={shareState} />
          </>
        }
        actions={
          <>
            <Select value={quote.status} onValueChange={(v) => patchQuote({ status: v as PromoStatus })}>
              <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PROMO_STATUSES.map((s) => <SelectItem key={s} value={s}>{PROMO_STATUS_LABELS[s]}</SelectItem>)}
              </SelectContent>
            </Select>
            <QuoteShareActions
              share={shareState}
              issues={errors.map((c) => c.message)}
              onSend={async (input) => {
                await sendPromo({ data: { id, ...input } });
                await refetch();
              }}
            />
            <Button size="sm" variant="ghost" onClick={redo} disabled={!canRedo} title="Повторить (Ctrl+Shift+Z)">
              <Redo2 className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={undo} disabled={!canUndo} title="Отменить (Ctrl+Z)">
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              onClick={() =>
                viewer.openDocument(`/admin/documents/promo/${id}/render?format=pdf`, { name: "КП.pdf" })
              }
            >
              <Download className="mr-1 h-4 w-4" />PDF
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline"><MoreHorizontal className="mr-1.5 h-4 w-4" />Ещё</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[260px]">
                <SendToTelegramButton kind="promo" id={id} asMenuItem label="Отправить в Telegram" />
                <DropdownMenuItem
                  onClick={async () => {
                    await markSent({ data: { id } });
                    await refetch();
                    toast.success("Отмечено как отправленное");
                  }}
                >
                  <Send className="mr-2 h-4 w-4" />Отметить «Отправлено»
                </DropdownMenuItem>
  <DropdownMenuItem onClick={() => setTemplateOpen(true)}>
                  Сохранить в библиотеку
                </DropdownMenuItem>
                {canCost && (
                  <DropdownMenuItem
                    onClick={() =>
                      viewer.openDocument(`/admin/documents/promo/${id}/render?internal=1&format=pdf`, {
                        name: "КП-промо-внутренний.pdf",
                      })
                    }
                  >
                    <Calculator className="mr-2 h-4 w-4" />Внутренний PDF (себестоимость)
                  </DropdownMenuItem>
                )}
                {canCost && (
                  <SendToTelegramButton kind="promo-internal" id={id} asMenuItem label="Внутренний PDF в Telegram" />
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/admin/documents/knowledge">
                    <Brain className="mr-2 h-4 w-4" />Информационная база
                  </Link>
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
            <DetachedPreviewButton
              html={`<!doctype html><html lang="ru"><head><meta charset="utf-8"><style>${sheetCss(BASE_PRINT_PRESET)}${PROMO_DOC_CSS}</style></head><body><div class="sheet">${previewHtml}</div></body></html>`}
              title="Превью · КП промо"
            />
          </>
        }
        rightPanel={<PromoTotalsPanel quote={quote} totals={totals} showMargin={showCost} />}
        sheet={() => (
          <>
            <style>{showInternal ? ECON_SHEET_CSS : PROMO_DOC_CSS + MARGIN_COLS_CSS}</style>
            <A4Sheet ref={sheetRef} orientation={wideLand ? "landscape" : "portrait"}>
              <div dangerouslySetInnerHTML={{ __html: showInternal ? internalHtml : previewHtml }} />
            </A4Sheet>
          </>
        )}
      >
        <PromoBlockEditDialog
          edit={edit}
          quote={quote}
          items={items}
          onClose={() => setEdit(null)}
          onSaveQuote={patchQuote}
          onSaveItems={patchItems}
        />

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

        <SaveToLibraryDialog
          open={templateOpen}
          onOpenChange={setTemplateOpen}
          defaultName={quote.project || "Шаблон промо-КП"}
          typeLabel="КП промо"
          onSave={async (name, scope) => {
            try {
              if (scope === "shared") {
                await saveSample({ data: { source: "promo", docId: id, name } });
                toast.success("Образец сметы сохранён");
              } else {
                await saveTpl({ data: { id, name } });
                toast.success("Шаблон сохранён");
              }
            } catch (e) {
              toast.error((e as Error).message);
            }
          }}
        />

        {confirmDialog}
      </DocEditorShell>
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
