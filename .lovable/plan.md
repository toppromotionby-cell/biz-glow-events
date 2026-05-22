# План: волны 3–6

Выполняю все четыре оставшихся блока последовательно, чтобы не ломать UX и БД одновременно.

## Волна 3 — UX оформления заказа

Файлы: `src/routes/cart.tsx`, `src/components/cart/RequisitesModal.tsx` (новый), `src/routes/order.success.$id.tsx` (новый), `src/lib/orders.functions.ts`.

- Перевести форму корзины и модалку реквизитов на `react-hook-form` + `zod` (валидация email, телефона, УНП, длины полей, обязательность по типу клиента).
- Тип клиента: «физлицо» / «юрлицо / ИП». Для физлица реквизиты компании необязательны, скрыты. Для юрлица — обязательны: название, УНП, юр. адрес, ФИО ответственного, должность, основание (Устав / Доверенность № … от …).
- Черновик корзины и формы в `localStorage` (ключ `cart_draft_v1`), очистка после успешной отправки.
- Серверная функция `submitOrder` принимает расширенный payload (requisites JSON в `orders.notes` или в `order_items.meta`, без миграции — храним в `notes` как JSON-строку с маркером).
- После успеха — редирект на `/order/success/$id` с номером заказа, контактами менеджера, кнопкой «Скачать КП» (заглушка).
- Тосты ошибок/успеха через существующий `sonner`.

## Волна 4 — Админка/CRM

Файлы: `src/routes/admin.orders.tsx`, `src/lib/admin-orders.functions.ts` (новый, серверные fn с `requireSupabaseAuth` + проверкой роли admin/manager).

- Серверная пагинация (`range`) + сортировка, размер страницы 25/50/100.
- URL-фильтры (TanStack Router `search`): статус, диапазон дат, источник, UTM, менеджер, поиск (debounce 300мс).
- Inline-смена статуса (Select в строке) с оптимистичным апдейтом и записью в `order_timeline`.
- Назначение менеджера: выпадающий список из `user_roles` где role=manager/admin.
- Realtime подписка на `orders` — точечный invalidate React Query при INSERT/UPDATE + toast.
- Двойной клик по строке открывает существующий модал с детализацией (уже сделано, дорабатываем layout: вкладки «Заказ / Клиент / Реквизиты / Таймлайн / Вложения»).

## Волна 5 — Производительность

- `vite-imagetools` для статических ассетов, импорт `?format=webp&as=picture` для hero.
- `<link rel="preload" as="image">` LCP-изображения в `head()` `index.tsx`.
- `font-display: swap` в Google Fonts URL.
- `loading="lazy"` + явные `width/height` для всех каталожных карточек.
- Code-split тяжёлой админки (она уже route-split, но проверить динамические импорты модалов).
- `React.memo`/`useMemo` для тяжёлых таблиц.

## Волна 6 — Google OAuth + og:image

- `supabase--configure_social_auth` providers=["google"], дописать кнопку «Войти через Google» в `/login` и `/register` через `lovable.auth.signInWithOAuth("google", …)`.
- Сгенерировать брендовый `og:image` 1200×630 (premium) под доменом event-hub.by, положить в `src/assets/og-default.jpg`.
- Подключить как дефолтный `og:image`/`twitter:image` в `head()` ключевых статических страниц (`index`, `about`, `services`, `contact`), на динамических — оставить картинку контента.

## Технические заметки

- Никаких изменений схемы БД (реквизиты пишем в `notes` JSON-строкой, чтобы не менять контракт `orders`). Если позже захотите отдельную таблицу `order_requisites` — отдельная миграция.
- Все новые серверные функции — `createServerFn` + `requireSupabaseAuth`, без edge functions.
- Обязательно дописать `attachSupabaseAuth` в `src/start.ts`, если не подключён.

## Порядок выполнения

1. Волна 3 (UX) — самое заметное для пользователя.
2. Волна 6 (OAuth + og) — быстрый win, не зависит от остального.
3. Волна 4 (Админка) — отдельный серверный модуль.
4. Волна 5 (Performance) — финальная полировка и замеры.
