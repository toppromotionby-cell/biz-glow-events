// PDF-генератор документов заказа (КП / Счёт / Договор / Акт).
// Используется только server-side. Рендерит pdf-lib + кастомные TTF
// (Inter Regular/Bold + Space Grotesk Bold — те же шрифты, что и в HTML-превью);
// кириллица в Standard 14 шрифтах PDF не работает, поэтому встраиваем TTF
// подмножеством (subset:true).
import { embedImageUrl } from "@/lib/documents/image-embed.server";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { DocumentSettings } from "@/lib/document-settings.functions";
import type { DocOrder, DocItem, DocKind } from "@/lib/documents/build.server";
import { fmtDate } from "@/lib/formatters";
import { computeVat, vatConfig, vatRateLabel } from "@/lib/documents/vat";
import {
  BRAND_ACCENT,
  DOC_COLORS,
  DOC_FONT_PT,
  DOC_LAYOUT,
  hexToRgb01,
  mixWithWhite,
} from "@/lib/documents/brand";
import {
  BASE_PRINT_PRESET,
  mmToPt,
  resolvePrintPreset,
  type DocPrintPreset,
} from "@/lib/documents/print-preset";
import {
  DEFAULT_LOGO_LAYOUT,
  computeLogoPlacement,
  requisitesFontPt,
  normalizeLogoLayout,
  type LogoLayout,
} from "@/lib/documents/logo-layout";

import {
  computePromoTotals,
  groupBySection,
  formatTotalQty,
  formatNumber,
  hasSecondUnit,
  isServiceOnlyRow,
  rateUnitLabel,
  lineTotal,
  promoNumberDisplay,
  type PromoItem as PromoItemT,
  type PromoQuote as PromoQuoteT,
} from "@/lib/promo-quote-model";

import { PRICE_LABEL } from "@/lib/documents/doc-layout";
import { pdfFontSet } from "@/lib/documents/pdf-fonts.server";
import { resolveDocFont, type DocFont } from "@/lib/documents/doc-font";
import { DOC_DENSITY_SCALE, DOC_DENSITY_LADDER, type DocDensity } from "@/lib/documents/density";
export { DOC_DENSITY_SCALE, type DocDensity };

import { applyDensity, ACCENT, ACCENT_BORDER, ACCENT_SOFT, LINE, M, MUTED, PAGE_H, PAGE_W, SURFACE, TEXT, c01 } from "@/lib/documents/pdf/style.server";
import { displayFont, embedLogo, type DocCtx, type FittedLogo } from "@/lib/documents/pdf/ctx.server";
import {
  divider, drawParagraph, drawText, drawTracked, drawTopBar, drawTrailingNote, ensureSpace, gap,
  money, newPage, roundedRect, safe, trackedWidth, wrapText,
} from "@/lib/documents/pdf/draw.server";
import { drawCard, drawFooter, drawHeader, drawInfoCard, drawSignatures } from "@/lib/documents/pdf/chrome.server";
import { drawSummary, drawTable, fitTableCols, type Col, type TableRow } from "@/lib/documents/pdf/table.server";


// Шрифты встроены в бандл (subset латиница+кириллица). Раньше они качались
// по сети с публичного адреса того же воркера — такой self-subrequest иногда
// зависал, и Cloudflare убивал запрос с 502.

/** В Space Grotesk нет кириллицы — для неё используем Bold основного шрифта. */


// === Утилиты ===
function header(order: DocOrder) {
  const numFromDb = ((order as { order_number?: string | null }).order_number ?? "").trim();
  return {
    num: numFromDb ? numFromDb.replaceAll("/", ".") : String(order.id).slice(0, 8).toUpperCase(),
    date: fmtDate(new Date()),
  };
}

export async function createCtx(
  logoUrl?: string | null,
  clientLogoUrl?: string | null,
  logoLayoutRaw?: unknown,
  font: DocFont = "brand",
): Promise<DocCtx> {
  const logoLayout = normalizeLogoLayout(logoLayoutRaw);
  const set = pdfFontSet(font);
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  // subset:true → встраиваем только использованные глифы (минимизируем вес).
  const regular = await pdf.embedFont(set.regular, { subset: true });
  const bold = await pdf.embedFont(set.bold, { subset: true });
  const display = await pdf.embedFont(set.display, { subset: true });
  // ставим как default fallback на StandardFonts (на всякий случай — для emoji не нужно).
  void StandardFonts;
  const [logo, clientLogo] = await Promise.all([
    embedLogo(pdf, logoUrl, logoLayout.maxW, logoLayout.maxH),
    embedLogo(pdf, clientLogoUrl, 120, 28),
  ]);
  const ctx: DocCtx = {
    pdf, regular, bold, display,
    displayCyrillic: set.displayCyrillic,
    page: pdf.addPage([PAGE_W, PAGE_H]),
    y: 0,
    pageNum: 1,
    logo,
    clientLogo,
    logoLayout,
  };



  ctx.y = PAGE_H - M.MARGIN_TOP;
  ctx.page.drawRectangle({ x: 0, y: PAGE_H - 4, width: PAGE_W, height: 4, color: ACCENT });
  return ctx;
}


// === Builders для каждого вида документа ===

