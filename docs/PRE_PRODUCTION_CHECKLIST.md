# Предпродакшн-чеклист

Финальная проверка перед деплоем `event-hub.by`. Проходить по порядку, отмечать
галочки в PR-описании. Любой непройденный пункт = stop-the-line.

## 1. Окружение и секреты

- [ ] В Lovable Cloud активны все необходимые секреты: `RESEND_API_KEY`,
      `TELEGRAM_API_KEY`, `TELEGRAM_CHAT_ID`, `ADMIN_EMAIL`, `LOVABLE_API_KEY`,
      `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- [ ] Браузерные `VITE_*` переменные не содержат сервисных ключей и подхвачены
      сборкой (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`).
- [ ] `.env` не закоммичен; локальные секреты лежат только в Lovable Cloud
      Secrets и не выводятся в логах (`grep -R "SERVICE_ROLE" src` пусто).
- [ ] Resend custom domain верифицирован (`SPF`, `DKIM`, `DMARC` зелёные).
- [ ] Telegram-бот добавлен в чат поддержки, `TELEGRAM_CHAT_ID` корректный
      (отправка тестового сообщения через `/api/public/telegram-support`).

## 2. База данных и RLS

- [ ] Все публичные таблицы имеют `ENABLE ROW LEVEL SECURITY`.
- [ ] Каждая `CREATE TABLE public.*` сопровождается `GRANT`-ами; нет таблицы
      с RLS-on и без grant'ов (проверить linter: `supabase--linter`).
- [ ] `user_roles` отделена от `profiles`; роли проверяются через
      `public.has_role(uuid, app_role)` security-definer.
- [ ] Анонимные `SELECT`-политики ограничены `published = true` и не
      раскрывают PII (`profiles`, `orders`, `cart_drafts`).
- [ ] Триггеры `set_updated_at` / `touch_updated_at` навешаны на все таблицы
      с `updated_at`.
- [ ] Бэкапы Supabase включены (Project Settings → Backups).

## 3. Auth и роли

- [ ] Email confirmations включены (или выключены осознанно), URL redirect
      whitelisted (`event-hub.by`, `www.event-hub.by`).
- [ ] Google OAuth идёт через брокер `lovable.auth.signInWithOAuth("google", …)`;
      Apple/Microsoft не используются, либо настроены аналогично.
- [ ] В админке `/admin` гейт по ролям (`admin/manager/marketer/content_editor`)
      работает: тест входом под обычным пользователем (доступ запрещён).
- [ ] Кнопка «Sign out» полностью очищает react-query кеш и редиректит на `/`.

## 4. Server functions и Edge

- [ ] `attachSupabaseAuth` подключён в `src/start.ts` как `functionMiddleware`.
- [ ] Все защищённые `createServerFn` используют `requireSupabaseAuth`.
- [ ] Публичные read-only fn (catalog/home recommendations) используют
      `supabaseAdmin` с принудительным `published = true`-фильтром.
- [ ] Edge functions (если есть) имеют верификацию подписей перед записью;
      `service_role` ключ не уходит в браузер.
- [ ] Cron / pg_cron вызывают `/api/public/*`-эндпоинты по стабильному URL
      `project--<id>.lovable.app`, с проверкой `x-webhook-signature`.
- [ ] Очереди (`pgmq`) — `email-send-*`, `dlq-*` существуют, потребитель
      крутится, метрики «глубина очереди» отслеживаются.

## 5. Контент и seed-данные

- [ ] В каждой таблице каталога (zones/services/tech_equipment/production_items)
      есть минимум 6 опубликованных карточек с фото, ценой, описанием.
- [ ] Блог: ≥ 3 опубликованных поста с `cover_url`, `excerpt`, `seo_title`,
      `seo_description`, `published_at`.
- [ ] Кейсы: ≥ 3 featured-кейса с полной структурой
      (event_type, event_date, summary, metrics).
