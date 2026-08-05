// Публичный доступ к КП по токену: загрузка, отметка о просмотре, ответ клиента.
// Используется серверным маршрутом /kp/$token (без авторизации, только по токену).
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { loadDocumentSettings } from "@/lib/documents/render.server";
import { buildQuoteHtmlDoc, quoteFileName, quoteNumberDisplay } from "@/lib/documents/quote-html";
import { buildPromoQuoteHtmlDoc } from "@/lib/documents/promo-quote-html";
import { buildStandaloneQuotePdf, buildPromoQuotePdf } from "@/lib/documents/pdf.server";
import { normalizeQuote, normalizeItem, type Quote, type QuoteItem } from "@/lib/quotes-model";
import {
  normalizePromoQuote, normalizePromoItem, promoFileName, promoNumberDisplay,
  type PromoQuote, type PromoItem,
} from "@/lib/promo-quote-model";

export type PublicDoc =
  | { kind: "quote"; quote: Quote; items: QuoteItem[]; settings: Awaited<ReturnType<typeof loadDocumentSettings>> }
  | { kind: "promo"; quote: PromoQuote; items: PromoItem[] };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isToken(v: string): boolean {
  return UUID_RE.test(v);
}

/** Найти документ по публичному токену (сначала обычное КП, затем промо). */
export async function loadPublicDoc(token: string): Promise<PublicDoc | null> {
  if (!isToken(token)) return null;

  const { data: q } = await supabaseAdmin
    .from("quotes").select("*").eq("public_token", token).eq("is_template", false).maybeSingle();
  if (q) {
    const row = q as Record<string, unknown>;
    const [{ data: items }, settings] = await Promise.all([
      supabaseAdmin.from("quote_items").select("*").eq("quote_id", row.id as string).order("sort_order"),
      loadDocumentSettings(supabaseAdmin as never),
    ]);
    return {
      kind: "quote",
      quote: normalizeQuote(row),
      items: ((items ?? []) as Record<string, unknown>[]).map(normalizeItem),
      settings,
    };
  }

  const { data: p } = await supabaseAdmin
    .from("promo_quotes").select("*").eq("public_token", token).eq("is_template", false).maybeSingle();
  if (p) {
    const row = p as Record<string, unknown>;
    const { data: items } = await supabaseAdmin
      .from("promo_quote_items").select("*").eq("quote_id", row.id as string).order("sort_order");
    return {
      kind: "promo",
      quote: normalizePromoQuote(row),
      items: ((items ?? []) as Record<string, unknown>[]).map(normalizePromoItem),
    };
  }
  return null;
}

/** Отметить первый просмотр клиентом. */
export async function markViewed(doc: PublicDoc): Promise<void> {
  const table = doc.kind === "quote" ? "quotes" : "promo_quotes";
  if (doc.quote.viewed_at) return;
  await supabaseAdmin.from(table).update({ viewed_at: new Date().toISOString() }).eq("id", doc.quote.id);
}

/** Зафиксировать решение клиента. */
export async function applyClientResponse(
  doc: PublicDoc,
  response: "accepted" | "rejected",
  comment: string,
): Promise<void> {
  const table = doc.kind === "quote" ? "quotes" : "promo_quotes";
  await supabaseAdmin
    .from(table)
    .update({
      client_response: response,
      client_comment: comment.slice(0, 2000),
      responded_at: new Date().toISOString(),
      status: response,
    })
    .eq("id", doc.quote.id);
}

export function docTitle(doc: PublicDoc): string {
  return doc.kind === "quote"
    ? `КП ${quoteNumberDisplay(doc.quote)}`
    : `КП ${promoNumberDisplay(doc.quote)}`;
}

export function docFileName(doc: PublicDoc): string {
  return doc.kind === "quote" ? quoteFileName(doc.quote) : promoFileName(doc.quote, "pdf");
}

export async function buildDocPdf(doc: PublicDoc): Promise<Uint8Array> {
  if (doc.kind === "quote") return buildStandaloneQuotePdf(doc.quote, doc.items, doc.settings);
  const settings = await loadDocumentSettings(supabaseAdmin as never);
  return buildPromoQuotePdf(doc.quote, doc.items, settings);
}

function esc(s: unknown): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const ACCENT = "#FF7500";

