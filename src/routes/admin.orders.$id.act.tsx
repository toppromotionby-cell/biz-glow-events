// Server route: /admin/orders/$id/act — HTML акта оказанных услуг.
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireStaff } from "@/lib/admin-route-guard";
import { fmtDate } from "@/lib/formatters";
import { esc, money, renderShell, loadDocumentSettings, partyCard } from "@/lib/documents/render.server";
import { maybePdfResponse } from "@/lib/documents/pdf-response.server";

export const Route = createFileRoute("/admin/orders/$id/act")({
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

        const pdf = await maybePdfResponse("act", request, order, items ?? [], settings);
        if (pdf) return pdf;

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
        const date = fmtDate(new Date());
        const num = (order.order_number ?? "").trim() ? (order.order_number as string).replaceAll("/", ".") : String(order.id).slice(0, 8).toUpperCase();
        const eventDate = order.event_date ? fmtDate(order.event_date) : "—";

        const body = `
          <div class="grid-2" style="margin-top:14px;">
            ${partyCard({
              label: "Исполнитель",
              name: settings.company_legal_name,
              lines: [
                `УНП: ${settings.company_unp}`,
                settings.company_address,
                `${settings.company_phone} · ${settings.company_email}`,
              ],
            })}
            ${partyCard({
              label: "Заказчик",
              name: order.client_company || order.client_name,
              lines: [
                order.client_company ? `Контакт: ${order.client_name}` : null,
                order.client_phone,
                order.client_email,
              ],
            })}
          </div>

          <div class="notes" style="margin-top:14px;">${esc(settings.act_intro)}</div>

          <h2 class="section">Перечень оказанных услуг</h2>
          <div style="font-size:11.5px;color:#374151;margin-bottom:4px;">Дата оказания услуг: <b>${esc(eventDate)}</b></div>

          <table>
            <thead><tr><th class="num">№</th><th>Наименование</th><th class="num">Кол-во</th><th>Ед.</th><th class="num">Цена</th><th class="num">Сумма</th></tr></thead>
            <tbody>${rows || `<tr><td colspan="6" style="text-align:center;color:#9ca3af;padding:24px;">Позиции не добавлены</td></tr>`}</tbody>
          </table>

          <div class="summary">
            <div class="row total"><span>ИТОГО оказано услуг на сумму:</span><span>${money(total)}</span></div>
            <div class="row"><span>${esc(settings.vat_note)}</span><span>—</span></div>
          </div>

          <p style="margin-top:14px;">Услуги оказаны полностью и в срок. Заказчик претензий по объёму, качеству и срокам оказания услуг не имеет.</p>

          <div class="sign">
            <div>
              <h3>Сдал — Исполнитель</h3>
              <div>${esc(settings.company_legal_name)}<br/>УНП ${esc(settings.company_unp)}</div>
              <div class="line">${esc(settings.signer_name)}, ${esc(settings.signer_title)}</div>
            </div>
            <div>
              <h3>Принял — Заказчик</h3>
              <div>${esc(order.client_company || order.client_name)}</div>
              <div class="line">${esc(order.client_name)}</div>
            </div>
          </div>

          <div class="footer" style="margin-top:18px;border:0;padding:0;color:#374151;font-size:10.5px;">
            ${esc(settings.act_footer)}
            <div style="margin-top:4px;color:#6b7280;">Срок приёмки: ${settings.act_validity_days} рабочих дней.</div>
          </div>`;

        const html = renderShell({
          title: `Акт №${num} — ${settings.company_brand}`,
          kind: "Акт оказанных услуг",
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
