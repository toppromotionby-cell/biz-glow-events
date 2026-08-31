// Единая сборка PDF любого документа админки для отправки в Telegram.
// Источник данных и генераторы — те же, что и у страниц рендера.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { loadDocumentSettings } from "@/lib/documents/render.server";

export { TG_DOC_KINDS, type TgDocKind } from "@/lib/telegram/doc-kinds";
import type { TgDocKind } from "@/lib/telegram/doc-kinds";

export interface TgDocExport {
  filename: string;
  bytes: Uint8Array;
  /** Подпись к файлу в чате (HTML). */
  caption: string;
}

function money(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v) || v === 0) return "";
  return `${v.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} BYN`;
}

function caption(lines: (string | null | undefined)[]): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return lines.filter((l): l is string => Boolean(l && l.trim())).map(esc).join("\n");
}

/**
 * Собирает документ по типу и идентификатору.
 * Бросает Error с человекочитаемым текстом, если документ не найден.
 */
export async function buildTelegramDoc(kind: TgDocKind, id: string): Promise<TgDocExport> {
  switch (kind) {
    case "quote":
    case "quote-internal":
      return buildQuote(id, kind === "quote-internal");
    case "promo":
    case "promo-internal":
      return buildPromo(id, kind === "promo-internal");
    case "finance":
      return buildFinance(id);
    case "paperwork":
      return buildPaperwork(id);
    case "presentation":
      return buildPresentation(id);
    case "order":
      return buildOrderPack(id);
    default:
      throw new Error("Неизвестный тип документа");
  }
}

/* --------------------------------- КП ---------------------------------- */

async function buildQuote(id: string, internal: boolean): Promise<TgDocExport> {
  const [{ normalizeQuote, normalizeItem, computeTotals }, { quoteFileName, quoteNumberDisplay }] = await Promise.all([
    import("@/lib/quotes-model"),
    import("@/lib/documents/quote-html"),
  ]);

  const [{ data: row }, { data: itemRows }] = await Promise.all([
    supabaseAdmin.from("quotes").select("*").eq("id", id).maybeSingle(),
    supabaseAdmin.from("quote_items").select("*").eq("quote_id", id).order("sort_order"),
  ]);
  if (!row) throw new Error("КП не найдено");

  const settings = await loadDocumentSettings(
    supabaseAdmin as never,
    (row as { company_id?: string | null }).company_id ?? null,
  );
  const quote = normalizeQuote(row as Record<string, unknown>);
  const items = ((itemRows ?? []) as Record<string, unknown>[]).map(normalizeItem);
  const totals = computeTotals(quote, items);
  const client = quote.client_company || quote.client_name || "";
  const label = `КП №${quoteNumberDisplay(quote)}`;

  if (internal) {
    const [{ quoteEconRows }, { buildEconomicsPdf }] = await Promise.all([
      import("@/lib/documents/economics-source"),
      import("@/lib/documents/economics-pdf.server"),
    ]);
    const bytes = await buildEconomicsPdf(quoteEconRows(items), settings, {
      docLabel: label,
      client: client || undefined,
      netRevenue: totals.net,
    });
    return {
      filename: quoteFileName(quote).replace(/\.pdf$/i, "") + "-внутренний.pdf",
      bytes,
      caption: caption([`${label} — внутренний расчёт`, client, money(totals.net), "Только для внутреннего пользования"]),
    };
  }

  const { buildStandaloneQuotePdf } = await import("@/lib/documents/pdf.server");
  return {
    filename: quoteFileName(quote),
    bytes: await buildStandaloneQuotePdf(quote, items, settings),
    caption: caption([label, client, money(totals.total)]),
  };
}

/* ------------------------------ Промо-КП -------------------------------- */

