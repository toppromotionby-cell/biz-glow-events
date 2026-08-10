// Проверки блоков документа КП: пустые блоки, битые формулы и данные,
// из-за которых превью показало бы некорректные суммы или пустые разделы.
// Browser-safe: используется в админке рядом с живым превью.
import {
  QUOTE_BLOCK_LABELS,
  defaultBlocksForTemplate,
  evaluateBlockCondition,
  evaluateFormula,
  type QuoteBlock,
} from "@/lib/quote-blocks";
import { checkQuote, computeTotals, type Quote, type QuoteCheck, type QuoteItem } from "@/lib/quotes-model";
import type { DocumentSettings } from "@/lib/document-settings.functions";
import { blockText, buildConditionContext, buildNumericValues, buildPlaceholderValues } from "@/lib/documents/quote-html";

const FORMULA_RE = /\{\{=\s*([^}]+)\}\}/g;

/** Блоки, которые печатают только данные (текст не требуется). */
const DATA_BLOCKS = new Set<QuoteBlock["type"]>(["items", "totals", "requisites", "signature", "client", "event", "cover"]);

function blockLabel(b: QuoteBlock): string {
  return b.title?.trim() || QUOTE_BLOCK_LABELS[b.type] || b.type;
}

/**
 * Проверка блоков документа с учётом условий показа и фактических данных.
 */
export function checkQuoteBlocks(quote: Quote, items: QuoteItem[], settings: DocumentSettings): QuoteCheck[] {
  const out: QuoteCheck[] = [];
  const list = quote.blocks?.length ? quote.blocks : defaultBlocksForTemplate(quote.template ?? "classic");
  const totals = computeTotals(quote, items);
  const ctx = buildConditionContext(quote, items, settings);
  const map = buildPlaceholderValues(quote, items, settings);
  const numbers = buildNumericValues(quote, items);

  let visible = 0;

  for (const b of list) {
    if (!b.enabled) continue;
    const label = blockLabel(b);
    const ref = { scope: "block" as const, refId: b.id };
    const raw = (b.content ?? "").trim();
    const text = blockText(b, quote, map, numbers).trim();
    const shown = evaluateBlockCondition(b.condition, ctx, Boolean(text));
    if (shown) visible += 1;

    // Битые формулы: выражение уедет в документ как текст.
    for (const m of raw.matchAll(FORMULA_RE)) {
      const expr = (m[1] ?? "").trim();
      if (!expr || evaluateFormula(expr, numbers) === null) {
        out.push({ level: "error", code: "block_formula", message: `${label}: не вычисляется формула «${expr || "пусто"}»`, ...ref });
      }
    }

    if (!DATA_BLOCKS.has(b.type) && !text) {
      out.push({ level: "warn", code: "block_empty", message: `${label}: блок включён, но текста нет — в документ он не попадёт`, ...ref });
    }
    if (b.type === "items" && !items.length) {
      out.push({ level: "error", code: "block_items_empty", message: `${label}: блок состава включён, но позиций нет`, ...ref });
    }
    if (b.type === "totals" && totals.total <= 0) {
      out.push({ level: "error", code: "block_totals_zero", message: `${label}: блок итогов покажет 0 — нет сумм по позициям`, ...ref });
    }
    if (b.type === "requisites" && !ctx.has_requisites) {
      out.push({ level: "warn", code: "block_requisites", message: `${label}: нет УНП и расчётного счёта — блок реквизитов будет скрыт`, ...ref });
    }
    if (b.type === "signature" && !(quote.company_overrides.signer_name || settings.signer_name || "").trim()) {
      out.push({ level: "warn", code: "block_signature", message: `${label}: не указан подписант — подпись останется пустой`, ...ref });
    }
    if (!shown && b.condition && b.condition !== "always") {
      out.push({ level: "info", code: "block_hidden", message: `${label}: скрыт по условию показа — данных для него нет`, ...ref });
    }
  }

  if (!visible) {
    out.push({ level: "error", code: "blocks_empty", scope: "block", message: "В документе нет ни одного видимого блока" });
  }
  return out;
}

/** Полный список проверок документа: поля, позиции, итоги и блоки. */
export function checkQuoteDocument(quote: Quote, items: QuoteItem[], settings: DocumentSettings): QuoteCheck[] {
  return [...checkQuote(quote, items), ...checkQuoteBlocks(quote, items, settings)];
}

/** Замечания, сгруппированные по id позиции — для подсветки строк в таблице. */
export function itemIssueMap(checks: QuoteCheck[]): Record<string, QuoteCheck[]> {
  const out: Record<string, QuoteCheck[]> = {};
  for (const c of checks) {
    if (c.scope !== "item" || !c.refId) continue;
    (out[c.refId] ??= []).push(c);
  }
  return out;
}

/** Замечания, сгруппированные по id блока — для подсветки в конструкторе. */
export function blockIssueMap(checks: QuoteCheck[]): Record<string, QuoteCheck[]> {
  const out: Record<string, QuoteCheck[]> = {};
  for (const c of checks) {
    if (c.scope !== "block" || !c.refId) continue;
    (out[c.refId] ??= []).push(c);
  }
  return out;
}