async function buildQuote(order: DocOrder, items: DocItem[], settings: DocumentSettings): Promise<Uint8Array> {
  const ctx = await createCtx(settings.logo_url, null, settings.logo_layout);
  const { num, date } = header(order);
  drawHeader(ctx, "Коммерческое предложение", num, date, settings);

  drawCard(ctx, "Заказчик", order.client_company || order.client_name, [
    order.client_company ? `Контакт: ${order.client_name}` : null,
    order.client_phone,
    order.client_email,
    order.event_date ? `Дата мероприятия: ${fmtDate(order.event_date)}` : null,
  ]);

  gap(ctx, 6);
  const tableW = PAGE_W - M.MARGIN_X * 2;
  drawTable(
    ctx,
    [
      { title: "Позиция", key: "title", width: tableW * 0.55 },
      { title: "Кол-во", key: "qty", width: tableW * 0.13, align: "center", valign: "middle" },
      { title: "Цена", key: "price", width: tableW * 0.16, align: "right" },
      { title: "Сумма", key: "sum", width: tableW * 0.16, align: "right" },
    ],
    items.length
      ? items.map((it) => ({
          title: safe(it.title),
          qty: String(it.qty),
          price: money(Number(it.price)),
          sum: money(Number(it.price) * Number(it.qty)),
        }))
      : [{ title: "Позиции не добавлены", qty: "", price: "", sum: "" }],
  );

  const total = items.reduce((s, it) => s + Number(it.price) * Number(it.qty), 0);
  gap(ctx, 6);
  drawSummary(ctx, [{ label: "Итого", value: money(total), emphasis: true }]);

  if (order.notes) {
    gap(ctx, 4);
    drawText(ctx, "Комментарий", { bold: true, size: M.F12, color: ACCENT });
    drawParagraph(ctx, order.notes, { size: M.F11 });
  }

  gap(ctx, 8);
  drawTrailingNote(
    ctx,
    `${settings.quote_footer} Предложение действительно ${settings.quote_validity_days} дней. ${settings.vat_note}.`,
    { size: 9.5, color: MUTED },
  );

  drawFooter(ctx, settings);
  return await ctx.pdf.save();
}

async function buildInvoice(order: DocOrder, items: DocItem[], settings: DocumentSettings): Promise<Uint8Array> {
  const ctx = await createCtx(settings.logo_url, null, settings.logo_layout);
  const { num, date } = header(order);
  drawHeader(ctx, "Счёт-фактура", num, date, settings);

  const colW = (PAGE_W - M.MARGIN_X * 2 - 12) / 2;
  const cardY = ctx.y;
  drawCard(
    ctx,
    "Исполнитель",
    settings.company_legal_name,
    [
      `УНП: ${settings.company_unp}`,
      settings.company_address,
      settings.bank_account ? `р/с ${settings.bank_account}` : null,
      settings.bank_name || null,
      settings.bank_bic ? `БИК: ${settings.bank_bic}` : null,
      `${settings.company_phone} · ${settings.company_email}`,
    ],
    { x: M.MARGIN_X, width: colW },
  );
  const leftEndY = ctx.y;
  ctx.y = cardY;
  drawCard(
    ctx,
    "Плательщик",
    order.client_company || order.client_name,
    [
      order.client_company ? `Контакт: ${order.client_name}` : null,
      order.client_phone,
      order.client_email,
      order.event_date ? `Дата мероприятия: ${fmtDate(order.event_date)}` : null,
    ],
    { x: M.MARGIN_X + colW + 12, width: colW },
  );
  ctx.y = Math.min(leftEndY, ctx.y);

  gap(ctx, 8);
  const tableW = PAGE_W - M.MARGIN_X * 2;
  drawTable(
    ctx,
    [
      { title: "№", key: "n", width: tableW * 0.06, align: "right" },
      { title: "Наименование", key: "title", width: tableW * 0.49 },
      { title: "Кол-во", key: "qty", width: tableW * 0.1, align: "center", valign: "middle" },
      { title: "Ед.", key: "u", width: tableW * 0.06, align: "center" },
      { title: "Цена", key: "price", width: tableW * 0.14, align: "right" },
      { title: "Сумма", key: "sum", width: tableW * 0.15, align: "right" },
    ],
    items.length
      ? items.map((it, i) => ({
          n: String(i + 1),
          title: safe(it.title),
          qty: String(it.qty),
          u: "шт.",
          price: money(Number(it.price)),
          sum: money(Number(it.price) * Number(it.qty)),
        }))
      : [{ n: "", title: "Позиции не добавлены", qty: "", u: "", price: "", sum: "" }],
  );

  const base = items.reduce((s, it) => s + Number(it.price) * Number(it.qty), 0);
  const v = computeVat(base, vatConfig(settings));
  const total = v.gross;
  const paid = Number(order.paid ?? 0);
  const debt = Math.max(0, total - paid);
  gap(ctx, 6);
  drawSummary(ctx, [
    ...(v.enabled
      ? [
          { label: "Сумма без НДС", value: money(v.net) },
          { label: `НДС ${vatRateLabel(v.rate)}%`, value: money(v.vat) },
        ]
      : [{ label: `Итого, ${settings.vat_note}`, value: money(total) }]),
    { label: "К ОПЛАТЕ", value: money(total), emphasis: true },
    ...(paid > 0 ? [{ label: "Оплачено", value: money(paid) }] : []),
    ...(paid > 0 && debt > 0 ? [{ label: "Остаток", value: money(debt) }] : []),
  ]);

  gap(ctx, 8);
  drawParagraph(
    ctx,
    `${settings.invoice_footer} Срок оплаты: ${settings.invoice_validity_days} банковских дней.`,
    { size: 9.5, color: MUTED },
  );

  drawSignatures(
    ctx,
    {
      title: "Исполнитель",
      lines: ["Подпись: _______________"],
      signName: `${settings.signer_name} / ${settings.signer_title}`,
    },
    {
      title: "Заказчик",
      lines: ["Подпись: _______________"],
      signName: order.client_name,
    },
  );

  drawFooter(ctx, settings);
  return await ctx.pdf.save();
}

