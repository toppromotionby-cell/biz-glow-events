// Server route: /admin/orders/$id/contract — HTML договора оказания услуг с print CSS (A4).
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireStaff } from "@/lib/admin-route-guard";
import { fmtDate } from "@/lib/formatters";

function esc(s: unknown): string {
  return String(s ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
function money(n: number): string {
  return new Intl.NumberFormat("ru-BY", { style: "currency", currency: "BYN", maximumFractionDigits: 2 }).format(n);
}

export const Route = createFileRoute("/admin/orders/$id/contract")({
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

        const total = (items ?? []).reduce((s, it) => s + Number(it.price) * Number(it.qty), 0);
        const date = fmtDate(new Date());
        const num = String(order.id).slice(0, 8).toUpperCase();
        const eventDate = order.event_date ? fmtDate(order.event_date) : "по согласованию сторон";

        const itemsList = (items ?? []).map((it, i) =>
          `<li>${esc(it.title)} — ${esc(it.qty)} шт. × ${money(Number(it.price))} = <b>${money(Number(it.price) * Number(it.qty))}</b></li>`
        ).join("") || "<li>Услуги уточняются дополнительным соглашением.</li>";

        const html = `<!doctype html>
<html lang="ru"><head><meta charset="utf-8" />
<title>Договор №${num} — event-hub.by</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", "PT Sans", Roboto, serif; color:#111; margin:0; font-size:12px; line-height:1.5; }
  h1 { font-size:16px; text-align:center; margin:6px 0 4px; text-transform:uppercase; letter-spacing:1px; }
  .sub { text-align:center; font-size:11px; color:#555; margin-bottom:18px; }
  .meta { display:flex; justify-content:space-between; font-size:11px; color:#444; margin-bottom:14px; }
  h2 { font-size:13px; margin:14px 0 6px; color:#6d28d9; }
  p { margin:4px 0; text-align:justify; }
  ol, ul { margin:4px 0 4px 18px; padding:0; }
  ol > li { margin:3px 0; }
  .preamble { padding:10px 12px; background:#faf7ff; border-radius:6px; border:1px solid #ece4ff; margin-bottom:12px; font-size:11.5px; }
  .sign { margin-top:32px; display:grid; grid-template-columns:1fr 1fr; gap:30px; font-size:11px; }
  .sign h3 { font-size:11px; text-transform:uppercase; color:#6d28d9; margin:0 0 6px; letter-spacing:.5px; }
  .sign .line { border-top:1px solid #999; padding-top:4px; margin-top:42px; }
  .print-btn { position:fixed; top:12px; right:12px; padding:8px 14px; background:#6d28d9; color:#fff; border:0; border-radius:6px; cursor:pointer; font-size:13px; }
  @media print { .print-btn { display:none; } }
</style></head><body>
  <button class="print-btn" onclick="window.print()">Сохранить как PDF</button>

  <h1>Договор оказания услуг №${num}</h1>
  <div class="sub">г. Минск · ${date}</div>

  <div class="preamble">
    <b>Event Hub</b> (далее — «Исполнитель») в лице директора Иванова И. И., действующего на основании Устава, с одной стороны,
    и <b>${esc(order.client_company || order.client_name)}</b>${order.client_company ? ` в лице ${esc(order.client_name)}` : ""}
    (далее — «Заказчик»), с другой стороны, заключили настоящий Договор о нижеследующем.
  </div>

  <h2>1. Предмет договора</h2>
  <p>1.1. Исполнитель обязуется оказать Заказчику услуги по организации и техническому обеспечению мероприятия, проводимого <b>${eventDate}</b>, а Заказчик — принять и оплатить услуги.</p>
  <p>1.2. Перечень услуг и их стоимость:</p>
  <ul>${itemsList}</ul>

  <h2>2. Стоимость услуг и порядок расчётов</h2>
  <p>2.1. Общая стоимость услуг по Договору составляет <b>${money(total)}</b>, НДС не облагается (исполнитель применяет УСН).</p>
  <p>2.2. Заказчик вносит предоплату в размере 50% от стоимости в течение 3 банковских дней с момента подписания Договора.</p>
  <p>2.3. Окончательный расчёт производится не позднее даты проведения мероприятия.</p>
  <p>2.4. Оплата осуществляется безналичным перечислением на расчётный счёт Исполнителя.</p>

  <h2>3. Обязанности сторон</h2>
  <p>3.1. <b>Исполнитель обязуется:</b> качественно и в срок оказать услуги; обеспечить наличие необходимого оборудования и персонала; соблюдать технику безопасности.</p>
  <p>3.2. <b>Заказчик обязуется:</b> своевременно предоставить площадку, доступ и необходимую информацию; принять оказанные услуги; произвести оплату в установленные сроки.</p>

  <h2>4. Ответственность сторон</h2>
  <p>4.1. За нарушение сроков оплаты Заказчик уплачивает пеню в размере 0,1% от просроченной суммы за каждый день просрочки.</p>
  <p>4.2. В случае отказа Заказчика от услуг менее чем за 7 дней до даты мероприятия предоплата не возвращается.</p>
  <p>4.3. Стороны освобождаются от ответственности при наступлении обстоятельств непреодолимой силы (форс-мажор).</p>

  <h2>5. Срок действия и прочие условия</h2>
  <p>5.1. Договор вступает в силу с момента подписания и действует до полного исполнения обязательств сторонами.</p>
  <p>5.2. Все изменения и дополнения оформляются письменными соглашениями.</p>
  <p>5.3. Споры разрешаются путём переговоров, при невозможности — в суде по месту нахождения Исполнителя.</p>
  <p>5.4. Договор составлен в двух экземплярах, имеющих равную юридическую силу, по одному для каждой стороны.</p>

  <div class="sign">
    <div>
      <h3>Исполнитель</h3>
      <div>Event Hub<br/>УНП 000000000<br/>г. Минск, ул. Примерная, 1<br/>р/с BY00 OLMP 0000 0000 0000 0000 0000</div>
      <div class="line">Иванов И. И., директор</div>
    </div>
    <div>
      <h3>Заказчик</h3>
      <div>${esc(order.client_company || order.client_name)}<br/>${esc(order.client_phone)}<br/>${esc(order.client_email)}</div>
      <div class="line">${esc(order.client_name)}</div>
    </div>
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
