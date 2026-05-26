// Клиентская обёртка для предпросмотра HTML — простой минимум, чтобы не светить ничего лишнего.
// Полный server-side шаблон используется только при реальной отправке.
export function wrapPreviewHtml(opts: { subject: string; bodyHtml: string }): string {
  const { subject, bodyHtml } = opts;
  return `<!doctype html><html><head><meta charset="utf-8" /><title>${escape(subject)}</title>
<style>body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#0b0b0c;color:#e7e7e9;}
.wrap{max-width:600px;margin:32px auto;background:#141416;border:1px solid #26262a;border-radius:16px;overflow:hidden;}
.hdr{padding:24px 32px;border-bottom:1px solid #26262a;color:#f97316;font-weight:700;font-size:18px;}
.body{padding:32px;font-size:15px;line-height:1.6;}
.ftr{padding:20px 32px;border-top:1px solid #26262a;font-size:12px;color:#8a8a91;}
</style></head>
<body><div class="wrap">
<div class="hdr">event-hub.by</div>
<div class="body">${bodyHtml}</div>
<div class="ftr">Вы получили это письмо, потому что подписались на рассылку event-hub.by.<br/><a style="color:#8a8a91;" href="#">Отписаться</a></div>
</div></body></html>`;
}

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
