## Цель
Присваивать заказам человекочитаемые номера формата `ДД/ММ/ГГГГ-NN`, где `NN` — порядковый номер заказа за этот календарный день (по дате `created_at` в таймзоне Europe/Minsk). Существующий UUID `id` сохраняется как первичный ключ и не меняется.

## Изменения в БД (одна миграция)

1. **Новая колонка** `orders.order_number text` (nullable, `UNIQUE`).
2. **Функция** `public.generate_order_number(created timestamptz) returns text` — `SECURITY DEFINER`, вычисляет дату в `Europe/Minsk`, считает `count(*) + 1` по существующим заказам с той же датой и форматирует `DD/MM/YYYY-NN` с zero-pad для NN (минимум 2 знака; >99 — естественное расширение до 3).
3. **Триггер** `BEFORE INSERT` на `public.orders`: если `order_number IS NULL`, проставляет результат функции. На случай гонок — `EXCEPTION WHEN unique_violation THEN` повтор с +1 (до 5 попыток).
4. **Бэкфилл** существующих заказов: `UPDATE` в цикле по `created_at ASC`, нумерация в рамках каждого дня по хронологии создания. Привязка строго к `created_at`, как просил пользователь (не к `event_date`).
5. **Индекс** на `(date_trunc('day', created_at AT TIME ZONE 'Europe/Minsk'))` для быстрой нумерации.

Важно: номер привязан к дате заказа (created_at), не к дате мероприятия. При изменении других полей номер не пересчитывается. Колонку нельзя редактировать вручную из UI.

## Изменения во фронте

- **Типы** Supabase регенерируются после миграции — `order_number` появится в `OrderRow`.
- **Список заказов** `src/routes/admin.orders.index.tsx` и связанные компоненты в `src/components/admin/orders/`: вместо `#{id.slice(0,8)}` показывать `order_number`, fallback на короткий UUID для старых записей (на случай, если бэкфилл не сработал).
- **Карточка заказа** `src/routes/admin.orders.$id.tsx`: заголовок «Заказ {order_number}», в подвале строкой мелким шрифтом — технический UUID для отладки.
- **Профиль клиента** `src/components/profile/OrderHistoryList.tsx`: «Заявка {order_number}».
- **Письма и PDF** (`src/lib/email-templates/*`, `src/lib/documents/*`): в шапке/теме письма и в КП/счёте/договоре/акте использовать `order_number`. Темы писем: «Заказ 20/06/2026-01 подтверждён» и т.п.
- **Страница успеха** `src/routes/order.success.$id.tsx`: показывать `order_number` вместо `id.slice(0,8)`. Серверная функция, возвращающая данные после создания, должна включать новое поле.
- **Поиск/фильтры** в админке: поиск по `order_number` (ILIKE).

URL-ы заказов остаются на UUID — `/admin/orders/{uuid}` не меняем, чтобы не ломать ссылки в письмах и таймлайне.

## Что НЕ меняется
- Первичный ключ и все FK (`order_items.order_id`, `order_timeline.order_id`, `order_attachments.order_id`).
- Логика статусов, оплат, документов.
- Существующие токены (`clarification_token`), webhook'и, RLS.

## Открытый вопрос
Для нумерации использую таймзону **Europe/Minsk** (UTC+3). Подтверди — или укажи другую (например, UTC).
