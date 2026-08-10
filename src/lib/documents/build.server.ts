// Сборка готового HTML документов (КП, счёт, договор, акт) для одного заказа.
// Используется и серверными роутами /admin/orders/$id/{kind}, и при отправке
// письма-подтверждения (чтобы приложить подписанные ссылки на документы).
import { fmtDate } from "@/lib/formatters";
import type { DocumentSettings } from "@/lib/document-settings.functions";
import { esc, money, renderShell, partyCard } from "@/lib/documents/render.server";
import { computeVat, vatConfig, vatRateLabel } from "@/lib/documents/vat";

export type DocOrder = {
  id: string;
  order_number?: string | null;
  client_name: string;
  client_company: string | null;
  client_phone: string | null;
  client_email: string | null;
  event_date: string | null;
  notes: string | null;
  paid: number | string | null;
};

export type DocItem = { title: string; qty: number | string; price: number | string };

export type DocKind = "quote" | "invoice" | "contract" | "act";

function header(order: DocOrder) {
  const numFromDb = (order.order_number ?? "").trim();
  return {
    num: numFromDb ? numFromDb.replaceAll("/", ".") : String(order.id).slice(0, 8).toUpperCase(),
    date: fmtDate(new Date()),
  };
}

export function buildQuoteHtml(order: DocOrder, items: DocItem[], settings: DocumentSettings) {
  const rows = items.map((it) => `
    <tr>
      <td>${esc(it.title)}</td>
      <td class="qty">${esc(it.qty)}</td>
      <td class="num">${money(Number(it.price))}</td>
      <td class="num">${money(Number(it.price) * Number(it.qty))}</td>
    </tr>`).join("");

  const total = items.reduce((s, it) => s + Number(it.price) * Number(it.qty), 0);
  const { num, date } = header(order);

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
      <thead><tr><th>Позиция</th><th class="qty">Кол-во</th><th class="num">Цена</th><th class="num">Сумма</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="4" style="text-align:center;color:#9ca3af;padding:24px;">Позиции не добавлены</td></tr>`}</tbody>
      <tfoot><tr><td colspan="3" class="num">Итого:</td><td class="num">${money(total)}</td></tr></tfoot>
    </table>

    ${order.notes ? `<div class="notes"><b>Комментарий:</b>\n${esc(order.notes)}</div>` : ""}

    <div class="footer" style="margin-top:18px;border:0;padding:0;color:#374151;font-size:11px;">
      ${esc(settings.quote_footer)}
      <div style="margin-top:6px;color:#6b7280;">Предложение действительно ${settings.quote_validity_days} дней. ${esc(settings.vat_note)}.</div>
    </div>`;

  return renderShell({
    title: `КП №${num} — ${settings.company_brand}`,
    kind: "Коммерческое предложение",
    number: num,
    date,
    settings,
    body,
  });
}