async function buildPromo(id: string, internal: boolean): Promise<TgDocExport> {
  const { normalizePromoQuote, normalizePromoItem, promoFileName, promoNumberDisplay, computePromoTotals } =
    await import("@/lib/promo-quote-model");

  const [{ data: row }, { data: itemRows }] = await Promise.all([
    supabaseAdmin.from("promo_quotes").select("*").eq("id", id).maybeSingle(),
    supabaseAdmin.from("promo_quote_items").select("*").eq("quote_id", id).order("sort_order"),
  ]);
  if (!row) throw new Error("Промо-КП не найдено");

  const settings = await loadDocumentSettings(
    supabaseAdmin as never,
    (row as { company_id?: string | null }).company_id ?? null,
  );
  const quote = normalizePromoQuote(row as Record<string, unknown>);
  const items = ((itemRows ?? []) as Record<string, unknown>[]).map(normalizePromoItem);
  const totals = computePromoTotals(quote, items);
  const client = quote.client_name || "";
  const label = `КП промо №${promoNumberDisplay(quote)}`;

  if (internal) {
    const [{ promoEconRows }, { buildEconomicsPdf }] = await Promise.all([
      import("@/lib/documents/economics-source"),
      import("@/lib/documents/economics-pdf.server"),
    ]);
    const bytes = await buildEconomicsPdf(promoEconRows(items), settings, {
      docLabel: label,
      client: client || undefined,
      netLabel: "после комиссии, скидки и НДС",
      netRevenue: totals.net,
    });
    return {
      filename: promoFileName(quote, "pdf").replace(/\.pdf$/i, "") + "-внутренний.pdf",
      bytes,
      caption: caption([`${label} — внутренний расчёт`, client, money(totals.net), "Только для внутреннего пользования"]),
    };
  }

  const { buildPromoQuotePdf } = await import("@/lib/documents/pdf.server");
  return {
    filename: promoFileName(quote, "pdf"),
    bytes: await buildPromoQuotePdf(quote, items, settings),
    caption: caption([label, client, money(totals.totalWithVat || totals.net)]),
  };
}

/* ------------------------ Финансовые документы -------------------------- */

async function buildFinance(id: string): Promise<TgDocExport> {
  const { buildOrderDocPdf, buildAttachmentFilename } = await import("@/lib/documents/pdf.server");

  const { data: doc } = await supabaseAdmin.from("finance_documents").select("*").eq("id", id).maybeSingle();
  if (!doc) throw new Error("Документ не найден");

  const settings = await loadDocumentSettings(
    supabaseAdmin as never,
    (doc as { company_id?: string | null }).company_id ?? null,
  );
  const kind = ((doc as { kind?: string }).kind ?? "invoice") as "invoice" | "contract" | "act";
  const items = (Array.isArray(doc.items) ? doc.items : []).map((raw) => {
    const it = (raw ?? {}) as Record<string, unknown>;
    return { title: String(it.title ?? ""), qty: Number(it.qty ?? 1), price: Number(it.price ?? 0) };
  });
  const order = {
    id: String(doc.id),
    order_number: doc.doc_number ?? null,
    client_name: doc.client_name || "Клиент",
    client_company: doc.client_company || null,
    client_phone: doc.client_phone || null,
    client_email: doc.client_email || null,
    event_date: doc.event_date ?? null,
    notes: doc.notes || null,
    paid: doc.paid ?? 0,
  };
  const label = kind === "invoice" ? "Счёт" : kind === "contract" ? "Договор" : "Акт";
  const total = items.reduce((s, i) => s + i.qty * i.price, 0);

  return {
    filename: buildAttachmentFilename(kind, order as never),
    bytes: await buildOrderDocPdf(kind, order as never, items, settings),
    caption: caption([
      `${label} №${doc.doc_number ?? ""}`.trim(),
      order.client_company || order.client_name,
      money(total),
    ]),
  };
}

/* --------------------- Корпоративные документы -------------------------- */

