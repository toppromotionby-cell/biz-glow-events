// Диалог редактирования блока документа, открываемый двойным кликом в живом превью КП.
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/admin/Field";
import { CompanyOverridesEditor } from "@/components/admin/CompanyOverridesEditor";
import { VatSettings } from "@/components/admin/VatSettings";
import { computeTotals, normalizeVatMode, type Quote, type QuoteItem, type QuoteTexts } from "@/lib/quotes-model";
import { buildNumericValues, buildPlaceholderValues, quoteNumberDisplay, quoteValidUntil } from "@/lib/documents/quote-html";
import { applyPlaceholders } from "@/lib/quote-blocks";
import type { CompanyOverrides } from "@/lib/documents/company";
import type { DocumentSettings } from "@/lib/document-settings.functions";

export type DocEditTarget = { target: string; id: string | null };

const TITLES: Record<string, string> = {
  header: "Номер и даты документа",
  company: "Реквизиты этого КП",
  cover: "Заголовок и вступление",
  client: "Заказчик",
  event: "Мероприятие",
  item: "Позиция",
  section: "Раздел позиций",
  totals: "Итоги и оплата",
  block: "Текстовый блок",
  footer: "Подвал документа",
};

/** Какой текст из quote.texts подставляет превью, если у блока нет своего. */
const BLOCK_TEXT_FALLBACK: Partial<Record<string, keyof QuoteTexts>> = {
  cover: "intro",
  included: "included",
  excluded: "excluded",
  timeline: "timeline",
  terms: "terms",
};

function n(v: string): number {
  const x = Number(String(v).replace(",", "."));
  return Number.isFinite(x) ? x : 0;
}

const money = (v: number) =>
  `${new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0)} BYN`;

/** Сводка «как в превью»: только чтение. */
function Summary({ rows }: { rows: Array<[string, string, boolean?]> }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm">
      {rows.map(([k, v, strong]) => (
        <div key={k} className={`flex justify-between gap-4 py-0.5 ${strong ? "font-semibold" : ""}`}>
          <span className="text-muted-foreground">{k}</span>
          <span className="tabular-nums">{v}</span>
        </div>
      ))}
    </div>
  );
}

