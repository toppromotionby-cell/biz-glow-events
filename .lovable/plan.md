## Что предлагаю проверить и оптимизировать

Ниже — приоритизированный план. Каждый блок можно запускать отдельно или последовательно.

---

### 1. SEO и метаданные (высокий приоритет, быстрые победы)

**Проблемы, найденные при беглом аудите:**
- В `src/routes/__root.tsx` зашит `og:image` со ссылкой на превью‑скриншот Lovable (`pub-…r2.dev/id-preview-...`). По правилам TanStack `meta` мержится по `property`, но листовые роуты не переопределяют его — в итоге **во всех соцсетях шарится временный превью‑скрин**, а не брендовая обложка.
- `canonical` объявлен и в `__root.tsx` (через `links`), и в `index.tsx` — TanStack **конкатенирует `links` без дедупа** → дублирующиеся canonical (баг для SEO).
- У большинства листовых страниц (`services.$slug`, `equipment.$slug`, `production.$slug`, `cases.$slug`, `blog.$slug`, `zones.$slug`) нужно проверить наличие динамических `head()` с `title/description/og:*/canonical` из `loaderData`.
- `sitemap.xml` использует `supabaseAdmin` напрямую в route loader — корректно, но нужно убедиться, что туда попадают только `published=true` записи всех каталогов и актуальные `updated_at`/`lastmod`.
- `robots.txt` валиден, но дополнительно стоит закрыть `/login`, `/register`, `/reset-password`, `/profile`, `/cart`, `/wishlist`, `/compare` от индексации.

**Что сделаю:**
1. Заменить `og:image` в `__root.tsx` на постоянное брендовое изображение (1200×630, сгенерирую через imagegen) либо убрать ситово, оставив на листьях.
2. Убрать `canonical` из `__root.tsx`, оставить только в листьях (`index.tsx` уже ок).
3. Пройтись по всем `*.$slug.tsx` — добавить `head({ params, loaderData })` с уникальными title/description, og:url, canonical, og:image = главное фото записи, JSON‑LD (`Article` для блога, `Product` для каталога, `Event` для кейсов, `BreadcrumbList`).
4. Добавить `<meta name="robots" content="noindex">` в служебные роуты (login/register/cart/wishlist/compare/profile/reset‑password/admin).
5. Проверить `sitemap.xml`: подтянуть `services`, `tech_equipment`, `zones`, `production_items`, `cases`, `blog_posts` (только `published`), включить `<lastmod>`.

---

### 2. Производительность и Core Web Vitals

**Что планирую:**
1. **Preload LCP‑изображения** на главной (`head().links` → `rel=preload as=image`).
2. Перевести крупные изображения каталога/кейсов на WebP/AVIF через `?format=webp` (vite-imagetools) или использовать Cloudflare Image Resizing для R2.
3. Добавить `loading="lazy"` и явные `width/height` всем `<img>` ниже первого экрана (фикс CLS).
4. Шрифты: `font-display: swap`, preconnect к шрифтовым CDN.
5. Запустить `browser--performance_profile` после изменений, при необходимости — `browser--start_profiling` на главной и админке заказов.
6. Проверить, что admin‑бандлы код‑сплитятся (роуты в `src/routes/admin.*.tsx` грузятся только по входу в админку).
7. `admin.orders.tsx` тянет `select("*").limit(500)` без пагинации — добавить пагинацию/виртуализацию таблицы (react‑window) для будущего роста.

---

### 3. Безопасность и RLS

**Что нашёл и что проверю/исправлю:**
1. `orders.user_id` **nullable** — это нужно, чтобы гости могли оформлять заказ через `createServerFn` (используется `supabaseAdmin`). Убедиться, что:
   - `submitOrder` всегда выставляет либо `user_id = auth.uid()`, либо `null` (гость) и **не принимает `user_id` из клиента**.
   - Telegram‑нотификации и notes с реквизитами не утекают другим клиентам — текущая RLS `auth.uid() = user_id` это закрывает, но проверю, что нет публичных селектов через сервер.
2. Все `*.functions.ts`, которые используют `supabaseAdmin`, должны строго фильтровать `published=true` и **проектировать только безопасные колонки** (без `notes`, `client_phone`, `client_email`, UTM в публичных запросах). Пройдусь по списку: `catalog`, `cases`, `testimonials`, `search`, `promo`, `orders`, `leads`, `users`.
3. `src/lib/admin-route-guard.ts` — корректно валидирует роль через `supabaseAdmin`. Проверю, что **все** серверные роуты под `/admin/*` (контракты, инвойсы, КП) вызывают этот guard. Сейчас `admin.orders.$id.{quote,invoice,contract}.tsx` импортируют `supabaseAdmin` — убедиться, что они защищены guard'ом, иначе любой может скачать чужие документы по UUID.
4. Включить **Leaked Password Protection (HIBP)** через `configure_auth`.
5. Добавить **Google OAuth** (через Lovable broker + `configure_social_auth`) — пользователи смогут логиниться без пароля.
6. Запустить `supabase--linter` и `security--run_security_scan`, починить критические/высокие.
7. Storage `media` бакет приватный — проверить, что публичные изображения каталога раздаются из `catalog-media` (public), а не подписанными ссылками.
8. Rate limiting и input‑валидация (zod) на `submitOrder`, `createLead`, `newsletter.subscribe` — убедиться, что есть min/max и regex для email/phone.

