// Server route: /admin/orders/$id/quote — HTML коммерческого предложения.
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireStaff } from "@/lib/admin-route-guard";
import { fmtDate } from "@/lib/formatters";
import { esc, money, renderShell, loadDocumentSettings, partyCard } from "@/lib/documents/render.server";
import { maybePdfResponse } from "@/lib/documents/pdf-response.server";

export const Route = createFileRoute("/admin/orders/$id/quote")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const auth = await requireStaff(request);
        if (auth instanceof Response) return auth;

        const [{ data: order, error }, { data: items }, settings] = await Promise.all([
          supabaseAdmin.from("orders").select("*").eq("id", params.id).single(),
          supabaseAdmin.from("order_items").select("*").eq("order_id", params.id),
          loadDocumentSettings(supabaseAdmin as never),
        ]);
        if (error || !order) return new Response("Not found", { status: 404 });

        try { const { harvestFromOrder } = await import("@/lib/doc-knowledge.server"); await harvestFromOrder(order as Record<string, unknown>, (items ?? []) as Array<Record<string, unknown>>); } catch (e) { console.error("[order-doc] harvest failed", e); }

        const pdf = await maybePdfResponse("quote", request, order, items ?? [], settings);
        if (pdf) return pdf;

        const rows = (items ?? []).map((it) => `
          <tr>
            <td>${esc(it.title)}</td>
            <td class="num">${esc(it.qty)}</td>
            <td class="num">${money(Number(it.price))}</td>
            <td class="num">${money(Number(it.price) * Number(it.qty))}</td>
          </tr>`).join("");

        const total = (items ?? []).reduce((s, it) => s + Number(it.price) * Number(it.qty), 0);
        const date = fmtDate(new Date());
        const num = (order.order_number ?? "").trim() ? (order.order_number as string).replaceAll("/", ".") : String(order.id).slice(0, 8).toUpperCase();

        const body = `
          <h1 class="section">Клиент</h1>
          ${partyCard({
            label: "Заказчик",
            name: order.client_company || order.client_name,
            lines: [
              order.client_company ? `Контакт: ${order.client_name}` : null,
              order.client_phone,
              order.client_email,
              order.event_date ? `Дата мероприятия: ${fmtDate(order.event_date)}` : null,
            ],
          })}

          <table>
            <thead><tr><th>Позиция</th><th class="num">Кол-во</th><th class="num">Цена</th><th class="num">Сумма</th></tr></thead>
            <tbody>${rows || `<tr><td colspan="4" style="text-align:center;color:#9ca3af;padding:24px;">Позиции не добавлены</td></tr>`}</tbody>
            <tfoot><tr><td colspan="3" class="num">Итого:</td><td class="num">${money(total)}</td></tr></tfoot>
          </table>

          ${order.notes ? `<div class="notes"><b>Комментарий:</b>\n${esc(order.notes)}</div>` : ""}

          <div class="footer" style="margin-top:18px;border:0;padding:0;color:#374151;font-size:11px;">
            ${esc(settings.quote_footer)}
            <div style="margin-top:6px;color:#6b7280;">Предложение действительно ${settings.quote_validity_days} дней. ${esc(settings.vat_note)}.</div>
          </div>`;

        const html = renderShell({
          title: `КП №${num} — ${settings.company_brand}`,
          kind: "Коммерческое предложение",
          number: num,
          date,
          settings,
          body,
        });

        return new Response(html, {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
        });
      },
    },
  },
});
