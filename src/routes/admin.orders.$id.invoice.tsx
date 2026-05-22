// Server route: /admin/orders/$id/invoice — HTML счёта с print CSS (A4).
// Пользователь сохраняет как PDF через печать браузера (поддерживает кириллицу).
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireStaff } from "@/lib/admin-route-guard";

function esc(s: unknown): string {
  return String(s ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
function money(n: number): string {
  return new Intl.NumberFormat("ru-BY", { style: "currency", currency: "BYN", maximumFractionDigits: 2 }).format(n);
}

export const Route = createFileRoute("/admin/orders/$id/invoice")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { data: order, error } = await supabaseAdmin
          .from("orders").select("*").eq("id", params.id).single();
        if (error || !order) return new Response("Not found", { status: 404 });
        const { data: items } = await supabaseAdmin
          .from("order_items").select("*").eq("order_id", params.id);

        const rows = (items ?? []).map((it, i) => `
          <tr>
            <td class="num">${i + 1}</td>
            <td>${esc(it.title)}</td>
            <td class="num">${esc(it.qty)}</td>
            <td>шт.</td>
            <td class="num">${money(Number(it.price))}</td>
            <td class="num">${money(Number(it.price) * Number(it.qty))}</td>
          </tr>`).join("");

        const total = (items ?? []).reduce((s, it) => s + Number(it.price) * Number(it.qty), 0);
        const date = new Date().toLocaleDateString("ru-BY");
        const num = String(order.id).slice(0, 8).toUpperCase();

        const html = `<!doctype html>
<html lang="ru"><head><meta charset="utf-8" />
<title>Счёт №${num} — event-hub.by</title>
<style>
  @page { size: A4; margin: 16mm 14mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", "PT Sans", Roboto, sans-serif; color: #111; margin: 0; font-size: 12px; }
  .head { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #6d28d9; padding-bottom:10px; }
  .brand { font-size:22px; font-weight:700; color:#6d28d9; }
  .meta { font-size:11px; color:#555; text-align:right; }
  h1 { font-size:18px; margin:18px 0 10px; }
  .parties { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:14px; }
  .party { background:#faf7ff; border:1px solid #ece4ff; border-radius:6px; padding:10px 12px; }
  .party h3 { margin:0 0 4px; font-size:11px; text-transform:uppercase; color:#6d28d9; letter-spacing:.5px; }
  table { width:100%; border-collapse:collapse; margin-top:16px; }
  th, td { padding:6px 8px; border-bottom:1px solid #eee; text-align:left; vertical-align:top; }
  th { background:#f5f0ff; font-weight:600; font-size:11px; text-transform:uppercase; }
  td.num, th.num { text-align:right; white-space:nowrap; }
  tfoot td { font-weight:700; border-top:2px solid #6d28d9; font-size:13px; }
  .summary { margin-top:14px; padding:10px 12px; background:#f5f0ff; border-radius:6px; font-size:13px; }
  .summary .row { display:flex; justify-content:space-between; padding:2px 0; }
  .summary .total { font-weight:700; font-size:15px; color:#6d28d9; border-top:1px solid #ddd; margin-top:6px; padding-top:6px; }
  .sign { margin-top:36px; display:grid; grid-template-columns:1fr 1fr; gap:30px; font-size:11px; }
  .sign .line { border-top:1px solid #999; padding-top:4px; margin-top:36px; }
  .footer { margin-top:26px; font-size:10px; color:#666; border-top:1px solid #eee; padding-top:8px; }
  .print-btn { position:fixed; top:12px; right:12px; padding:8px 14px; background:#6d28d9; color:#fff; border:0; border-radius:6px; cursor:pointer; font-size:13px; }
  @media print { .print-btn { display:none; } }
</style></head><body>
  <button class="print-btn" onclick="window.print()">Сохранить как PDF</button>
  <div class="head">
    <div>
      <div class="brand">event-hub.by</div>
      <div style="font-size:10px;color:#666;margin-top:2px;">Event-технологии и продакшн · Минск, Беларусь</div>
    </div>
    <div class="meta">
      <div style="font-size:14px;font-weight:600;color:#111;">СЧЁТ-ФАКТУРА</div>
      <div>№ ${num}</div>
      <div>от ${date}</div>
    </div>
  </div>

  <div class="parties">
    <div class="party">
      <h3>Исполнитель</h3>
      <div><b>Event Hub</b></div>
      <div>УНП: 000000000</div>
      <div>г. Минск, ул. Примерная, 1</div>
      <div>р/с BY00 OLMP 0000 0000 0000 0000 0000</div>
      <div>hello@event-hub.by · +375 29 000-00-00</div>
    </div>
    <div class="party">
      <h3>Плательщик</h3>
      <div><b>${esc(order.client_company || order.client_name)}</b></div>
      ${order.client_company ? `<div>Контактное лицо: ${esc(order.client_name)}</div>` : ""}
      <div>${esc(order.client_phone)}</div>
      <div>${esc(order.client_email)}</div>
      ${order.event_date ? `<div>Дата мероприятия: ${esc(order.event_date)}</div>` : ""}
    </div>
  </div>

  <table>
    <thead><tr><th class="num">№</th><th>Наименование</th><th class="num">Кол-во</th><th>Ед.</th><th class="num">Цена</th><th class="num">Сумма</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="6" style="text-align:center;color:#999;padding:24px;">Позиции не добавлены</td></tr>`}</tbody>
  </table>

  <div class="summary">
    <div class="row"><span>Итого без НДС:</span><span>${money(total)}</span></div>
    <div class="row"><span>НДС (не облагается):</span><span>—</span></div>
    <div class="row total"><span>К ОПЛАТЕ:</span><span>${money(total)}</span></div>
    ${Number(order.paid ?? 0) > 0 ? `<div class="row"><span>Оплачено:</span><span>${money(Number(order.paid))}</span></div>` : ""}
  </div>

  <div class="sign">
    <div>
      <div>Исполнитель: _______________</div>
      <div class="line">Иванов И. И. / директор</div>
    </div>
    <div>
      <div>Заказчик: _______________</div>
      <div class="line">${esc(order.client_name)}</div>
    </div>
  </div>

  <div class="footer">
    Счёт действителен 5 банковских дней. Оплата подтверждает согласие с условиями договора оказания услуг.
    Документ сформирован автоматически и действителен без печати при перечислении средств с р/с плательщика.
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