- [ ] Отзывы: ≥ 5 опубликованных, ≥ 2 featured.
- [ ] Site sections включены: home (`featured`, `testimonials`, `cases`).
- [ ] Промо-коды для маркетинга проверены: `valid_from/valid_to/max_uses`.

## 6. SEO, JSON-LD, шаринг

- [ ] Каждая публичная страница имеет уникальный `<title>` ≤ 60 и
      `meta description` ≤ 160.
- [ ] Один `<h1>` на странице. Семантический HTML.
- [ ] `robots.txt` + `sitemap-index.xml` отдают валидный XML; admin/`/api`
      исключены.
- [ ] JSON-LD валиден (юнит-тесты `seo-jsonld.test.ts` зелёные):
      Article (blog), Event (case), Review (testimonial), ItemList (категории).
- [ ] `og:image` определён на детальных страницах (берётся из `cover_url`).
- [ ] `canonical` ведёт на абсолютный URL `https://event-hub.by/...`.
- [ ] Прогон Lighthouse SEO ≥ 95 для `/`, `/blog`, `/zones`, `/cases`.

## 7. Доступность

- [ ] Lighthouse a11y ≥ 90 на ключевых страницах.
- [ ] Контраст текста ≥ 4.5:1; ссылки/кнопки имеют `aria-label` или
      видимый текст.
- [ ] Все `<img>` имеют `alt`; декоративные — `alt=""`.
- [ ] Фокус виден (`focus-visible`), порядок табуляции логичный.
- [ ] Модалки (`AlertDialog`, `Dialog`) трапят фокус и закрываются `Esc`.
- [ ] Формы: ошибки озвучены (`role="alert"` / `aria-describedby`).

## 8. Performance (Core Web Vitals)

- [ ] LCP ≤ 2.5s на mobile-4G для `/`, `/zones/:slug`, `/cases/:slug`.
- [ ] CLS ≤ 0.1 (медиа имеет фиксированные размеры/aspect-ratio).
- [ ] INP ≤ 200ms.
- [ ] Бандл главной страницы ≤ 300 KB gzip. Картинки в WebP, lazy-loading.
- [ ] Preload только критичных шрифтов; remote fonts через `<link>` в root
      head, не `@import` в css.

## 9. Безопасность

- [ ] `bunx tsc --noEmit` зелёный, `eslint` без warnings в новом коде.
- [ ] Vitest зелёный (`bunx vitest run`).
- [ ] Security scan (`security--run_security_scan`) без High/Critical.
- [ ] Никакой `dangerouslySetInnerHTML` без санитайзера.
- [ ] CSP заголовки настроены через cloudflare/wrangler (или явно отложено).
- [ ] Rate-limit на `/api/public/*` (cloudflare rules) для webhook-эндпоинтов.

## 10. Аналитика и мониторинг

- [ ] Подключён базовый analytics (`@/lib/analytics`), события `pageview`,
      `lead_submit`, `add_to_cart`, `order_success` фиксируются.
- [ ] `error-capture` ловит ошибки на проде в Lovable / Sentry-аналог.
- [ ] Уведомления о новых заказах/лидах падают в Telegram и `ADMIN_EMAIL`.
- [ ] Health-check публичного API возвращает 200.

## 11. Final smoke

Прогнать вручную перед публикацией:

1. Открыть главную, кликнуть в карточку → детальная страница, JSON-LD виден в DOM.
2. Оставить заявку через `LeadForm` → пришло письмо + сообщение в Telegram.
3. Добавить товар в корзину → оформить заказ → попасть на `order.success`.
4. Войти в `/admin` под admin-ролью → создать/опубликовать карточку каталога,
   убедиться в появлении на сайте.
5. Отписаться от рассылки через ссылку из письма → запись в `suppressed_emails`.
6. Проверить, что неавторизованный пользователь не видит `/admin`.

После прохождения — `<presentation-open-publish>` и переход на боевой домен.