async function buildContract(order: DocOrder, items: DocItem[], settings: DocumentSettings): Promise<Uint8Array> {
  const ctx = await createCtx(settings.logo_url, null, settings.logo_layout);
  const { num, date } = header(order);
  drawHeader(ctx, "Договор", num, date, settings);

  drawText(ctx, `ДОГОВОР ОКАЗАНИЯ УСЛУГ № ${num}`, {
    bold: true,
    size: M.F16,
    align: "center",
    x: M.MARGIN_X,
    width: PAGE_W - M.MARGIN_X * 2,
  });
  drawText(ctx, `г. ${settings.contract_jurisdiction_city} · ${date}`, {
    size: DOC_FONT_PT.small,
    color: MUTED,
    align: "center",
    x: M.MARGIN_X,
    width: PAGE_W - M.MARGIN_X * 2,
  });
  gap(ctx, 8);

  drawParagraph(
    ctx,
    `${settings.company_legal_name} (далее — «Исполнитель») в лице ${settings.signer_title} ${settings.signer_name}, действующего на основании ${settings.signer_basis}, с одной стороны, и ${order.client_company || order.client_name}${order.client_company ? ` в лице ${order.client_name}` : ""} (далее — «Заказчик»), с другой стороны, заключили настоящий Договор о нижеследующем.`,
    { size: M.F11 },
  );
  gap(ctx, 6);

  const eventDate = order.event_date ? fmtDate(order.event_date) : "по согласованию сторон";
  const total = items.reduce((s, it) => s + Number(it.price) * Number(it.qty), 0);

  const section = (n: string, title: string) => {
    gap(ctx, 6);
    drawText(ctx, `${n}. ${title}`, { bold: true, size: M.F13, color: ACCENT });
    gap(ctx, 2);
  };

  section("1", "Предмет договора");
  drawParagraph(ctx, `1.1. Исполнитель обязуется оказать Заказчику услуги по организации и техническому обеспечению мероприятия, проводимого ${eventDate}, а Заказчик — принять и оплатить услуги.`, { size: M.F11 });
  drawParagraph(ctx, "1.2. Перечень услуг и их стоимость:", { size: M.F11 });
  for (const it of items.length ? items : [{ title: "Услуги уточняются дополнительным соглашением.", qty: 0, price: 0 } as DocItem]) {
    const sum = Number(it.price) * Number(it.qty);
    const line = `  • ${safe(it.title)}${it.qty ? ` — ${it.qty} шт. × ${money(Number(it.price))} = ${money(sum)}` : ""}`;
    drawParagraph(ctx, line, { size: M.F11 });
  }

  section("2", "Стоимость услуг и порядок расчётов");
  drawParagraph(
    ctx,
    (() => {
      const cv = computeVat(total, vatConfig(settings));
      return `2.1. Общая стоимость услуг по Договору составляет ${money(cv.gross)}, ${
        cv.enabled ? `в том числе НДС ${vatRateLabel(cv.rate)}% — ${money(cv.vat)}` : settings.vat_note
      }.`;
    })(),
    { size: M.F11 },
  );
  drawParagraph(ctx, `2.2. Заказчик вносит предоплату в размере ${settings.contract_prepayment_pct}% от стоимости в течение ${settings.contract_prepayment_days} банковских дней с момента подписания Договора.`, { size: M.F11 });
  drawParagraph(ctx, "2.3. Окончательный расчёт производится не позднее даты проведения мероприятия.", { size: M.F11 });
  drawParagraph(ctx, "2.4. Оплата осуществляется безналичным перечислением на расчётный счёт Исполнителя.", { size: M.F11 });

  section("3", "Ответственность");
  drawParagraph(ctx, `3.1. За нарушение сроков оплаты Заказчик уплачивает пеню в размере ${settings.contract_late_fee_pct}% от просроченной суммы за каждый день просрочки.`, { size: M.F11 });
  drawParagraph(ctx, `3.2. В случае отказа Заказчика от услуг менее чем за ${settings.contract_cancel_days} дней до даты мероприятия предоплата не возвращается.`, { size: M.F11 });
  drawParagraph(ctx, `3.3. Споры разрешаются в суде по месту нахождения Исполнителя (г. ${settings.contract_jurisdiction_city}).`, { size: M.F11 });

  (settings.contract_sections ?? []).forEach((s, i) => {
    section(String(i + 4), s.title);
    for (const p of s.paragraphs ?? []) drawParagraph(ctx, p, { size: M.F11 });
  });

  gap(ctx, 8);
  drawSignatures(
    ctx,
    {
      title: "Исполнитель",
      lines: [
        settings.company_legal_name,
        `УНП ${settings.company_unp}`,
        settings.company_address,
        settings.bank_account ? `р/с ${settings.bank_account}` : "",
      ],
      signName: `${settings.signer_name}, ${settings.signer_title}`,
    },
    {
      title: "Заказчик",
      lines: [
        order.client_company || order.client_name,
        order.client_phone ?? "",
        order.client_email ?? "",
      ],
      signName: order.client_name,
    },
  );

  drawFooter(ctx, settings);
  return await ctx.pdf.save();
}