function PlaceholderPreview({ text, map, numbers }: { text: string; map: Record<string, string>; numbers: Record<string, number> }) {
  if (!/\{\{/.test(text || "")) return null;
  return (
    <div className="mt-1 text-xs text-muted-foreground">
      Как будет в документе: {applyPlaceholders(text, map, numbers)}
    </div>
  );
}

export function BlockEditDialog({
  edit,
  quote,
  items,
  settings,
  onClose,
  onSaveQuote,
  onSaveItems,
}: {
  edit: DocEditTarget | null;
  quote: Quote;
  items: QuoteItem[];
  settings: DocumentSettings;
  onClose: () => void;
  onSaveQuote: (patch: Partial<Quote>) => void;
  onSaveItems: (next: QuoteItem[]) => void;
}) {
  const target = edit?.target ?? "";
  const [draft, setDraft] = useState<Partial<Quote>>({});
  const [item, setItem] = useState<QuoteItem | null>(null);
  const [sectionName, setSectionName] = useState("");

  const block = useMemo(() => {
    if (!edit) return null;
    if (target === "block") return quote.blocks.find((b) => b.id === edit.id) ?? null;
    if (target === "cover") return quote.blocks.find((b) => b.type === "cover") ?? null;
    return null;
  }, [edit, target, quote.blocks]);

  useEffect(() => {
    if (!edit) return;
    setDraft({
      quote_number: quote.quote_number ?? "",
      doc_date: quote.doc_date,
      validity_days: quote.validity_days,
      valid_until_override: quote.valid_until_override,
      title: quote.title,
      client_company: quote.client_company,
      client_name: quote.client_name,
      client_unp: quote.client_unp,
      client_phone: quote.client_phone,
      client_email: quote.client_email,
      client_address: quote.client_address,
      event_date: quote.event_date,
      event_time_start: quote.event_time_start,
      event_time_end: quote.event_time_end,
      venue: quote.venue,
      guests_count: quote.guests_count,
      event_format: quote.event_format,
      setup_note: quote.setup_note,
      event_notes: quote.event_notes,
      discount_type: quote.discount_type,
      discount_value: quote.discount_value,
      prepayment_type: quote.prepayment_type,
      prepayment_value: quote.prepayment_value,
      delivery_amount: quote.delivery_amount,
      vat_mode: quote.vat_mode,
      vat_rate: quote.vat_rate,
      vat_as_line: quote.vat_as_line,
      company_overrides: quote.company_overrides,
      // «Редактирую то, что вижу»: если у КП своего текста нет — подставляем
      // унаследованное значение из общих настроек документов (как в превью).
      vat_note: quote.vat_note || settings.vat_note,
      texts: { ...quote.texts, footer: quote.texts.footer || settings.quote_footer },
      // Блоки без своего текста показывают в превью запасной текст из quote.texts —
      // подставляем его в форму, чтобы редактировалось именно видимое содержимое.
      blocks: quote.blocks.map((b) => {
        if (b.content?.trim()) return b;
        const key = BLOCK_TEXT_FALLBACK[b.type];
        const fallback = key ? quote.texts[key] : "";
        return fallback ? { ...b, content: fallback } : b;
      }),
    });
    setItem(edit.target === "item" ? (items.find((i) => i.id === edit.id) ?? null) : null);
    setSectionName(edit.target === "section" ? (edit.id ?? "") : "");
  }, [edit, quote, items, settings]);

  if (!edit) return null;

  const set = (p: Partial<Quote>) => setDraft((d) => ({ ...d, ...p }));
  const setBlock = (p: { title?: string; content?: string }) => {
    if (!block) return;
    set({ blocks: (draft.blocks ?? quote.blocks).map((b) => (b.id === block.id ? { ...b, ...p } : b)) });
  };
  const currentBlock = block ? (draft.blocks ?? quote.blocks).find((b) => b.id === block.id) ?? block : null;

  // Живые значения «как в превью»: считаем тем же кодом, что и документ.
  const merged: Quote = { ...quote, ...draft } as Quote;
  const draftItems = item ? items.map((it) => (it.id === item.id ? item : it)) : items;
  const totals = computeTotals(merged, draftItems);
  const map = buildPlaceholderValues(merged, draftItems, settings);
  const numbers = buildNumericValues(merged, draftItems);
  const sectionItems = target === "section" ? items.filter((it) => (it.section ?? "") === (edit.id ?? "")) : [];


  const submit = () => {
    if (target === "item" && item) {
      onSaveItems(items.map((it) => (it.id === item.id ? item : it)));
    } else if (target === "section") {
      const from = edit.id ?? "";
      onSaveItems(items.map((it) => ((it.section ?? "") === from ? { ...it, section: sectionName } : it)));
    } else {
      onSaveQuote(draft);
    }
    onClose();
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{TITLES[target] ?? "Редактирование"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {target === "header" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Номер (пусто = авто)" hint={`Сейчас в документе: № ${quoteNumberDisplay(merged)}`}>
                <Input value={draft.quote_number ?? ""} onChange={(e) => set({ quote_number: e.target.value })} />
              </Field>
              <Field label="Дата документа">
                <Input type="date" value={draft.doc_date ?? ""} onChange={(e) => set({ doc_date: e.target.value })} />
              </Field>
              <Field label="Срок действия, дней">
                <Input
                  type="number"
                  value={String(draft.validity_days ?? 0)}
                  onChange={(e) => set({ validity_days: Math.max(0, Math.round(n(e.target.value))) })}
                />
              </Field>
              <Field
                label="Действительно до (вручную)"
                hint={quoteValidUntil(merged) ? `В документе: ${quoteValidUntil(merged)}` : undefined}
              >
                <Input
                  type="date"
                  value={draft.valid_until_override ?? ""}
                  onChange={(e) => set({ valid_until_override: e.target.value || null })}
                />
              </Field>
            </div>
          )}

          {target === "cover" && (
            <>
              <Field label="Заголовок документа" hint="Пусто = «Предложение по организации мероприятия»">
                <Input value={draft.title ?? ""} onChange={(e) => set({ title: e.target.value })} />
              </Field>
              <Field label="Вступительный текст" hint="Поддерживаются плейсхолдеры вида {{client_name}}">
                <Textarea
                  rows={5}
                  value={(currentBlock ? currentBlock.content : draft.texts?.intro) || ""}
                  onChange={(e) =>
                    currentBlock
                      ? setBlock({ content: e.target.value })
                      : set({ texts: { ...(draft.texts ?? quote.texts), intro: e.target.value } })
                  }
                />
                <PlaceholderPreview
                  text={(currentBlock ? currentBlock.content : draft.texts?.intro) || ""}
                  map={map}
                  numbers={numbers}
                />
              </Field>
            </>
          )}

          {target === "client" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Компания"><Input value={draft.client_company ?? ""} onChange={(e) => set({ client_company: e.target.value })} /></Field>
              <Field label="Контактное лицо"><Input value={draft.client_name ?? ""} onChange={(e) => set({ client_name: e.target.value })} /></Field>
              <Field label="УНП"><Input value={draft.client_unp ?? ""} onChange={(e) => set({ client_unp: e.target.value })} /></Field>
              <Field label="Телефон"><Input value={draft.client_phone ?? ""} onChange={(e) => set({ client_phone: e.target.value })} /></Field>
              <Field label="E-mail"><Input value={draft.client_email ?? ""} onChange={(e) => set({ client_email: e.target.value })} /></Field>
              <Field label="Адрес" className="sm:col-span-2"><Input value={draft.client_address ?? ""} onChange={(e) => set({ client_address: e.target.value })} /></Field>
            </div>
          )}

          {target === "event" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Дата мероприятия"><Input type="date" value={draft.event_date ?? ""} onChange={(e) => set({ event_date: e.target.value || null })} /></Field>
              <Field label="Гостей">
                <Input
                  type="number"
                  value={draft.guests_count == null ? "" : String(draft.guests_count)}
                  onChange={(e) => set({ guests_count: e.target.value === "" ? null : Math.round(n(e.target.value)) })}
                />
              </Field>
              <Field label="Начало"><Input value={draft.event_time_start ?? ""} onChange={(e) => set({ event_time_start: e.target.value })} placeholder="10:00" /></Field>
              <Field label="Окончание"><Input value={draft.event_time_end ?? ""} onChange={(e) => set({ event_time_end: e.target.value })} placeholder="18:00" /></Field>
              <Field label="Площадка" className="sm:col-span-2"><Input value={draft.venue ?? ""} onChange={(e) => set({ venue: e.target.value })} /></Field>
              <Field label="Формат" className="sm:col-span-2"><Input value={draft.event_format ?? ""} onChange={(e) => set({ event_format: e.target.value })} /></Field>
              <Field label="Монтаж / демонтаж" className="sm:col-span-2"><Textarea rows={2} value={draft.setup_note ?? ""} onChange={(e) => set({ setup_note: e.target.value })} /></Field>
              <Field label="Заметки" className="sm:col-span-2"><Textarea rows={3} value={draft.event_notes ?? ""} onChange={(e) => set({ event_notes: e.target.value })} /></Field>
            </div>
          )}

          {target === "item" && item && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Название" className="sm:col-span-2"><Input value={item.title} onChange={(e) => setItem({ ...item, title: e.target.value })} /></Field>
              <Field label="Описание" className="sm:col-span-2"><Textarea rows={3} value={item.description ?? ""} onChange={(e) => setItem({ ...item, description: e.target.value })} /></Field>
              <Field label="Раздел"><Input value={item.section ?? ""} onChange={(e) => setItem({ ...item, section: e.target.value })} /></Field>
              <Field label="Единица"><Input value={item.unit ?? ""} onChange={(e) => setItem({ ...item, unit: e.target.value })} /></Field>
              <Field label="Кол-во"><Input inputMode="decimal" value={String(item.qty)} onChange={(e) => setItem({ ...item, qty: n(e.target.value) })} /></Field>
              <Field label="Цена, BYN"><Input inputMode="decimal" value={String(item.price)} onChange={(e) => setItem({ ...item, price: n(e.target.value) })} /></Field>
              <Field label="Себестоимость, BYN"><Input inputMode="decimal" value={String(item.cost ?? 0)} onChange={(e) => setItem({ ...item, cost: n(e.target.value) })} /></Field>
              <Field label="Что входит" className="sm:col-span-2" hint="По строке на пункт">
                <Textarea
                  rows={4}
                  value={(item.includes ?? []).map((i) => (i.note ? `${i.text} — ${i.note}` : i.text)).join("\n")}
                  onChange={(e) =>
                    setItem({
                      ...item,
                      includes: e.target.value
                        .split(/\r?\n/)
                        .map((line) => line.trim())
                        .filter(Boolean)
                        .map((line) => {
                          const [text, ...rest] = line.split(" — ");
                          return { text: (text ?? "").trim(), note: rest.join(" — ").trim() };
                        }),
                    })
                  }
                />
              </Field>
              <div className="sm:col-span-2">
                <Summary
                  rows={[
                    ["Сумма строки", money(item.qty * item.price), true],
                    ...(item.cost
                      ? ([
                          ["Себестоимость строки", money(item.qty * (item.cost ?? 0))],
                          ["Маржа", money(item.qty * (item.price - (item.cost ?? 0)))],
                        ] as Array<[string, string]>)
                      : []),
                  ]}
                />
              </div>
            </div>
          )}

          {target === "section" && (
            <div className="space-y-3">
              <Field label="Название раздела" hint="Переименование применится ко всем позициям раздела">
                <Input value={sectionName} onChange={(e) => setSectionName(e.target.value)} />
              </Field>
              <Summary
                rows={[
                  ["Позиций в разделе", String(sectionItems.length)],
                  ["Сумма раздела", money(sectionItems.reduce((s, it) => s + it.qty * it.price, 0)), true],
                ]}
              />
            </div>
          )}

          {target === "totals" && (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Скидка">
                  <Select value={draft.discount_type ?? "none"} onValueChange={(v) => set({ discount_type: v as Quote["discount_type"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Нет</SelectItem>
                      <SelectItem value="percent">Процент</SelectItem>
                      <SelectItem value="amount">Сумма</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Значение скидки"><Input inputMode="decimal" value={String(draft.discount_value ?? 0)} onChange={(e) => set({ discount_value: n(e.target.value) })} /></Field>
                <Field label="Предоплата">
                  <Select value={draft.prepayment_type ?? "none"} onValueChange={(v) => set({ prepayment_type: v as Quote["prepayment_type"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Нет</SelectItem>
                      <SelectItem value="percent">Процент</SelectItem>
                      <SelectItem value="amount">Сумма</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Значение предоплаты"><Input inputMode="decimal" value={String(draft.prepayment_value ?? 0)} onChange={(e) => set({ prepayment_value: n(e.target.value) })} /></Field>
                <Field label="Доставка и логистика, BYN" className="sm:col-span-2"><Input inputMode="decimal" value={String(draft.delivery_amount ?? 0)} onChange={(e) => set({ delivery_amount: n(e.target.value) })} /></Field>
              </div>
              <VatSettings
                value={{ mode: normalizeVatMode(draft.vat_mode ?? quote.vat_mode), rate: draft.vat_rate ?? quote.vat_rate, asLine: draft.vat_as_line ?? quote.vat_as_line }}
                onChange={(p) =>
                  set({
                    ...(p.mode !== undefined ? { vat_mode: p.mode } : {}),
                    ...(p.rate !== undefined ? { vat_rate: p.rate } : {}),
                    ...(p.asLine !== undefined ? { vat_as_line: p.asLine } : {}),
                  })
                }
              />
              <Field
                label="Примечание об НДС"
                hint={
                  (draft.vat_note ?? "") === settings.vat_note && !quote.vat_note
                    ? "Значение по умолчанию из настроек документов."
                    : undefined
                }
              >
                <Textarea rows={2} value={draft.vat_note ?? ""} onChange={(e) => set({ vat_note: e.target.value })} />
                <div className="mt-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => set({ vat_note: "" })}>
                    Сбросить к настройкам
                  </Button>
                </div>
              </Field>
              <Summary
                rows={[
                  ["Позиции", money(totals.subtotal)],
                  ...(totals.discount ? ([["Скидка", `− ${money(totals.discount)}`]] as Array<[string, string]>) : []),
                  ...(totals.delivery ? ([["Доставка", money(totals.delivery)]] as Array<[string, string]>) : []),
                  ...(totals.vatEnabled
                    ? ([
                        ["Без НДС", money(totals.net)],
                        [`НДС ${totals.vatRate}%`, money(totals.vat)],
                      ] as Array<[string, string]>)
                    : []),
                  ["Итого к оплате", money(totals.total), true],
                  ...(totals.prepayment
                    ? ([
                        ["Предоплата", money(totals.prepayment)],
                        ["Остаток", money(totals.balance)],
                      ] as Array<[string, string]>)
                    : []),
                  ...(totals.cost
                    ? ([["Маржа", `${money(totals.margin)} (${totals.marginPct.toFixed(1)}%)`]] as Array<[string, string]>)
                    : []),
                ]}
              />
            </div>
          )}

          {target === "block" && currentBlock && (
            <>
              <Field label="Заголовок блока"><Input value={currentBlock.title} onChange={(e) => setBlock({ title: e.target.value })} /></Field>
              <Field label="Содержимое" hint="Каждая строка — отдельный пункт списка / абзац">
                <Textarea rows={8} value={currentBlock.content} onChange={(e) => setBlock({ content: e.target.value })} />
                <PlaceholderPreview text={currentBlock.content} map={map} numbers={numbers} />
              </Field>
            </>
          )}

          {target === "footer" && (
            <Field
              label="Текст подвала"
              hint={
                (draft.texts?.footer ?? "") === settings.quote_footer && !quote.texts.footer
                  ? "Значение по умолчанию из настроек документов. После сохранения текст закрепится за этим КП."
                  : "Поддерживаются плейсхолдеры вида {{client_name}}"
              }
            >
              <Textarea
                rows={3}
                value={draft.texts?.footer ?? ""}
                onChange={(e) => set({ texts: { ...(draft.texts ?? quote.texts), footer: e.target.value } })}
              />
              <div className="mt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => set({ texts: { ...(draft.texts ?? quote.texts), footer: "" } })}
                >
                  Сбросить к настройкам
                </Button>
              </div>
            </Field>
          )}

          {target === "company" && (
            <CompanyOverridesEditor
              value={(draft.company_overrides ?? {}) as CompanyOverrides}
              onChange={(next) => set({ company_overrides: next })}
              settings={settings}
            />
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Отмена</Button>
          <Button onClick={submit}>Сохранить</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