/** Полная HTML-страница для клиента: сам документ + панель действий. */
export function buildPublicPage(doc: PublicDoc, token: string, opts: { justResponded?: boolean } = {}): string {
  const base = doc.kind === "quote"
    ? buildQuoteHtmlDoc(doc.quote, doc.items, doc.settings)
    : buildPromoQuoteHtmlDoc(doc.quote, doc.items);

  const responded = String(doc.quote.client_response ?? "") || (opts.justResponded ? "accepted" : "");
  const decided = responded === "accepted" || responded === "rejected";

  const bar = `
<div class="kp-bar">
  <div class="kp-bar-inner">
    <div class="kp-bar-title">${esc(docTitle(doc))}</div>
    <div class="kp-bar-actions">
      <a class="kp-btn kp-ghost" href="/kp/${esc(token)}?format=pdf">Скачать PDF</a>
      ${decided
        ? `<span class="kp-state ${responded === "accepted" ? "ok" : "no"}">${responded === "accepted" ? "Предложение согласовано" : "Вы отклонили предложение"}</span>`
        : `<button class="kp-btn kp-primary" type="button" onclick="kpOpen('accepted')">Согласовать</button>
           <button class="kp-btn kp-ghost" type="button" onclick="kpOpen('rejected')">Отказаться</button>`}
    </div>
  </div>
</div>
${decided ? "" : `
<div class="kp-modal" id="kpModal">
  <form class="kp-card" method="post" action="/kp/${esc(token)}">
    <input type="hidden" name="response" id="kpResponse" value="accepted" />
    <h3 id="kpTitle">Согласовать предложение</h3>
    <p class="kp-hint">Мы получим ваше решение и свяжемся с вами. Можно добавить комментарий.</p>
    <textarea name="comment" rows="4" placeholder="Комментарий (необязательно)"></textarea>
    <div class="kp-card-actions">
      <button type="button" class="kp-btn kp-ghost" onclick="kpClose()">Отмена</button>
      <button type="submit" class="kp-btn kp-primary">Отправить</button>
    </div>
  </form>
</div>`}
<style>
  body { padding-top: 76px !important; }
  .kp-bar { position: fixed; top: 0; left: 0; right: 0; z-index: 50; background: #0b0b0f; color: #f4f4f5;
    border-bottom: 1px solid rgba(255,255,255,.08); }
  .kp-bar-inner { max-width: 1120px; margin: 0 auto; padding: 12px 20px; display: flex; gap: 16px;
    align-items: center; justify-content: space-between; flex-wrap: wrap; font-family: Inter, system-ui, sans-serif; }
  .kp-bar-title { font-weight: 600; font-size: 14px; }
  .kp-bar-actions { display: flex; gap: 8px; align-items: center; }
  .kp-btn { font: inherit; font-size: 13px; padding: 8px 14px; border-radius: 10px; cursor: pointer;
    border: 1px solid rgba(255,255,255,.18); background: transparent; color: #f4f4f5; text-decoration: none; }
  .kp-btn:hover { border-color: ${ACCENT}; }
  .kp-primary { background: ${ACCENT}; border-color: ${ACCENT}; color: #16110a; font-weight: 600; }
  .kp-state { font-size: 13px; padding: 6px 12px; border-radius: 999px; }
  .kp-state.ok { background: rgba(52,211,153,.15); color: #34d399; }
  .kp-state.no { background: rgba(248,113,113,.15); color: #f87171; }
  .kp-modal { display: none; position: fixed; inset: 0; z-index: 60; background: rgba(0,0,0,.55);
    align-items: center; justify-content: center; padding: 20px; }
  .kp-modal.open { display: flex; }
  .kp-card { background: #fff; color: #111; border-radius: 16px; padding: 22px; width: 100%; max-width: 460px;
    font-family: Inter, system-ui, sans-serif; box-shadow: 0 20px 60px rgba(0,0,0,.35); }
  .kp-card h3 { margin: 0 0 6px; font-size: 17px; }
  .kp-hint { margin: 0 0 12px; font-size: 13px; color: #6b7280; }
  .kp-card textarea { width: 100%; box-sizing: border-box; border: 1px solid #d4d4d8; border-radius: 10px;
    padding: 10px; font: inherit; font-size: 14px; resize: vertical; }
  .kp-card-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; }
  .kp-card-actions .kp-btn { color: #111; border-color: #d4d4d8; }
  .kp-card-actions .kp-primary { color: #16110a; }
  @media print { .kp-bar, .kp-modal { display: none !important; } body { padding-top: 0 !important; } }
</style>
<script>
  function kpOpen(kind) {
    document.getElementById('kpResponse').value = kind;
    document.getElementById('kpTitle').textContent = kind === 'accepted' ? 'Согласовать предложение' : 'Отклонить предложение';
    document.getElementById('kpModal').classList.add('open');
  }
  function kpClose() { document.getElementById('kpModal').classList.remove('open'); }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') kpClose(); });
</script>`;

  return base.replace("</body>", `${bar}</body>`);
}
