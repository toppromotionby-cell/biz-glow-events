// Полностью самодостаточный HTML (без импортов из приложения),
// который рендерится, когда SSR падает катастрофически.
// Брендирован под event-hub.by и локализован.
export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <title>event-hub.by — временная ошибка</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <style>
      :root { color-scheme: dark; }
      * { box-sizing: border-box; }
      body {
        font: 15px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, system-ui, sans-serif;
        background: radial-gradient(1200px 600px at 50% -10%, rgba(99,102,241,.22), transparent 60%), #0b0b12;
        color: #f5f5f7; min-height: 100vh; margin: 0; padding: 1.5rem;
        display: grid; place-items: center;
      }
      .card {
        max-width: 32rem; width: 100%; text-align: center; padding: 2.25rem 1.5rem;
        background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08);
        border-radius: 20px; backdrop-filter: blur(10px);
      }
      .brand { font-size: 11px; letter-spacing: .25em; text-transform: uppercase; color: #a5b4fc; margin-bottom: 1rem; }
      h1 { font-size: 1.5rem; margin: 0 0 .5rem; font-weight: 700; }
      p { color: #b4b4be; margin: 0 0 1.5rem; }
      .actions { display: flex; gap: .5rem; justify-content: center; flex-wrap: wrap; }
      a, button {
        padding: .65rem 1.1rem; border-radius: 10px; font: inherit; font-weight: 600;
        cursor: pointer; text-decoration: none; border: 1px solid transparent;
      }
      .primary { background: linear-gradient(135deg, #6366f1, #ec4899); color: #fff; }
      .secondary { background: transparent; color: #f5f5f7; border-color: rgba(255,255,255,.15); }
      a:hover, button:hover { filter: brightness(1.1); }
    </style>
  </head>
  <body>
    <main class="card">
      <div class="brand">event-hub.by</div>
      <h1>Страница временно недоступна</h1>
      <p>Мы уже знаем о проблеме и работаем над ней. Попробуйте обновить страницу или вернуться на главную.</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">Обновить</button>
        <a class="secondary" href="/">На главную</a>
      </div>
    </main>
  </body>
</html>`;
}
