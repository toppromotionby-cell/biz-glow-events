# Drag-and-drop по админке

Добавляем перетаскивание мышью (зажал → перенёс) во всех ключевых разделах админки. Используем библиотеку `@dnd-kit` (де-факто стандарт, доступен, лёгкий, без конфликтов с shadcn).

## 1. Подготовка БД

Добавляем колонку `sort_order INTEGER NOT NULL DEFAULT 0` туда, где её нет:
- `blog_posts`, `cases`, `zones`, `tech_equipment`, `services`, `production_items`, `site_sections`
- (`testimonials` уже имеет `sort_order`)

Заполняем начальными значениями по текущему `created_at DESC`, чтобы порядок не «прыгнул». Добавляем индексы по `sort_order`.

Публичные списки начнут сортироваться по `sort_order ASC, created_at DESC` — поменяю запросы в `src/lib/*.functions.ts` и публичных роутах (`/blog`, `/cases`, `/zones`, `/equipment`, `/services`, `/production`).

## 2. Универсальный компонент сортировки

Новый `src/components/admin/SortableList.tsx` на базе `@dnd-kit/core` + `@dnd-kit/sortable`:
- слева у каждой строки маленькая «ручка» (иконка `GripVertical`), за неё тянем — клики по остальной строке не перехватываются
- после drop пересчитываем `sort_order` пакетно одним `upsert`, оптимистично обновляем UI, при ошибке откатываем + toast
- работает с любым массивом `{ id, ... }` через render-prop

## 3. Применение к спискам админки

Подключаю `SortableList` в:
- `admin.testimonials.tsx` — уже есть `sort_order`, просто заменяем UI
- `admin.blog.tsx`, `admin.cases.tsx`
- `admin.catalog.$type.tsx` (одной правкой покрывает зоны / оборудование / услуги / производство)
- `admin.sections.tsx` (секции главной)

## 4. Виджеты дашборда `/admin`

В `admin.index.tsx` обернуть карточки статистики в `SortableList`. Порядок сохраняется per-user в `localStorage` (ключ `admin:dashboard:order:v1`) — для одной таблицы предпочтений делать миграцию избыточно.

## 5. Таблицы: ресайз и порядок колонок

Новый хук `useTableLayout(tableKey, defaultColumns)`:
- ширины и порядок колонок хранятся в `localStorage` per-user
- ресайз: тянем за правый край `<th>` (cursor `col-resize`), минимум 60px
- порядок: тянем за заголовок (`@dnd-kit/sortable` по горизонтали)
- кнопка «Сбросить раскладку» в правом верхнем углу таблицы

Применяю в самой нагруженной таблице — `admin.orders.tsx`. Если ок — расширим на остальные таблицы в следующей итерации (чтобы не раздувать один заход).

## Технические детали

- `bun add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`
- DnD-сенсоры: `PointerSensor` с `activationConstraint: { distance: 6 }` — клики/двойные клики по строкам в `admin.orders` продолжат работать
- запись `sort_order` батчем: `supabase.from(table).upsert(items.map((it, i) => ({ id: it.id, sort_order: i })))`
- realtime в `admin.orders` уже подписан — после `upsert` сам перерисуется
- сохраняем существующие inline-редакторы (статус, оплата) — DnD-ручка отдельная зона

## Что НЕ входит в этот заход

- DnD внутри редакторов контента (медиа-галереи, FAQ-блоки) — можно отдельной задачей
- Drag-n-drop колонок во всех остальных таблицах кроме `orders` (расширим после теста)
- Серверное сохранение раскладки таблиц (пока только localStorage)