async function buildAct(order: DocOrder, items: DocItem[], settings: DocumentSettings): Promise<Uint8Array> {
  const ctx = await createCtx(settings.logo_url, null, settings.logo_layout);
  const { num, date } = header(order);
  drawHeader(ctx, "Акт оказанных услуг", num, date, settings);

  const colW = (PAGE_W - M.MARGIN_X * 2 - 12) / 2;
  const startY = ctx.y;
  drawCard(
    ctx,
    "Исполнитель",
    settings.company_legal_name,
    [
      `УНП: ${settings.company_unp}`,
      settings.company_address,
      `${settings.company_phone} · ${settings.company_email}`,
    ],
    { x: M.MARGIN_X, width: colW },
  );
  const leftEnd = ctx.y;
  ctx.y = startY;
  drawCard(
    ctx,
    "Заказчик",
    order.client_company || order.client_name,
    [
      order.client_company ? `Контакт: ${order.client_name}` : null,
      order.client_phone,
      order.client_email,
    ],
    { x: M.MARGIN_X + colW + 12, width: colW },
  );
  ctx.y = Math.min(leftEnd, ctx.y);

  gap(ctx, 8);
  drawParagraph(ctx, settings.act_intro, { size: M.F11 });

  gap(ctx, 6);
  const eventDate = order.event_date ? fmtDate(order.event_date) : "—";
  drawText(ctx, `Дата оказания услуг: ${eventDate}`, { size: M.F11, bold: true });
  gap(ctx, 4);

  const tableW = PAGE_W - M.MARGIN_X * 2;
  drawTable(
    ctx,
    [
      { title: "№", key: "n", width: tableW * 0.06, align: "right" },
      { title: "Наименование", key: "title", width: tableW * 0.49 },
      { title: "Кол-во", key: "qty", width: tableW * 0.1, align: "center", valign: "middle" },
      { title: "Ед.", key: "u", width: tableW * 0.06, align: "center" },
      { title: "Цена", key: "price", width: tableW * 0.14, align: "right" },
      { title: "Сумма", key: "sum", width: tableW * 0.15, align: "right" },
    ],
    items.length
      ? items.map((it, i) => ({
          n: String(i + 1),
          title: safe(it.title),
          qty: String(it.qty),
          u: "шт.",
          price: money(Number(it.price)),
          sum: money(Number(it.price) * Number(it.qty)),
        }))
      : [{ n: "", title: "Позиции не добавлены", qty: "", u: "", price: "", sum: "" }],
  );

  const actBase = items.reduce((s, it) => s + Number(it.price) * Number(it.qty), 0);
  const actVat = computeVat(actBase, vatConfig(settings));
  const total = actVat.gross;
  gap(ctx, 6);
  drawSummary(ctx, [
    ...(actVat.enabled
      ? [
          { label: "Сумма без НДС", value: money(actVat.net) },
          { label: `НДС ${vatRateLabel(actVat.rate)}%`, value: money(actVat.vat) },
        ]
      : []),
    { label: "ИТОГО оказано услуг на сумму", value: money(total), emphasis: true },
    ...(actVat.enabled ? [] : [{ label: settings.vat_note, value: "—" }]),
  ]);

  gap(ctx, 6);
  drawParagraph(ctx, "Услуги оказаны полностью и в срок. Заказчик претензий по объёму, качеству и срокам оказания услуг не имеет.", { size: M.F11 });

  drawSignatures(
    ctx,
    {
      title: "Сдал — Исполнитель",
      lines: [settings.company_legal_name, `УНП ${settings.company_unp}`],
      signName: `${settings.signer_name}, ${settings.signer_title}`,
    },
    {
      title: "Принял — Заказчик",
      lines: [order.client_company || order.client_name],
      signName: order.client_name,
    },
  );

  gap(ctx, 4);
  drawParagraph(
    ctx,
    `${settings.act_footer} Срок приёмки: ${settings.act_validity_days} рабочих дней.`,
    { size: 9.5, color: MUTED },
  );

  drawFooter(ctx, settings);
  return await ctx.pdf.save();
}

export async function buildOrderDocPdf(
  kind: DocKind,
  order: DocOrder,
  items: DocItem[],
  settings: DocumentSettings,
): Promise<Uint8Array> {
  applyDensity("comfortable");
  if (kind === "quote") return buildQuote(order, items, settings);

  if (kind === "invoice") return buildInvoice(order, items, settings);
  if (kind === "contract") return buildContract(order, items, settings);
  return buildAct(order, items, settings);
}

export const DOC_PDF_FILENAMES: Record<DocKind, string> = {
  quote: "Коммерческое_предложение",
  invoice: "Счёт",
  contract: "Договор",
  act: "Акт",
};

