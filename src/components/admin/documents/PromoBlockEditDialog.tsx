// Диалог редактирования блока промо-КП, открываемый двойным кликом в превью документа.
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/admin/Field";
import {
  DocDialogShell,
  IncludesEditor,
  Summary,
  money as fmtMoney,
  parseNum,
} from "@/components/admin/documents/doc-form-kit";
import { normalizeVatMode } from "@/lib/documents/vat";
import { VatSettings } from "@/components/admin/VatSettings";
import {
  computePromoTotals,
  lineCost,
  lineTotal,
  type PromoDiscountType,
  type PromoItem,
  type PromoQuote,
} from "@/lib/promo-quote-model";

export type PromoEditTarget = { target: string; id: string | null };

const TITLES: Record<string, string> = {
  meta: "Шапка КП",
  item: "Позиция",
  section: "Раздел позиций",
  totals: "Итоги, скидка и НДС",
  footer: "Примечание в подвале",
};

export function PromoBlockEditDialog({
  edit,
  quote,
  items,
  onClose,
  onSaveQuote,
  onSaveItems,
}: {
  edit: PromoEditTarget | null;
  quote: PromoQuote;
  items: PromoItem[];
  onClose: () => void;
  onSaveQuote: (patch: Partial<PromoQuote>) => void;
  onSaveItems: (next: PromoItem[]) => void;
}) {
  const target = edit?.target ?? "";
  const [draft, setDraft] = useState<Partial<PromoQuote>>({});
  const [item, setItem] = useState<PromoItem | null>(null);
  const [sectionName, setSectionName] = useState("");

  useEffect(() => {
    if (!edit) return;
    setDraft({
      project: quote.project,
      client_name: quote.client_name,
      period: quote.period,
      venue: quote.venue,
      valid_until: quote.valid_until,
      contact_name: quote.contact_name,
      contact_role: quote.contact_role,
      contact_phone: quote.contact_phone,
      contact_email: quote.contact_email,
      discount_type: quote.discount_type,
      discount_value: quote.discount_value,
      commission_enabled: quote.commission_enabled,
      commission_rate: quote.commission_rate,
      management_enabled: quote.management_enabled,
      management_amount: quote.management_amount,
      vat_mode: quote.vat_mode,
      vat_rate: quote.vat_rate,
      vat_as_line: quote.vat_as_line,
      footer_note: quote.footer_note,
    });
    setItem(edit.target === "item" ? (items.find((i) => i.id === edit.id) ?? null) : null);
    setSectionName(edit.target === "section" ? (edit.id ?? "") : "");
  }, [edit, quote, items]);

  if (!edit) return null;
  const set = (p: Partial<PromoQuote>) => setDraft((d) => ({ ...d, ...p }));

  // Живые значения «как в превью».
  const merged: PromoQuote = { ...quote, ...draft } as PromoQuote;
  const draftItems = item ? items.map((it) => (it.id === item.id ? item : it)) : items;
  const totals = computePromoTotals(merged, draftItems);
  const cur = merged.currency || "BYN";
  const sectionItems = target === "section" ? items.filter((it) => it.section === (edit.id ?? "")) : [];


  const submit = () => {
    if (target === "item" && item) onSaveItems(items.map((it) => (it.id === item.id ? item : it)));
    else if (target === "section") {
      const from = edit.id ?? "";
      onSaveItems(items.map((it) => (it.section === from ? { ...it, section: sectionName } : it)));
    } else onSaveQuote(draft);
    onClose();
  };

  return (
    <DocDialogShell title={TITLES[target] ?? "Редактирование"} onClose={onClose} onSubmit={submit}>
          {target === "meta" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Проект"><Input value={draft.project ?? ""} onChange={(e) => set({ project: e.target.value })} /></Field>
              <Field label="Клиент"><Input value={draft.client_name ?? ""} onChange={(e) => set({ client_name: e.target.value })} /></Field>
              <Field label="Период"><Input value={draft.period ?? ""} onChange={(e) => set({ period: e.target.value })} /></Field>
              <Field label="Место проведения"><Input value={draft.venue ?? ""} onChange={(e) => set({ venue: e.target.value })} /></Field>
              <Field label="Действительно до"><Input type="date" value={draft.valid_until ?? ""} onChange={(e) => set({ valid_until: e.target.value || null })} /></Field>
              <Field label="Контактное лицо"><Input value={draft.contact_name ?? ""} onChange={(e) => set({ contact_name: e.target.value })} /></Field>
              <Field label="Должность"><Input value={draft.contact_role ?? ""} onChange={(e) => set({ contact_role: e.target.value })} /></Field>
              <Field label="Телефон"><Input value={draft.contact_phone ?? ""} onChange={(e) => set({ contact_phone: e.target.value })} /></Field>
              <Field label="E-mail" className="sm:col-span-2"><Input value={draft.contact_email ?? ""} onChange={(e) => set({ contact_email: e.target.value })} /></Field>
            </div>
          )}

          {target === "item" && item && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Наименование" className="sm:col-span-2"><Input value={item.title} onChange={(e) => setItem({ ...item, title: e.target.value })} /></Field>
              <Field label="Раздел"><Input value={item.section} onChange={(e) => setItem({ ...item, section: e.target.value })} /></Field>
              <Field label="Ед. изм."><Input value={item.unit} onChange={(e) => setItem({ ...item, unit: e.target.value })} /></Field>
              <Field label="Кол-во"><Input inputMode="decimal" value={String(item.qty)} onChange={(e) => setItem({ ...item, qty: parseNum(e.target.value) })} /></Field>
              <Field label="Множитель (дни/смены)"><Input inputMode="decimal" value={String(item.multiplier)} onChange={(e) => setItem({ ...item, multiplier: parseNum(e.target.value) })} /></Field>
              <Field label="Цена за ед."><Input inputMode="decimal" value={String(item.price)} onChange={(e) => setItem({ ...item, price: parseNum(e.target.value) })} /></Field>
              <Field label="Себестоимость"><Input inputMode="decimal" value={String(item.cost)} onChange={(e) => setItem({ ...item, cost: parseNum(e.target.value) })} /></Field>
              <Field label="Примечание" className="sm:col-span-2"><Textarea rows={2} value={item.note} onChange={(e) => setItem({ ...item, note: e.target.value })} /></Field>
              <IncludesEditor value={item.includes} onChange={(includes) => setItem({ ...item, includes })} />
              <div className="sm:col-span-2">
                <Summary
                  rows={[
                    ["Сумма строки", fmtMoney(lineTotal(item), cur), true],
                    ...(item.cost
                      ? ([
                          ["Себестоимость", fmtMoney(lineCost(item), cur)],
                          ["Маржа", fmtMoney(lineTotal(item) - lineCost(item), cur)],
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
                  ["Сумма раздела", fmtMoney(sectionItems.reduce((s, it) => s + lineTotal(it), 0), cur), true],
                ]}
              />
            </div>
          )}

          {target === "totals" && (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Скидка">
                  <Select value={draft.discount_type ?? "none"} onValueChange={(v) => set({ discount_type: v as PromoDiscountType })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Нет</SelectItem>
                      <SelectItem value="percent">Процент</SelectItem>
                      <SelectItem value="amount">Сумма</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Значение скидки"><Input inputMode="decimal" value={String(draft.discount_value ?? 0)} onChange={(e) => set({ discount_value: parseNum(e.target.value) })} /></Field>
                <Field label="Комиссия, %"><Input inputMode="decimal" value={String(draft.commission_rate ?? 0)} onChange={(e) => set({ commission_rate: parseNum(e.target.value), commission_enabled: parseNum(e.target.value) > 0 })} /></Field>
                <Field label="Менеджмент, сумма"><Input inputMode="decimal" value={String(draft.management_amount ?? 0)} onChange={(e) => set({ management_amount: parseNum(e.target.value), management_enabled: parseNum(e.target.value) > 0 })} /></Field>
              </div>
              <VatSettings
                value={{ mode: normalizeVatMode(draft.vat_mode ?? quote.vat_mode), rate: draft.vat_rate ?? quote.vat_rate, asLine: draft.vat_as_line ?? quote.vat_as_line }}
                onChange={(p) =>
                  set({
                    ...(p.mode !== undefined ? { vat_mode: p.mode, vat_enabled: p.mode !== "none" } : {}),
                    ...(p.rate !== undefined ? { vat_rate: p.rate } : {}),
                    ...(p.asLine !== undefined ? { vat_as_line: p.asLine } : {}),
                  })
                }
              />
              <Summary
                rows={[
                  ["Позиции", fmtMoney(totals.itemsSum, cur)],
                  ...(totals.commission
                    ? ([[merged.commission_label || "Комиссия", fmtMoney(totals.commission, cur)]] as Array<[string, string]>)
                    : []),
                  ...(totals.management
                    ? ([[merged.management_label || "Менеджмент", fmtMoney(totals.management, cur)]] as Array<[string, string]>)
                    : []),
                  ...(totals.discount ? ([["Скидка", `− ${fmtMoney(totals.discount, cur)}`]] as Array<[string, string]>) : []),
                  ...(totals.vatEnabled
                    ? ([
                        ["Без НДС", fmtMoney(totals.net, cur)],
                        [`НДС ${totals.vatRate}%`, fmtMoney(totals.vat, cur)],
                      ] as Array<[string, string]>)
                    : []),
                  ["Итого", fmtMoney(totals.totalWithVat, cur), true],
                  ...(totals.costSum
                    ? ([["Маржа", `${fmtMoney(totals.margin, cur)} (${totals.marginPct.toFixed(1)}%)`]] as Array<[string, string]>)
                    : []),
                ]}
              />
            </div>
          )}

          {target === "footer" && (
            <Field label="Примечание в подвале">
              <Textarea rows={4} value={draft.footer_note ?? ""} onChange={(e) => set({ footer_note: e.target.value })} />
            </Field>
          )}
    </DocDialogShell>
  );
}
