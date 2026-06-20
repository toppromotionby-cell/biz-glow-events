// Server route: /admin/orders/$id/contract — HTML договора оказания услуг.
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireStaff } from "@/lib/admin-route-guard";
import { fmtDate } from "@/lib/formatters";
import { esc, money, renderShell, loadDocumentSettings } from "@/lib/documents/render.server";
import { maybePdfResponse } from "@/lib/documents/pdf-response.server";

export const Route = createFileRoute("/admin/orders/$id/contract")({
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

        const pdf = await maybePdfResponse("contract", request, order, items ?? [], settings);
        if (pdf) return pdf;

        const total = (items ?? []).reduce((s, it) => s + Number(it.price) * Number(it.qty), 0);
        const date = fmtDate(new Date());
        const num = String(order.id).slice(0, 8).toUpperCase();
        const eventDate = order.event_date ? fmtDate(order.event_date) : "по согласованию сторон";

        const itemsList =
          (items ?? [])
            .map(
              (it) =>
                `<li>${esc(it.title)} — ${esc(it.qty)} шт. × ${money(Number(it.price))} = <b>${money(Number(it.price) * Number(it.qty))}</b></li>`,
            )
            .join("") || "<li>Услуги уточняются дополнительным соглашением.</li>";

        const extraSections = (settings.contract_sections ?? [])
          .map((s, i) => {
            const paragraphs = (s.paragraphs ?? [])
              .map((p) => `<p>${esc(p)}</p>`)
              .join("");
            return `<h2 class="section">${i + 4}. ${esc(s.title)}</h2>${paragraphs}`;
          })
          .join("");

        const body = `
          <h1 style="font-size:15px;text-align:center;margin:14px 0 4px;text-transform:uppercase;letter-spacing:1px;">
            Договор оказания услуг №${esc(num)}
          </h1>
          <div style="text-align:center;font-size:11px;color:#6b7280;margin-bottom:16px;">
            г. ${esc(settings.contract_jurisdiction_city)} · ${esc(date)}
          </div>

          <div class="card" style="margin-bottom:12px;font-size:11.5px;">
            <b>${esc(settings.company_legal_name)}</b> (далее — «Исполнитель») в лице ${esc(settings.signer_title)} ${esc(settings.signer_name)},
            действующего на основании ${esc(settings.signer_basis)}, с одной стороны,
            и <b>${esc(order.client_company || order.client_name)}</b>${order.client_company ? ` в лице ${esc(order.client_name)}` : ""}
            (далее — «Заказчик»), с другой стороны, заключили настоящий Договор о нижеследующем.
          </div>

          <h2 class="section">1. Предмет договора</h2>
          <p>1.1. Исполнитель обязуется оказать Заказчику услуги по организации и техническому обеспечению мероприятия, проводимого <b>${esc(eventDate)}</b>, а Заказчик — принять и оплатить услуги.</p>
          <p>1.2. Перечень услуг и их стоимость:</p>
          <ul>${itemsList}</ul>

          <h2 class="section">2. Стоимость услуг и порядок расчётов</h2>
          <p>2.1. Общая стоимость услуг по Договору составляет <b>${money(total)}</b>, ${esc(settings.vat_note)}.</p>
          <p>2.2. Заказчик вносит предоплату в размере ${settings.contract_prepayment_pct}% от стоимости в течение ${settings.contract_prepayment_days} банковских дней с момента подписания Договора.</p>
          <p>2.3. Окончательный расчёт производится не позднее даты проведения мероприятия.</p>
          <p>2.4. Оплата осуществляется безналичным перечислением на расчётный счёт Исполнителя.</p>

          <h2 class="section">3. Ответственность</h2>
          <p>3.1. За нарушение сроков оплаты Заказчик уплачивает пеню в размере ${settings.contract_late_fee_pct}% от просроченной суммы за каждый день просрочки.</p>
          <p>3.2. В случае отказа Заказчика от услуг менее чем за ${settings.contract_cancel_days} дней до даты мероприятия предоплата не возвращается.</p>
          <p>3.3. Споры разрешаются в суде по месту нахождения Исполнителя (г. ${esc(settings.contract_jurisdiction_city)}).</p>

          ${extraSections}

          <div class="sign">
            <div>
              <h3>Исполнитель</h3>
              <div>${esc(settings.company_legal_name)}<br/>УНП ${esc(settings.company_unp)}<br/>${esc(settings.company_address)}<br/>${settings.bank_account ? `р/с ${esc(settings.bank_account)}` : ""}</div>
              <div class="line">${esc(settings.signer_name)}, ${esc(settings.signer_title)}</div>
            </div>
            <div>
              <h3>Заказчик</h3>
              <div>${esc(order.client_company || order.client_name)}<br/>${esc(order.client_phone)}<br/>${esc(order.client_email)}</div>
              <div class="line">${esc(order.client_name)}</div>
            </div>
          </div>`;

        const html = renderShell({
          title: `Договор №${num} — ${settings.company_brand}`,
          kind: "Договор",
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