// Понятное имя файла на основе данных заказа.
// Пример: "КП №ABCD1234 Иванов.pdf" / "Договор №ABCD1234 ООО Ромашка.pdf"
const DOC_SHORT_LABEL: Record<DocKind, string> = {
  quote: "КП",
  invoice: "Счёт",
  contract: "Договор",
  act: "Акт",
};
export function buildAttachmentFilename(
  kind: DocKind,
  order: { id: string; order_number?: string | null; client_name?: string | null; client_company?: string | null },
): string {
  const numFromDb = (order.order_number ?? "").trim();
  const orderShort = numFromDb ? numFromDb.replaceAll("/", ".") : String(order.id).slice(0, 8).toUpperCase();
  const owner = (order.client_company || order.client_name || "").trim();
  let suffix = owner;
  if (!order.client_company && owner) suffix = owner.split(/\s+/)[0];
  suffix = suffix.replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, " ").slice(0, 48).trim();
  const base = `${DOC_SHORT_LABEL[kind]} №${orderShort}${suffix ? ` ${suffix}` : ""}`;
  return `${base}.pdf`;
}

// === Standalone КП (раздел «Документы → КП») ===
import type { Quote, QuoteItem } from "@/lib/quotes-model";
import { computeTotals, amountToWords } from "@/lib/quotes-model";
import { applyCompanyOverrides } from "@/lib/documents/company";
import { quoteNumberDisplay, quoteValidUntil, buildPlaceholderValues, buildNumericValues, effectiveBlocks, blockText } from "@/lib/documents/quote-html";
import { applyPlaceholders } from "@/lib/quote-blocks";

function bulletList(ctx: DocCtx, text: string) {
  for (const raw of String(text ?? "").split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    drawParagraph(ctx, `•  ${line}`, { size: M.F11, indent: 6 });
  }
}

/**
 * Автоподбор плотности: сначала «комфортно» (1:1 с превью), затем компактнее —
 * чтобы КП не растягивалось на лишние листы (по умолчанию цель — 2 листа).
 */
export async function buildStandaloneQuotePdf(
  quote: Quote,
  items: QuoteItem[],
  settings: DocumentSettings,
  opts: { density?: DocDensity | "auto"; maxPages?: number } = {},
): Promise<Uint8Array> {
  const preset = resolvePrintPreset(
    quote.template,
    (settings as { quote_print_presets?: unknown }).quote_print_presets as never,
    quote.design as unknown as Record<string, unknown>,
  );
  const requested = opts.density ?? "auto";
  const maxPages = opts.maxPages ?? preset.maxPages;
  if (requested !== "auto") return (await renderQuotePdf(quote, items, settings, requested, preset)).bytes;

  const ladder: DocDensity[] = DOC_DENSITY_LADDER;
  let last: { bytes: Uint8Array; pages: number } | null = null;
  for (const density of ladder) {
    last = await renderQuotePdf(quote, items, settings, density, preset);
    if (last.pages <= maxPages) return last.bytes;
  }
  return last!.bytes;
}

