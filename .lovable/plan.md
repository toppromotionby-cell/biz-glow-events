## Краткий вывод

Проект в хорошем состоянии: ~32k строк, файловая структура чистая, есть базовые reusable-компоненты в `src/components/admin/*`, типы из `Database` подключены, тесты на критичных утилитах. Нет `console.log`/`TODO`-мусора, нет «мёртвых» страниц. Основные точки роста — крупные «жирные» роуты, повторы в каталоге (4 типа × 2 страницы), отсутствие edge-функций и cron, отсутствие точечной мемоизации и широкие realtime-инвалидации.

Работаем итерациями. Каждый этап — отдельный PR с проверкой: типы → unit → e2e smoke (каталог / карточка / меню / мобайл) → ручная проверка ключевых экранов. Без поломок UI и бизнес-логики.

---

## 1. Архитектура и DRY

**Что нашлось**
- `src/routes/{zones,equipment,services,production}.tsx` — 4 файла по 54 строки, отличаются только строкой типа, заголовком и meta. То же для `*.$slug.tsx` (4 × 48).
- Форматтеры (`fmtMoney`, `fmtDate`, `fmtDateTime`) повторяются в нескольких админ-роутах (`admin.orders.tsx`, `admin.orders.$id.*`).
- В `admin.orders.tsx` локальные мини-компоненты `Stat`, `InfoCard`, `Row`, `PaidCell` дублируют паттерн «лейбл-значение», уже частично закрытый `Field` и `StatusPill`.
- `CatalogDetail.tsx` (545 строк) совмещает рендер, SEO JSON-LD, бизнес-логику выбора варианта и CTA.

**Что выносим**
- `src/lib/catalog-routes.ts` уже существует — расширим до фабрики `makeCatalogListRoute(type)` и `makeCatalogDetailRoute(type)`, чтобы 8 файлов превратились в 8 тонких 5-строчных конфигов.
- `src/lib/formatters.ts` — единый источник `fmtMoney/Date/DateTime/Phone/Age`.
- `src/components/admin/InfoCard.tsx`, `KeyValueRow.tsx` — заменят локальные дубли в `admin.orders.*`.
- Из `CatalogDetail` выделим `CatalogDetailHeader`, `CatalogVariantPicker`, `CatalogDetailCTA`, оставив контейнер тонким.

## 2. Сложность (декомпозиция)

| Файл | Строки | Что делать |
|---|---|---|
| `src/routes/admin.orders.tsx` | 761 | Разнести: список (`AdminOrdersTable`), диалог-карточку (`OrderDialog` уже отдельная функция — вынести в `components/admin/orders/OrderDialog.tsx`), мутации в `useOrderMutations` хук |
| `src/routes/admin.catalog.$type.tsx` | 673 | Выделить `CatalogEditorForm`, `CatalogList` в `components/admin/catalog/*` |
| `src/routes/cart.tsx` | 539 | Разделить «корзина», «расчёт стоимости/промо», «форма оформления» |
| `src/components/CatalogDetail.tsx` | 545 | См. п.1 |
| `src/routes/profile.tsx` | 420 | Вкладки в отдельные компоненты (`ProfileOrders`, `ProfileDetails`, `ProfileSecurity`) |
| `src/routes/admin.blog.tsx` | 414 | Аналогично catalog: списочная панель + редактор |

Цель — ни один роут > ~250 строк, ни один компонент не отвечает за две зоны UI.

## 3. Автоматизация

**Что есть сейчас:** TanStack server functions для всего; нет ни одной Supabase Edge Function, нет настроенного pg_cron (миграции этого не содержат), есть очередь писем `src/routes/lovable/email/queue/process.ts`, но без расписания.

**Что автоматизируем (через server routes под `/api/public/hooks/*` + pg_cron):**
1. **Обработка очереди писем** — `process.ts` уже есть, добавим cron «каждые 5 мин» на `/api/public/hooks/email-queue`.
2. **Брошенные корзины** — переводим клиентский вызов `notifyAbandonedCart` (защищённый, для авторизованных) в cron-сканер: раз в час пробегаем `cart_drafts` старше 60 мин без заказа.
3. **Очистка `suppressed_emails`, `email_unsubscribe_tokens`, истёкших `promo_codes`** — еженочный cron.
4. **SLA по заказам** — раз в час пометка просроченных заявок (>72ч в статусе `new`) и одно уведомление в Telegram админу.
5. **БД-триггеры:**
   - `audit_log` для `orders/cases/blog_posts/testimonials` (триггер пишет diff на UPDATE).
   - `order_timeline` авто-запись при смене `status`/`paid` (сейчас руками в коде каждой мутации).
   - Авто-`updated_at` уже есть через `touch_updated_at` — проверим, что навешен везде.
