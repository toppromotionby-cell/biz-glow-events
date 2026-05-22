// Server route: /admin/orders/$id/quote — отдаёт HTML коммерческого предложения
// с print CSS (A4). Пользователь сохраняет в PDF через печать браузера.
// Lovable note (workaround): нативная генерация PDF в Worker-рантайме требует
// встраивания Cyrillic TTF + fontkit (~500KB бандл). Print-to-PDF — простое,
// надёжное решение, поддерживает Cyrillic, копируемый текст и фирстиль.
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireStaff } from "@/lib/admin-route-guard";

function esc(s: unknown): string {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function money(n: number): string {
  return new Intl.NumberFormat("ru-BY", { style: "currency", currency: "BYN", maximumFractionDigits: 2 }).format(n);
}

export const Route = createFileRoute("/admin/orders/$id/quote")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const auth = await requireStaff(request);
        if (auth instanceof Response) return auth;
        const { data: order, error } = await supabaseAdmin
          .from("orders").select("*").eq("id", params.id).single();
        if (error || !order) return new Response("Not found", { status: 404 });

        const { data: items } = await supabaseAdmin
          .from("order_items").select("*").eq("order_id", params.id);

        const rows = (items ?? []).map((it) => `
          <tr>
            <td>${esc(it.title)}</td>
            <td class="num">${esc(it.qty)}</td>
            <td class="num">${money(Number(it.price))}</td>
            <td class="num">${money(Number(it.price) * Number(it.qty))}</td>
          </tr>`).join("");

        const total = (items ?? []).reduce((s, it) => s + Number(it.price) * Number(it.qty), 0);
        const date = new Date().toLocaleDateString("ru-BY");

        const html = `<!doctype html>
<html lang="ru"><head><meta charset="utf-8" />
<title>КП #${esc(order.id).slice(0, 8)} — event-hub.by</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", "PT Sans", Roboto, sans-serif; color: #111; margin: 0; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #6d28d9; padding-bottom: 12px; }
  .brand { font-size: 22px; font-weight: 700; color: #6d28d9; letter-spacing: .5px; }
  .meta { font-size: 12px; color: #555; text-align: right; }
  h1 { font-size: 20px; margin: 24px 0 8px; }
  .client { background: #faf7ff; border: 1px solid #ece4ff; border-radius: 8px; padding: 12px 14px; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; margin-top: 18px; font-size: 13px; }
  th, td { padding: 8px 10px; border-bottom: 1px solid #eee; text-align: left; vertical-align: top; }
  th { background: #f5f0ff; font-weight: 600; }
  td.num, th.num { text-align: right; white-space: nowrap; }
  tfoot td { font-weight: 700; border-top: 2px solid #6d28d9; }
  .notes { margin-top: 18px; font-size: 12px; color: #444; white-space: pre-wrap; }
  .footer { margin-top: 32px; font-size: 11px; color: #666; border-top: 1px solid #eee; padding-top: 10px; }
  .print-btn { position: fixed; top: 12px; right: 12px; padding: 8px 14px; background: #6d28d9; color: #fff;
    border: 0; border-radius: 6px; cursor: pointer; font-size: 13px; }
  @media print { .print-btn { display: none; } }
</style></head><body>
  <button class="print-btn" onclick="window.print()">Сохранить как PDF</button>
  <div class="head">
    <div>
      <div class="brand">event-hub.by</div>
      <div style="font-size:11px;color:#666;margin-top:4px;">Event-технологии и продакшн · Минск, Беларусь</div>
    </div>
    <div class="meta">
      <div>Коммерческое предложение</div>
      <div>№ ${esc(order.id).slice(0, 8).toUpperCase()}</div>
      <div>от ${date}</div>
    </div>
  </div>

  <h1>Для клиента</h1>
  <div class="client">
    <div><b>${esc(order.client_name)}</b>${order.client_company ? ` · ${esc(order.client_company)}` : ""}</div>
    <div>${esc(order.client_phone)} · ${esc(order.client_email)}</div>
    ${order.event_date ? `<div>Дата мероприятия: ${esc(order.event_date)}</div>` : ""}
  </div>

  <table>
    <thead><tr><th>Позиция</th><th class="num">Кол-во</th><th class="num">Цена</th><th class="num">Сумма</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="4" style="text-align:center;color:#999;padding:24px;">Позиции не добавлены</td></tr>`}</tbody>
    <tfoot><tr><td colspan="3" class="num">Итого:</td><td class="num">${money(total)}</td></tr></tfoot>
  </table>

  ${order.notes ? `<div class="notes"><b>Комментарий:</b>\n${esc(order.notes)}</div>` : ""}

  <div class="footer">
    Предложение действительно 14 дней. Цены указаны без НДС, если иное не оговорено отдельно.
    Для подтверждения заказа свяжитесь с менеджером: hello@event-hub.by
  </div>
</body></html>`;

        return new Response(html, {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
        });
      },
    },
  },
});
