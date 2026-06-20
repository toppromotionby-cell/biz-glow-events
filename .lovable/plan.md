## Цель
Починить 500 ошибку на event-hub.by и добавить автоматический мониторинг.

## Шаги

1. **`src/lib/error-capture.ts`** — добавить экспорт `formatError(err)` возвращающий `{ name, message, stack, cause }` чтобы Workers логировал полный stack trace вместо `[object Object]`.

2. **`src/server.ts`** — логировать через `console.error('[ssr-error]', method, url, formatError(err))` с контекстом запроса, чтобы в production logs появилась точная причина падения.

3. **`src/routes/api/public/health.ts`** — новый публичный route, делающий self-check (`fetch(new URL("/", request.url))`) и возвращающий `{ ok, status, ms }`.

4. **`scripts/smoke-prod.mjs`** — скрипт для ручного прогона всех ключевых страниц (`/`, `/zones`, `/equipment`, `/services`, `/production`, `/cases`, `/blog`, `/contacts`); exit 1 при любом 5xx.

5. **`src/components/admin/ProdHealthBanner.tsx`** — виджет в админке, опрашивает `/api/public/health` каждые 60 сек, показывает красный alert при 500 с кнопками "Открыть прод" и "Логи".

6. **`src/routes/admin.index.tsx`** — встроить `ProdHealthBanner` в дашборд админки.

## Технические детали
- Шаги 1–2 дают точный stack в `stack_modern--server-function-logs` — после первого деплоя можно будет сделать прицельный фикс (1–2 строки) реальной причины 500.
- Никакого слепого «автофикса» SSR-краша без понимания причины — это опасно. Health-баннер + smoke-скрипт = система раннего обнаружения для будущих регрессий.
- Health route публичный (`/api/public/`) — обходит auth, безопасен (только GET, без PII).

## После деплоя
Открыть прод → получить настоящий stack из логов → точечный фикс root cause отдельным шагом.