async function renderQuotePdf(
  quote: Quote,
  items: QuoteItem[],
  settings: DocumentSettings,
  density: DocDensity,
  preset: DocPrintPreset = BASE_PRINT_PRESET,
): Promise<{ bytes: Uint8Array; pages: number }> {
  applyDensity(density, preset);
  const eff = applyCompanyOverrides(settings, quote.company_overrides);

  const c = {
    legal: eff.company_legal_name,
    brand: eff.company_brand,
    unp: eff.company_unp,
    address: eff.company_address,
    phone: eff.company_phone,
    email: eff.company_email,
    website: eff.company_website,
    bank_name: eff.bank_name,
    bank_bic: eff.bank_bic,
    bank_account: eff.bank_account,
    signer_name: eff.signer_name,
    signer_title: eff.signer_title,
    signer_basis: eff.signer_basis,
  };

  const ctx = await createCtx(
    quote.design.show_logo ? (quote.logo_url || settings.logo_url) : null,
    null,
    quote.logo_layout,
    resolveDocFont(quote.font_family, (settings as { font_family?: unknown }).font_family),
  );

  drawHeader(ctx, "Коммерческое предложение", quoteNumberDisplay(quote), fmtDate(quote.doc_date), eff, {
    validUntil: quoteValidUntil(quote),
  });


  const map = buildPlaceholderValues(quote, items, settings);
  const numbers = buildNumericValues(quote, items);
  const t = computeTotals(quote, items);
  const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);
  const colW = (PAGE_W - M.MARGIN_X * 2 - 12) / 2;

  const hidden = new Set<string>();
  if (!quote.design.show_cover) hidden.add("cover");
  if (!quote.design.show_requisites) hidden.add("requisites");
  if (!quote.design.show_signature) hidden.add("signature");

  const heading = (title: string) => {
    gap(ctx, 8);
    ensureSpace(ctx, M.F13 * 2);
    drawTracked(ctx.page, title.toUpperCase(), {
      x: M.MARGIN_X,
      y: ctx.y - M.F13,
      size: M.F13,
      font: ctx.bold,
      color: ACCENT,
      tracking: M.F13 * 0.05,
    });
    ctx.y -= M.F13 * M.LH_LOOSE;
    gap(ctx, 2);
  };

  for (const b of effectiveBlocks(quote, items, settings)) {
    if (hidden.has(b.type)) continue;
    const text = blockText(b, quote, map, numbers);

    switch (b.type) {
      case "cover": {
        // Обложка — карточка с мягкой акцентной заливкой, как в превью
        const coverTitle = applyPlaceholders(
          quote.title || "Предложение по организации мероприятия",
          map,
          numbers,
        );
        const innerW = PAGE_W - M.MARGIN_X * 2 - 40;
        const tFont = displayFont(ctx, coverTitle);
        const tLines = wrapText(tFont, coverTitle, M.F_COVER, innerW);
        const pLines = text ? wrapText(ctx.regular, text, M.F11, innerW) : [];
        const boxH = 18 + tLines.length * M.F_COVER * M.LH_TIGHT + (pLines.length ? 8 + pLines.length * M.F11 * M.LH_LOOSE : 0) + 18;
        gap(ctx, 6);
        ensureSpace(ctx, boxH + 8);
        roundedRect(ctx.page, {
          x: M.MARGIN_X,
          y: ctx.y - boxH,
          width: PAGE_W - M.MARGIN_X * 2,
          height: boxH,
          radius: 12,
          color: c01(mixWithWhite(BRAND_ACCENT, 0.9)),
          borderColor: ACCENT_BORDER,
          borderWidth: 0.6,
        });
        let cyc = ctx.y - 18;
        for (const line of tLines) {
          ctx.page.drawText(line, { x: M.MARGIN_X + 20, y: cyc - M.F_COVER, size: M.F_COVER, font: tFont, color: TEXT });
          cyc -= M.F_COVER * M.LH_TIGHT;
        }
        if (pLines.length) cyc -= 8;
        for (const line of pLines) {
          ctx.page.drawText(line, { x: M.MARGIN_X + 20, y: cyc - M.F11, size: M.F11, font: ctx.regular, color: MUTED });
          cyc -= M.F11 * M.LH_LOOSE;
        }
        ctx.y -= boxH + 8;
        break;
      }

      case "client": {
        gap(ctx, 6);
        drawCard(
          ctx,
          b.title || "Заказчик",
          quote.client_company || quote.client_name || "—",
          [
            quote.client_company && quote.client_name ? `Контакт: ${quote.client_name}` : null,
            quote.client_unp ? `УНП ${quote.client_unp}` : null,
            quote.client_phone,
            quote.client_email,
            quote.client_address,
          ],
          { x: M.MARGIN_X, width: colW * 2 + 12 },
        );
        break;
      }
      case "event": {
        gap(ctx, 6);
        // те же подписи и сетка, что в HTML-превью (.info-table)
        drawInfoCard(
          ctx,
          b.title || "Мероприятие",
          [
            ["Дата мероприятия", quote.event_date ? fmtDate(quote.event_date) : ""],
            ["Время", [quote.event_time_start, quote.event_time_end].filter(Boolean).join(" — ")],
            ["Площадка", quote.venue || ""],
            ["Гостей", quote.guests_count != null ? String(quote.guests_count) : ""],
            ["Формат", quote.event_format || ""],
            ["Монтаж / демонтаж", quote.setup_note || ""],
          ],
          quote.event_notes || null,
        );
        break;
      }

      case "items": {
        heading(b.title || "Состав предложения");
        drawTable(
          ctx,
          [
            { title: "", width: 24, key: "idx" },
            { title: "Позиция", width: PAGE_W - M.MARGIN_X * 2 - 24 - 70 - 80 - 90, key: "title" },
            { title: "Кол-во", width: 70, align: "center", valign: "middle", key: "qty" },
            { title: "Цена", width: 80, align: "right", key: "price" },
            { title: "Сумма", width: 90, align: "right", key: "sum" },
          ],
          (() => {
            const showIncludes = quote.design?.show_item_includes !== false;
            const showSubtotals = quote.design?.show_section_subtotals !== false;
            const groups = new Map<string, typeof sorted>();
            for (const it of sorted) {
              const key = (it.section || "").trim();
              if (!groups.has(key)) groups.set(key, [] as unknown as typeof sorted);
              groups.get(key)!.push(it);
            }
            const rows: TableRow[] = [];
            for (const [section, list] of groups) {
              if (section) rows.push({ _kind: "section", idx: "", title: section, qty: "", price: "", sum: "" });
              list.forEach((it, i) => {
                rows.push({
                  idx: String(i + 1),
                  title: it.title,
                  _desc: it.description || undefined,
                  _bullets:
                    showIncludes && it.includes?.length
                      ? it.includes.map((inc) => `${inc.text}${inc.note ? ` — ${inc.note}` : ""}`)
                      : undefined,
                  qty: `${it.qty} ${it.unit ?? ""}`.trim(),
                  price: money(Number(it.price)),
                  sum: money(Number(it.price) * Number(it.qty)),
                });
              });
              if (showSubtotals && section && list.length > 1) {
                rows.push({
                  _kind: "subtotal",
                  idx: "",
                  title: `Итого по разделу «${section}»`,
                  qty: "",
                  price: "",
                  sum: money(list.reduce((s, it) => s + Number(it.price) * Number(it.qty), 0)),
                });
              }
            }
            if (t.vatEnabled && quote.vat_as_line) {
              rows.push({
                _kind: "subtotal",
                idx: "",
                title: t.vatMode === "included" ? `В том числе НДС ${vatRateLabel(t.vatRate)}%` : `НДС ${vatRateLabel(t.vatRate)}%`,
                qty: "",
                price: "",
                sum: money(t.vat),
              });
            }
            return rows;
          })(),
        );


        break;
      }
      case "totals": {
        gap(ctx, 8);
        drawSummary(ctx, [
          { label: `Стоимость позиций${t.vatEnabled ? " (без НДС)" : ""}`, value: money(t.subtotal) },
          ...(t.discount ? [{ label: "Скидка", value: `− ${money(t.discount)}` }] : []),
          ...(t.delivery ? [{ label: "Доставка и логистика", value: money(t.delivery) }] : []),
          ...(t.vatEnabled
            ? [
                ...(t.discount || t.delivery ? [{ label: "Сумма без НДС", value: money(t.net) }] : []),
                { label: `НДС ${vatRateLabel(t.vatRate)}%`, value: money(t.vat) },
              ]
            : []),
          { label: t.vatEnabled ? "Итого с НДС" : "Итого", value: money(t.total), emphasis: true },
          ...(t.prepayment
            ? [
                { label: "Предоплата", value: money(t.prepayment) },
                { label: "Остаток", value: money(t.balance) },
              ]
            : []),
        ]);
        drawParagraph(
          ctx,
          `${amountToWords(t.total)}. ${
            t.vatEnabled ? `В том числе НДС ${vatRateLabel(t.vatRate)}% — ${money(t.vat)}` : quote.vat_note || settings.vat_note
          }`,
          { size: 9.5, color: MUTED },
        );
        break;
      }
      case "included":
      case "excluded": {
        if (!text) break;
        heading(b.title);
        bulletList(ctx, text);
        break;
      }
      case "timeline":
      case "terms":
      case "text": {
        if (!text) break;
        heading(b.title);
        drawParagraph(ctx, text, { size: M.F11 });
        break;
      }
      case "requisites": {
        gap(ctx, 10);
        drawCard(ctx, b.title || "Реквизиты исполнителя", c.legal, [
          c.unp ? `УНП ${c.unp}` : null,
          c.address,
          c.bank_account ? `р/с ${c.bank_account}` : null,
          c.bank_name,
          c.bank_bic ? `БИК ${c.bank_bic}` : null,
          [c.phone, c.email, c.website].filter(Boolean).join(" · "),
        ]);
        break;
      }
      case "signature": {
        drawSignatures(
          ctx,
          {
            title: "Исполнитель",
            lines: [c.legal, c.unp ? `УНП ${c.unp}` : ""],
            signName: `${c.signer_name}${c.signer_title ? `, ${c.signer_title}` : ""}`,
          },
          {
            title: "Заказчик",
            lines: [quote.client_company || quote.client_name || ""],
            signName: quote.client_name || "",
          },
        );
        break;
      }
      default:
        break;
    }
  }

  gap(ctx, 4);
  const footerText = applyPlaceholders(quote.texts.footer || settings.quote_footer, map, numbers);
  // срок действия добавляем только если его нет в тексте подвала — иначе фраза дублируется
  const validity =
    quote.validity_days && !/действительн/i.test(footerText)
      ? `Предложение действительно ${quote.validity_days} дней. `
      : "";
  drawTrailingNote(ctx, `${validity}${footerText}`, { size: 9.5, color: MUTED });

  drawFooter(ctx, eff);
  const pages = ctx.pdf.getPageCount();
  return { bytes: await ctx.pdf.save(), pages };

}


