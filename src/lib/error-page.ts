// Полностью самодостаточный HTML (без импортов из приложения),
// который рендерится, когда SSR падает катастрофически.
// Брендирован под event-hub.by: тёмный фон, amber/orange glow,
// glass-карточка, шрифты системные (без внешних ресурсов).
export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <title>event-hub.by — временно недоступно</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <meta name="theme-color" content="#000000" />
    <style>
      :root { color-scheme: dark; }
      *, *::before, *::after { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; }
      body {
        font-family: "Space Grotesk", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, system-ui, sans-serif;
        color: #f5f5f7;
        background: #000;
        min-height: 100vh;
        position: relative;
        overflow-x: hidden;
        -webkit-font-smoothing: antialiased;
        letter-spacing: -0.01em;
        line-height: 1.55;
      }
      /* Радиальное свечение в стиле сайта (event-tech amber/orange glow) */
      body::before {
        content: "";
        position: fixed; inset: 0; z-index: 0; pointer-events: none;
        background:
          radial-gradient(1100px 600px at 50% -10%, rgba(247, 161, 64, 0.22), transparent 60%),
          radial-gradient(700px 500px at 85% 75%, rgba(247, 161, 64, 0.10), transparent 60%),
          radial-gradient(600px 500px at 10% 85%, rgba(247, 161, 64, 0.08), transparent 60%);
      }
      .wrap {
        position: relative; z-index: 1;
        min-height: 100vh;
        display: grid; place-items: center;
        padding: 24px;
      }
      .card {
        width: 100%; max-width: 520px; text-align: center;
        padding: 40px 28px;
        background: linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01));
        border: 1px solid rgba(255,255,255,0.10);
        border-radius: 24px;
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
        box-shadow: 0 20px 60px -15px rgba(0,0,0,0.6);
      }
      .brand {
        display: inline-flex; align-items: center; gap: 8px;
        font-size: 11px; letter-spacing: 0.25em; text-transform: uppercase;
        color: rgba(255,255,255,0.6); margin-bottom: 24px;
      }
      .dot {
        width: 28px; height: 28px; border-radius: 8px;
        background: linear-gradient(135deg, #f7a140, #ffd089);
        box-shadow: 0 0 24px rgba(247,161,64,0.55);
        display: inline-flex; align-items: center; justify-content: center;
        color: #1a0f00; font-weight: 800; font-size: 14px; letter-spacing: 0;
      }
      h1 {
        font-family: "Space Grotesk", system-ui, sans-serif;
        font-weight: 700; font-size: clamp(1.5rem, 1.2rem + 1.4vw, 2rem);
        margin: 0 0 12px; letter-spacing: -0.03em; line-height: 1.1;
      }
      .accent {
        background: linear-gradient(135deg, #f7a140, #ffd089);
        -webkit-background-clip: text; background-clip: text; color: transparent;
      }
      p { color: rgba(245,245,247,0.72); margin: 0 0 28px; font-size: 15px; }
      .actions { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
      .btn {
        display: inline-flex; align-items: center; justify-content: center; gap: 8px;
        padding: 12px 22px; min-height: 44px; border-radius: 9999px;
        font: inherit; font-weight: 600; font-size: 14px;
        text-decoration: none; cursor: pointer;
        border: 1px solid transparent; transition: transform .15s ease, filter .15s ease;
      }
      .btn:hover { transform: translateY(-1px); filter: brightness(1.08); }
      .btn-primary {
        background: linear-gradient(135deg, #f7a140, #ffd089);
        color: #1a0f00;
        box-shadow: 0 0 28px rgba(247,161,64,0.45);
      }
      .btn-ghost {
        background: rgba(255,255,255,0.04);
        color: #f5f5f7;
        border-color: rgba(255,255,255,0.18);
      }
      .status {
        margin-top: 22px;
        font-size: 12px; color: rgba(245,245,247,0.45);
      }
      @media (max-width: 480px) {
        .card { padding: 32px 20px; border-radius: 20px; }
        .actions .btn { width: 100%; }
      }
    </style>
  </head>
  <body>
    <main class="wrap">
      <section class="card" role="alert" aria-live="polite">
        <div class="brand">
          <span class="dot" aria-hidden="true">E</span>
          event-hub.by
        </div>
        <h1>Сайт <span class="accent">временно недоступен</span></h1>
        <p>Мы уже знаем о проблеме и работаем над её устранением.<br/>Попробуйте обновить страницу через минуту или вернитесь на главную.</p>
        <div class="actions">
          <button type="button" class="btn btn-primary" onclick="location.reload()">Обновить страницу</button>
          <a class="btn btn-ghost" href="/">На главную</a>
        </div>
        <div class="status">Если ошибка повторяется — напишите нам: hello@event-hub.by</div>
      </section>
    </main>
  </body>
</html>`;
}