async function buildPaperwork(id: string): Promise<TgDocExport> {
  const [{ normalizeCompanyProfile }, model, vars, { buildPaperworkPdf }, { clientLogoUrlFrom }] = await Promise.all([
    import("@/lib/documents/company-profile"),
    import("@/lib/paperwork/model"),
    import("@/lib/paperwork/variables"),
    import("@/lib/paperwork/pdf.server"),
    import("@/lib/paperwork/html"),
  ]);

  const { data: row } = await supabaseAdmin.from("paperwork_documents").select("*").eq("id", id).maybeSingle();
  if (!row) throw new Error("Документ не найден");

  const doc = model.normalizeDocument(row as Record<string, unknown>);
  const [{ data: companyRow }, { data: blankRow }] = await Promise.all([
    doc.company_profile_id
      ? supabaseAdmin.from("company_profiles").select("*").eq("id", doc.company_profile_id).maybeSingle()
      : Promise.resolve({ data: null }),
    doc.company_profile_id
      ? supabaseAdmin
          .from("paperwork_brand_blanks")
          .select("settings")
          .eq("company_profile_id", doc.company_profile_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const company = companyRow ? normalizeCompanyProfile(companyRow as Record<string, unknown>) : null;
  const blank = model.normalizeBlank((blankRow as { settings?: unknown } | null)?.settings ?? model.DEFAULT_BLANK);
  const values = vars.resolveValues(vars.autoContext(company, doc), doc.values);
  const blocks = vars.applyVarsToBlocks(doc.blocks, values);

  return {
    filename: model.pwFileName(doc.title, "pdf"),
    bytes: await buildPaperworkPdf({ doc, blocks, company, blank, clientLogoUrl: clientLogoUrlFrom(values) }),
    caption: caption([doc.title, company?.name ?? null]),
  };
}

/* ----------------------------- Презентации ------------------------------ */

async function buildPresentation(id: string): Promise<TgDocExport> {
  const [{ presentationFileName }, { loadPresentationBundle, buildBundlePdf }] = await Promise.all([
    import("@/lib/presentations/model"),
    import("@/lib/presentations/render.server"),
  ]);

  const bundle = await loadPresentationBundle({ id });
  if (!bundle) throw new Error("Презентация не найдена");

  return {
    filename: presentationFileName(bundle.presentation.title, "pdf"),
    bytes: await buildBundlePdf(bundle),
    caption: caption([
      bundle.presentation.title,
      `Слайдов: ${bundle.slides.length}`,
    ]),
  };
}

/* ------------------------- Документы по заявке -------------------------- */

async function buildOrderPack(id: string): Promise<TgDocExport> {
  const [{ buildOrderDocPdf, buildAttachmentFilename }, { DOC_LABELS }] = await Promise.all([
    import("@/lib/documents/pdf.server"),
    import("@/lib/documents/build.server"),
  ]);

  const [{ data: order }, { data: items }] = await Promise.all([
    supabaseAdmin
      .from("orders")
      .select("id, order_number, client_name, client_company, client_phone, client_email, event_date, notes, paid, total")
      .eq("id", id)
      .maybeSingle(),
    supabaseAdmin.from("order_items").select("title, qty, price").eq("order_id", id),
  ]);
  if (!order) throw new Error("Заявка не найдена");

  const settings = await loadDocumentSettings(supabaseAdmin as never);
  const rows = (items ?? []).map((i) => ({
    title: String(i.title),
    qty: Number(i.qty ?? 1),
    price: Number(i.price ?? 0),
  }));

  return {
    filename: buildAttachmentFilename("quote", order as never),
    bytes: await buildOrderDocPdf("quote", order as never, rows, settings),
    caption: caption([
      `${DOC_LABELS.quote ?? "КП"} по заявке №${(order as { order_number?: string | null }).order_number ?? ""}`.trim(),
      (order as { client_company?: string | null }).client_company ||
        (order as { client_name?: string | null }).client_name ||
        null,
      money((order as { total?: number | null }).total),
    ]),
  };
}
