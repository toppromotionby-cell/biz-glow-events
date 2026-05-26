// Шаблон письма для маркетинговых рассылок: оборачивает HTML тела
// в брендированный layout и добавляет обязательный футер с unsubscribe.

const BRAND_COLOR = "#f97316"; // event-hub orange
const SITE_URL = "https://event-hub.by";

export function wrapCampaignHtml(opts: {
  subject: string;
  bodyHtml: string;
  unsubscribeUrl: string;
}): string {
  const { subject, bodyHtml, unsubscribeUrl } = opts;
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#0b0b0c;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#e7e7e9;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b0b0c;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#141416;border:1px solid #26262a;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:24px 32px;border-bottom:1px solid #26262a;">
              <a href="${SITE_URL}" style="color:${BRAND_COLOR};text-decoration:none;font-weight:700;font-size:18px;letter-spacing:0.3px;">event-hub.by</a>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;font-size:15px;line-height:1.6;color:#e7e7e9;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #26262a;font-size:12px;line-height:1.5;color:#8a8a91;">
              Вы получили это письмо, потому что подписались на рассылку event-hub.by.<br/>
              <a href="${unsubscribeUrl}" style="color:#8a8a91;text-decoration:underline;">Отписаться от рассылки</a> · <a href="${SITE_URL}" style="color:#8a8a91;text-decoration:underline;">event-hub.by</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h\d|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