6. **Webhook от Resend** — есть `lovable/email/auth/webhook.ts`, добавим валидацию подписи и unit-тест.

## 4. Производительность

- **`admin.orders.tsx` realtime**: подписка инвалидирует весь список на любую запись в `orders`. Сделаем дебаунс 500мс + узкий фильтр по событию (UPDATE/INSERT) и сравнение `payload.new.id` с открытым диалогом.
- **Селект 500 строк заказов**: добавим серверную пагинацию (limit/offset через `useInfiniteQuery`).
- **Мемоизация**: только 6 `useMemo` в `CatalogGrid` — добавим в `CatalogDetail`, `cart.tsx` (расчёт итогов), `admin.orders.tsx` (фильтры, отсортированный список).
- **Lazy-импорты**: применяется только в 3 местах. Кандидаты — тяжёлые админ-страницы целиком (`admin.campaigns.$id`, `admin.marketing`, `admin.calendar`, `OrderAttachments` уже лениво — расширим).
- **Изображения каталога**: проверим `loading="lazy"` и `decoding="async"` в `StorageMedia`, добавим явные `width/height` для уменьшения CLS.
- **Запросы в sitemap.xml**: 6 параллельных `select * where published=true` — ок, но добавим `Cache-Control: s-maxage=3600` (уже есть) и в индексные сайтмапы агрегацию `updated_at` для `lastmod`.

## 5. Чистота кода

- **`any` в коде**: 17 в `admin.orders.tsx`, 12 в `profile.tsx`, 8 в `orders.functions.ts`, 7 в `admin.orders.$id.tsx`. Заменим на типы из `Database["public"]["Tables"][...]["Row"]` + узкие DTO.
- **`console.*`**: 25 вызовов. Оставим только осознанные `console.warn/error` в server-функциях (логи воркера), уберём отладочные `console.log`.
- **Дубли импорта `Database` типов** — заведём `src/lib/types.ts` с re-export алиасами `OrderRow`, `BlogPostRow`, …
- **Tailwind**: пройдёмся утилитой `tailwindcss --content` сборки → отчёт неиспользуемых произвольных значений (`bg-[#…]`), сожмём повторяющиеся «glass / gradient-text» классы в `@apply` в `styles.css`.
- **`catalog-mock.ts`** — используется как fallback в каталоге, оставим, но пометим как dev-fallback и вынесем в `lib/__mocks__/`.

---

## Дорожная карта (по приоритету и риску)

| # | Этап | Риск | Что проверяем |
|---|------|------|---------------|
| 1 | Извлечь `formatters.ts` + reuse | низкий | tsc + ручной осмотр админки |
| 2 | Фабрика catalog list/detail routes | средний | e2e: 4 каталога + 4 карточки, sitemap, breadcrumbs |
| 3 | Декомпозиция `admin.orders.tsx` + типы | средний | админ-смоук: список/диалог/мутации, realtime |
| 4 | Декомпозиция `cart.tsx` + мемоизация | средний | e2e: добавление/удаление/промо/оформление |
| 5 | БД-триггеры `audit_log` + `order_timeline` | высокий (DB) | миграция в staging, ревью DDL, rollback-скрипт |
| 6 | pg_cron хуки (email queue, abandoned, cleanup, SLA) | средний | ручной триггер `net.http_post`, логи воркера |
| 7 | Декомпозиция `admin.catalog.$type.tsx`, `admin.blog.tsx`, `profile.tsx` | средний | smoke по каждой странице |
| 8 | Производительность: realtime debounce, useInfiniteQuery, lazy-страницы, изображения | низкий | Lighthouse / Network panel до-после |
| 9 | Удаление `any`, чистка `console`, tailwind-чистка | низкий | tsc + snapshot UI |

Каждый этап = ≤1 PR, обязательная пара «тесты + ручная проверка». Можем стартовать с этапа 1 (самый дешёвый, нулевой риск) или с этапа 2 (самый высокий ROI — убирает 90% дублей каталога). Скажи, с чего начинаем.