---

### 4. UX оформления заказа (cart + reqs dialog)

**Текущее состояние:** двухшаговый чекаут (контактные данные → модалка реквизитов) уже сделан. План:
1. **Сделать модалку реквизитов опциональной**: чекбокс «Оформляю как юр. лицо / нужны документы» — физлица не должны заполнять УНП/банк.
2. **Сохранение черновика**: запоминать введённые контакты в `localStorage`, чтобы пользователь не терял данные при обновлении страницы.
3. **Валидация** через `react-hook-form + zod`: маска телефона (BY), email regex, обязательные поля подсвечиваются.
4. **Подтверждение и далее**: после успешной отправки — отдельная страница `/order/success/$id` с номером заказа, кнопками «Скачать КП в PDF», «Открыть в Telegram», «Вернуться к каталогу». Сейчас просто toast.
5. **Email‑подтверждение клиенту** (через существующий email queue) + дублирование уведомления менеджеру.
6. **Мобильная адаптация** корзины и модалки — проверить на 375px (особенно `DateField` и таблица позиций).
7. Кнопка «Очистить корзину» с confirm‑диалогом.
8. Промокод: текущий `PromoCodeInput` — добавить анимацию применения и явный показ суммы скидки.

---

### 5. Админка / CRM

1. **Пагинация и серверная фильтрация** в `admin.orders.tsx` (сейчас limit 500, всё на клиенте).
2. **Inline‑смена статуса** прямо в таблице (dropdown в колонке статуса) с записью в `order_timeline`.
3. **Bulk‑действия**: выделение чекбоксами + массовая смена статуса/экспорт/удаление.
4. **Колонка «Менеджер»** + назначение ответственного (`manager_id` уже есть в схеме, но не используется в UI).
5. **Финансы**: возможность вводить оплату (частичную) прямо из модалки → запись в timeline.
6. **Дашборд** на `/admin` с графиком заказов по дням, конверсиями по UTM (есть `marketing_logs`).
7. **Поиск с дебаунсом** (сейчас перезапрос на каждый keystroke).
8. **Сохранение фильтров в URL** через `validateSearch` — менеджер может шарить ссылку на отфильтрованный список.
9. **Notifications**: realtime подписка на новые orders → toast в админке («Новый заказ #1234»).

---

### Технический раздел

```text
Файлы под изменения (черновой список)
├ src/routes/__root.tsx                  → og:image, убрать canonical
├ src/routes/{services,equipment,production,cases,blog,zones}.$slug.tsx
│                                          → head() с динамикой + JSON-LD
├ src/routes/{login,register,cart,wishlist,compare,profile,reset-password}.tsx
│                                          → meta robots=noindex
├ src/routes/sitemap[.]xml.tsx           → lastmod + все каталоги
├ src/routes/admin.orders.tsx            → пагинация, URL-фильтры, inline-статус, realtime
├ src/routes/cart.tsx                    → форма (rhf+zod), localStorage draft, success page
├ src/routes/order.success.$id.tsx       → новый роут
├ src/lib/orders.functions.ts            → серверная валидация zod, безопасная проекция
├ src/lib/{catalog,cases,testimonials,search,promo,leads,users}.functions.ts
│                                          → ревизия публичных селектов
├ src/components/admin/OrderStatusInline.tsx (new)
├ supabase/migrations/<новые>            → индексы (orders.created_at, orders.status, order_items.order_id),
│                                          триггер touch_updated_at для orders
└ configure_auth                         → HIBP on; configure_social_auth → google
```

**Порядок исполнения (предлагаемые волны):**
1. Безопасность (RLS ревизия, admin guard, HIBP, scanner) — критично, без даунтайма.
2. SEO — быстрые победы, влияет на трафик.
3. UX корзины (rhf+zod, success page, email клиенту).
4. Админка/CRM (пагинация, URL‑фильтры, inline‑статус, realtime).
5. Производительность (preload LCP, форматы изображений, lazy, профилирование).

**Что хочу подтвердить перед стартом:**
- Делать всё одной волной или начнём с одной (рекомендую №1 безопасность → №2 SEO)?
- Подключать ли Google OAuth?
- Генерировать ли брендовый `og:image` (1200×630) через imagegen?