export function buildInvoiceHtml(order: DocOrder, items: DocItem[], settings: DocumentSettings) {
  const rows = items.map((it, i) => `
    <tr>
      <td class="num">${i + 1}</td>
      <td>${esc(it.title)}</td>
      <td class="qty">${esc(it.qty)}</td>
      <td>шт.</td>
      <td class="num">${money(Number(it.price))}</td>
      <td class="num">${money(Number(it.price) * Number(it.qty))}</td>
    </tr>`).join("");

  const total = items.reduce((s, it) => s + Number(it.price) * Number(it.qty), 0);
  const paid = Number(order.paid ?? 0);
  const debt = Math.max(0, total - paid);
  const { num, date } = header(order);

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
      <thead><tr><th class="num">№</th><th>Наименование</th><th class="qty">Кол-во</th><th>Ед.</th><th class="num">Цена</th><th class="num">Сумма</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="6" style="text-align:center;color:#9ca3af;padding:24px;">Позиции не добавлены</td></tr>`}</tbody>
    </table>

    <div class="summary">
      ${(() => {
        const v = computeVat(total, vatConfig(settings));
        return v.enabled
          ? `<div class="row"><span>Сумма без НДС:</span><span>${money(v.net)}</span></div>
      <div class="row"><span>НДС ${vatRateLabel(v.rate)}%:</span><span>${money(v.vat)}</span></div>
      <div class="row total"><span>К ОПЛАТЕ:</span><span>${money(v.gross)}</span></div>`
          : `<div class="row"><span>Итого без НДС:</span><span>${money(total)}</span></div>
      <div class="row"><span>${esc(settings.vat_note)}:</span><span>—</span></div>
      <div class="row total"><span>К ОПЛАТЕ:</span><span>${money(total)}</span></div>`;
      })()}
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

  return renderShell({
    title: `Счёт №${num} — ${settings.company_brand}`,
    kind: "Счёт-фактура",
    number: num,
    date,
    settings,
    body,
  });
}

export function buildContractHtml(order: DocOrder, items: DocItem[], settings: DocumentSettings) {
  const total = items.reduce((s, it) => s + Number(it.price) * Number(it.qty), 0);
  const { num, date } = header(order);
  const eventDate = order.event_date ? fmtDate(order.event_date) : "по согласованию сторон";

  const itemsList = items
    .map(
      (it) =>
        `<li>${esc(it.title)} — ${esc(it.qty)} шт. × ${money(Number(it.price))} = <b>${money(Number(it.price) * Number(it.qty))}</b></li>`,
    )
    .join("") || "<li>Услуги уточняются дополнительным соглашением.</li>";

  const extraSections = (settings.contract_sections ?? [])
    .map((s, i) => {
      const paragraphs = (s.paragraphs ?? []).map((p) => `<p>${esc(p)}</p>`).join("");
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
    <p>2.1. Общая стоимость услуг по Договору составляет <b>${money(computeVat(total, vatConfig(settings)).gross)}</b>, ${(() => {
      const v = computeVat(total, vatConfig(settings));
      return v.enabled ? `в том числе НДС ${vatRateLabel(v.rate)}% — ${money(v.vat)}` : esc(settings.vat_note);
    })()}.</p>
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

  return renderShell({
    title: `Договор №${num} — ${settings.company_brand}`,
    kind: "Договор",
    number: num,
    date,
    settings,
    body,
  });
}

export function buildActHtml(order: DocOrder, items: DocItem[], settings: DocumentSettings) {
  const rows = items.map((it, i) => `
    <tr>
      <td class="num">${i + 1}</td>
      <td>${esc(it.title)}</td>
      <td class="qty">${esc(it.qty)}</td>
      <td>шт.</td>
      <td class="num">${money(Number(it.price))}</td>
      <td class="num">${money(Number(it.price) * Number(it.qty))}</td>
    </tr>`).join("");

  const total = items.reduce((s, it) => s + Number(it.price) * Number(it.qty), 0);
  const { num, date } = header(order);
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
      <thead><tr><th class="num">№</th><th>Наименование</th><th class="qty">Кол-во</th><th>Ед.</th><th class="num">Цена</th><th class="num">Сумма</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="6" style="text-align:center;color:#9ca3af;padding:24px;">Позиции не добавлены</td></tr>`}</tbody>
    </table>

    <div class="summary">
      ${(() => {
        const v = computeVat(total, vatConfig(settings));
        return v.enabled
          ? `<div class="row"><span>Сумма без НДС:</span><span>${money(v.net)}</span></div>
      <div class="row"><span>НДС ${vatRateLabel(v.rate)}%:</span><span>${money(v.vat)}</span></div>
      <div class="row total"><span>ИТОГО оказано услуг на сумму:</span><span>${money(v.gross)}</span></div>`
          : `<div class="row total"><span>ИТОГО оказано услуг на сумму:</span><span>${money(total)}</span></div>
      <div class="row"><span>${esc(settings.vat_note)}</span><span>—</span></div>`;
      })()}
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

  return renderShell({
    title: `Акт №${num} — ${settings.company_brand}`,
    kind: "Акт оказанных услуг",
    number: num,
    date,
    settings,
    body,
  });
}

export const DOC_LABELS: Record<DocKind, string> = {
  quote: "Коммерческое предложение",
  invoice: "Счёт-фактура",
  contract: "Договор",
  act: "Акт оказанных услуг",
};
