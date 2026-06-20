// Server route: /admin/orders/$id/invoice — HTML счёта.
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireStaff } from "@/lib/admin-route-guard";
import { fmtDate } from "@/lib/formatters";
import { esc, money, renderShell, loadDocumentSettings, partyCard } from "@/lib/documents/render.server";

export const Route = createFileRoute("/admin/orders/$id/invoice")({
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
        const paid = Number(order.paid ?? 0);
        const debt = Math.max(0, total - paid);
        const date = fmtDate(new Date());
        const num = String(order.id).slice(0, 8).toUpperCase();

        const body = `
          <div class="grid-2" style="margin-top:14px;">
            ${partyCard({
              label: "Исполнитель",
              name: settings.company_legal_name,
              lines: [
                `УНП: ${settings.company_unp}`,
                settings.company_address,
                settings.bank_account ? `р/с ${settings.bank_account}` : null,
                settings.bank_name || null,
                settings.bank_bic ? `БИК: ${settings.bank_bic}` : null,
                `${settings.company_phone} · ${settings.company_email}`,
              ],
            })}
            ${partyCard({
              label: "Плательщик",
              name: order.client_company || order.client_name,
              lines: [
                order.client_company ? `Контакт: ${order.client_name}` : null,
                order.client_phone,
                order.client_email,
                order.event_date ? `Дата мероприятия: ${fmtDate(order.event_date)}` : null,
              ],
            })}
          </div>

          <table>
            <thead><tr><th class="num">№</th><th>Наименование</th><th class="num">Кол-во</th><th>Ед.</th><th class="num">Цена</th><th class="num">Сумма</th></tr></thead>
            <tbody>${rows || `<tr><td colspan="6" style="text-align:center;color:#9ca3af;padding:24px;">Позиции не добавлены</td></tr>`}</tbody>
          </table>

          <div class="summary">
            <div class="row"><span>Итого без НДС:</span><span>${money(total)}</span></div>
            <div class="row"><span>${esc(settings.vat_note)}:</span><span>—</span></div>
            <div class="row total"><span>К ОПЛАТЕ:</span><span>${money(total)}</span></div>
            ${paid > 0 ? `<div class="row"><span>Оплачено:</span><span>${money(paid)}</span></div>` : ""}
            ${paid > 0 && debt > 0 ? `<div class="row"><span>Остаток:</span><span>${money(debt)}</span></div>` : ""}
          </div>

          <div class="sign">
            <div>
              <h3>Исполнитель</h3>
              <div>Подпись: _______________</div>
              <div class="line">${esc(settings.signer_name)} / ${esc(settings.signer_title)}</div>
            </div>
            <div>
              <h3>Заказчик</h3>
              <div>Подпись: _______________</div>
              <div class="line">${esc(order.client_name)}</div>
            </div>
          </div>

          <div class="footer" style="margin-top:18px;border:0;padding:0;color:#374151;font-size:10.5px;">
            ${esc(settings.invoice_footer)}
            <div style="margin-top:4px;color:#6b7280;">Срок оплаты: ${settings.invoice_validity_days} банковских дней.</div>
          </div>`;

        const html = renderShell({
          title: `Счёт №${num} — ${settings.company_brand}`,
          kind: "Счёт-фактура",
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