// ===================== Промо-КП =====================
export async function buildPromoQuotePdf(
  quote: PromoQuoteT,
  items: PromoItemT[],
  settings: DocumentSettings,
): Promise<Uint8Array> {
  // PDF промо-КП рисуется тем же макетом, что и превью (buildDocLayout),
  // поэтому файл по кнопке «PDF» повторяет то, что видно на экране.
  const { buildPromoQuotePreviewPdf } = await import("@/lib/documents/promo-pdf.server");
  const eff = applyCompanyOverrides(settings, quote.company_overrides);
  const companyLine = [
    `${eff.company_legal_name}${eff.company_unp ? ` · УНП ${eff.company_unp}` : ""}`.trim(),
    eff.company_address,
  ]
    .filter((s) => s && String(s).trim() !== "")
    .join(" · ");
  return await buildPromoQuotePreviewPdf(quote, items, {
    companyLine,
    fontDefault: (settings as { font_family?: unknown }).font_family,
  });
}

/** Прежний «карточный» рендер промо-КП (оставлен для сравнения/отката). */
export async function buildPromoQuotePdfLegacy(
  quote: PromoQuoteT,
  items: PromoItemT[],
  settings: DocumentSettings,
): Promise<Uint8Array> {
  applyDensity(
    "comfortable",
    resolvePrintPreset(
      "classic",
      (settings as { quote_print_presets?: unknown }).quote_print_presets as never,
      (quote as { design?: Record<string, unknown> }).design,
    ),
  );
  const eff = applyCompanyOverrides(settings, quote.company_overrides);
  const ctx = await createCtx(
    quote.logo_url || eff.logo_url,
    quote.client_logo_url,
    quote.logo_layout,
    resolveDocFont(quote.font_family, (settings as { font_family?: unknown }).font_family),
  );


  const t = computePromoTotals(quote, items);
  drawHeader(
    ctx,
    "Коммерческое предложение",
    promoNumberDisplay(quote),
    fmtDate(quote.created_at || new Date().toISOString()),
    eff,
  );

  drawCard(ctx, "Проект", quote.project || "—", [
    quote.client_name ? `Клиент: ${quote.client_name}` : null,
    quote.period ? `Период: ${quote.period}` : null,
    quote.venue ? `Место проведения: ${quote.venue}` : null,
    quote.contact_name || quote.contact_phone || quote.contact_email
      ? `Контактное лицо: ${[quote.contact_name, quote.contact_role].filter(Boolean).join(", ")}${
          quote.contact_phone ? `; ${quote.contact_phone}` : ""
        }${quote.contact_email ? `; ${quote.contact_email}` : ""}`
      : null,
  ]);

  gap(ctx, 6);
  const tableW = PAGE_W - M.MARGIN_X * 2;
  const showNotes = quote.show_notes;
  // Вторая единица («час», «смена») — отдельные колонки, только если она задана.
  const dual = hasSecondUnit(items);
  const priceTitle = PRICE_LABEL;
  const dualCols: Col[] = dual
    ? [
        { title: "Ед. изм.", key: "unit2", width: tableW * 0.08, align: "center", valign: "middle" },
        { title: "Кол-во", key: "qty2", width: tableW * 0.08, align: "center", valign: "middle" },
      ]
    : [];
  const cols: Col[] = showNotes
    ? [
        { title: "Наименование", key: "title", width: tableW * (dual ? 0.24 : 0.3) },
        { title: "Ед. изм.", key: "unit", width: tableW * (dual ? 0.09 : 0.11), align: "center", valign: "middle" },
        { title: "Кол-во", key: "qty", width: tableW * 0.08, align: "center", valign: "middle" },
        ...dualCols,
        { title: priceTitle, key: "price", width: tableW * 0.12, align: "center", valign: "middle" },
        { title: "Сумма", key: "sum", width: tableW * 0.13, align: "center", valign: "middle" },
        { title: "Примечания", key: "note", width: tableW * (dual ? 0.18 : 0.26), valign: "middle" },
      ]
    : [
        { title: "Наименование", key: "title", width: tableW * (dual ? 0.34 : 0.46) },
        { title: "Ед. изм.", key: "unit", width: tableW * (dual ? 0.11 : 0.14), align: "center", valign: "middle" },
        { title: "Кол-во", key: "qty", width: tableW * 0.1, align: "center", valign: "middle" },
        ...dualCols,
        { title: priceTitle, key: "price", width: tableW * 0.15, align: "center", valign: "middle" },
        { title: "Сумма", key: "sum", width: tableW * 0.15, align: "center", valign: "middle" },
      ];


  const rows: TableRow[] = [];
  for (const sec of groupBySection(items)) {
    if (sec.name) rows.push({ _kind: "section", title: sec.name, unit: "", qty: "", price: "", sum: "", note: "" });
    for (const it of sec.items) {
      rows.push({
        title: safe(it.title),
        _bullets:
          quote.show_item_includes && it.includes.length
            ? it.includes.map((inc) => `${safe(inc.text)}${inc.note ? ` — ${safe(inc.note)}` : ""}`)
            : undefined,
        unit: safe(it.unit),
        qty: dual ? formatNumber(it.qty) : formatTotalQty(it),
        unit2: rateUnitLabel(it) || "—",
        qty2: rateUnitLabel(it) ? formatNumber(it.multiplier) : "—",
        _span: isServiceOnlyRow(it)
          ? { from: "unit", to: dual ? "qty2" : "qty", text: safe(it.unit) || "услуга" }
          : undefined,
        price: it.price ? money(it.price) : "",
        sum: lineTotal(it) ? money(lineTotal(it)) : "",
        note: safe(it.note),
      });
    }
    if (quote.show_section_subtotals && sec.name && sec.items.length > 1) {
      rows.push({
        _kind: "subtotal",
        title: `Итого по разделу «${sec.name}»`,
        unit: "",
        qty: "",
        price: "",
        sum: money(sec.items.reduce((s, it) => s + lineTotal(it), 0)),
        note: "",
      });
    }
  }

  if (quote.management_enabled) {
    rows.push({
      title: quote.management_label,
      unit: "услуга",
      qty: "—",
      unit2: "—",
      qty2: "—",
      price: "",
      sum: money(t.management),
      note: "",
      _span: { from: "unit", to: dual ? "qty2" : "qty", text: "услуга" },
    });
  }
  if (quote.commission_enabled) {
    rows.push({
      title: quote.commission_label,
      unit: "—",
      qty: "—",
      price: "",
      sum: money(t.commission),
      note: `${quote.commission_rate}%`,
    });
  }
  if (t.vatEnabled && quote.vat_as_line) {
    rows.push({
      title: t.vatMode === "included" ? `В том числе НДС ${vatRateLabel(t.vatRate)}%` : `НДС ${vatRateLabel(t.vatRate)}%`,
      unit: "—",
      qty: "—",
      price: "",
      sum: money(t.vat),
      note: "",
    });
  }
  const tableRows = rows.length
    ? rows
    : [{ title: "Позиции не добавлены", unit: "", qty: "", price: "", sum: "", note: "" }];
  fitTableCols(ctx, cols, tableRows, tableW);
  drawTable(ctx, cols, tableRows);

  gap(ctx, 6);
  drawSummary(ctx, [
    { label: t.vatEnabled ? "Стоимость позиций (без НДС)" : "Всего", value: money(t.net) },
    ...(t.vatEnabled ? [{ label: `НДС ${vatRateLabel(t.vatRate)}%`, value: money(t.vat) }] : []),
    { label: `Итого${t.vatEnabled ? ", с НДС" : ""}`, value: money(t.totalWithVat), emphasis: true },
  ]);

  if (quote.footer_note) {
    gap(ctx, 4);
    drawTrailingNote(ctx, quote.footer_note, { size: 9.5, color: MUTED });
  }

  drawFooter(ctx, eff);
  return await ctx.pdf.save();
}
