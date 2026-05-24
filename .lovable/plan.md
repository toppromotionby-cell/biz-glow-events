
# Аудит разметки админки

Прошёлся по всем 22 файлам `src/routes/admin*.tsx` (3475 строк). Структура чистая, баги отсутствуют — но видна сильная **повторяемость одних и тех же блоков разметки** между страницами CRUD-каталогов и редакторов. Один и тот же шаблон «шапка + список слева + редактор справа» воспроизведён руками в 7 страницах с десятками копий длинных Tailwind-цепочек.

## Что повторяется (с цифрами)

| Паттерн | Где | Кол-во |
|---|---|---|
| `<header>` с `text-3xl font-display font-bold gradient-text` + кнопка «Добавить» с `bg-gradient-primary glow-primary` | catalog, cases, testimonials, promo, blog, marketing, newsletter, availability, orders, users | **14** |
| Левый сайдбар-список `glass rounded-xl p-3 max-h-[70-75vh] overflow-y-auto` | catalog, cases, testimonials, promo | **4** (идентичные классы) |
| Карточка-пустышка справа `glass rounded-xl p-10/12 text-center text-muted-foreground` «Выберите …» | catalog, cases, testimonials, promo | **4** |
| Шапка-редактора: `flex items-center justify-between flex-wrap gap-3` + Switch publish/featured + Удалить + Сохранить | catalog, cases, testimonials, promo, marketing | **5** |
| `<div className="space-y-2"><Label>…</Label><Input … /></div>` | catalog, cases, testimonials, promo, blog, marketing, availability | **16** |
| Таблица `glass rounded-xl overflow-hidden` + `thead bg-muted/30 text-muted-foreground text-xs uppercase` | orders, users, marketing | **3** |
| Бейдж статуса `px-2 py-0.5/1 rounded-full text-xs border` | orders, blog, promo, cases, testimonials, availability | **8+** |

## Замечания по UX/вёрстке (мелкие, без регрессий)

1. `admin.orders.tsx`: открытие карточки заказа по **двойному клику** — нестандартно и не дискаверабельно. Лучше один клик по строке (а stop-propagation оставить только на интерактивных ячейках статуса/оплаты/ссылки).
2. `admin.cases.tsx` / `admin.testimonials.tsx` / `admin.promo.tsx`: подсветка выбранной записи в списке использует `selected?.id`, но в catalog подсветка завязана на `selected`, а открывается `preview` — выбранная запись визуально не помечается. Нужно унифицировать: подсветка = «то, что открыто в редакторе».
3. `admin.tsx`: при `loading` показываем «Проверка доступа…», но `<Outlet />` не рендерится, и сайдбар тоже скрыт — лёгкое мерцание. Можно показывать скелетон-сетку (sidebar + main) той же ширины.
4. `admin.availability.tsx`: статусы `booked/maintenance` раскрашены `bg-destructive/20` и `bg-warning/20` инлайном — стоит превратить в общий `<StatusPill>`.
5. `admin.orders.tsx` карта статусов `STATUS_COLOR` (8 строк цветов прямо в файле) и `admin.index.tsx` `STATUS_LABEL` (в двух файлах) — дубли. Перенести в `src/lib/order-status.ts`.
6. `admin.blog.tsx` использует кастомный `useState` вместо react-query (единственная страница без него). Не блокер, но непоследовательно.
7. `<select>` нативный встречается в 4 местах (orders, promo, blog), а в остальных — shadcn `<Select>`. Унифицировать на shadcn.
8. `admin.marketing.tsx`, `admin.cases.tsx`, `admin.catalog.$type.tsx`: остались `(c: any)`, `as any` — типизировать через `Database['public']['Tables'][…]['Row']`.

## План упрощения

### 1. Создать 5 общих admin-компонентов в `src/components/admin/`

- **`AdminPageHeader.tsx`** — `{ title, subtitle?, action? }`. Заменяет 14 одинаковых `<header>` блоков с `text-3xl font-display font-bold gradient-text` и кнопкой действия.
- **`AdminListPanel.tsx`** — обёртка левого сайдбара со скроллом. Принимает `{ items, isLoading, sortable?, getId, isActive, onSelect, onReorder?, renderItem }`. Инкапсулирует `glass rounded-xl p-3 max-h-[75vh] overflow-y-auto` + `SortableList` + состояния «Загрузка…» / «Пусто». Заменяет 4 практически идентичных блока в catalog/cases/testimonials/promo.
- **`AdminEditorShell.tsx`** — обёртка редактора с шапкой `{ switches, onDelete, onSave, saving }` (Publish/Featured/Active + кнопки). Заменяет 5 копий шапки редактора.
- **`AdminEmptyEditor.tsx`** — placeholder «Выберите … или создайте новый» (4 копии).
- **`Field.tsx`** — `{ label, children, hint?, required? }` для пары Label+Input. Срезает 16+ повторов `<div className="space-y-2"><Label>…<Input …/></div>` и упростит сетки `grid md:grid-cols-2 gap-4`.

### 2. Один общий `<StatusPill variant="…">` в `src/components/admin/StatusPill.tsx`

Маппинг status→class вытащить в один словарь. Использовать в:
- `admin.orders.tsx` (вместо STATUS_COLOR + inline-select-стилей),
- `admin.blog.tsx` («опубликовано/черновик»),
- `admin.cases.tsx`, `admin.testimonials.tsx` (точечки `●/○`),
- `admin.availability.tsx` (booked/maintenance),
- `admin.promo.tsx` (активен/нет).

### 3. Утилитные классы в `src/styles.css` (`@layer utilities`)

- `.admin-h1` — `text-3xl font-display font-bold gradient-text`
- `.admin-table-head` — `bg-muted/30 text-muted-foreground text-xs uppercase`
- `.btn-primary-gradient` — `bg-gradient-primary glow-primary` (используется 14 раз только в админке + ещё на сайте)

### 4. Вынести общие данные

- `src/lib/order-status.ts` — `ORDER_STATUS_LABEL`, `ORDER_STATUS_COLOR`, типы. Импортировать в `admin.orders.tsx`, `admin.orders.$id.tsx`, `admin.index.tsx`.

### 5. UX-фиксы (точечные)

- `admin.orders.tsx`: одиночный клик открывает модалку (исключения — ячейки status/paid/external link уже имеют `stopPropagation`); подсказка «двойной клик» убирается.
- `admin.catalog.$type.tsx`: вместо `selected` для подсветки + `preview` для открытия — оставить **одно** состояние «открыто в редакторе» и подсвечивать им же.
- `admin.tsx` loading-состояние рендерить с уже видимым sidebar-скелетоном.
- `admin.availability.tsx`: native `<Select>` уже shadcn — оставить; только обернуть статусы в `StatusPill`.

### 6. Без изменений

- Бизнес-логика, серверные функции, RLS, миграции — **не трогаем**.
- `admin.orders.$id.tsx`, `*.invoice/*.contract/*.quote.tsx` — там разметка уже компактная, только подключим `Field` и `AdminPageHeader`.
- `routeTree.gen.ts` — генерируется автоматически.

## Технические детали

```text
src/components/admin/
├── AdminPageHeader.tsx     (новый, ~25 строк)
├── AdminListPanel.tsx      (новый, ~50 строк)
├── AdminEditorShell.tsx    (новый, ~40 строк)
├── AdminEmptyEditor.tsx    (новый, ~10 строк)
├── Field.tsx               (новый, ~15 строк)
└── StatusPill.tsx          (новый, ~30 строк)

src/lib/
└── order-status.ts         (новый, ~25 строк)

src/styles.css              (+3 утилитные класса)
```

После рефакторинга ожидаемое сокращение: **~3475 → ~2700 строк** в admin-роутах (≈22%) при сохранении всего функционала и визуально идентичной странице.

## Порядок шагов

1. Создать 6 компонентов + `order-status.ts` + утилитные классы в `styles.css`.
2. Прогнать `bunx tsc --noEmit` — убедиться, что новые компоненты типизированы.
3. По одному файлу мигрировать роуты в порядке убывания дублей: `admin.testimonials` → `admin.cases` → `admin.promo` → `admin.catalog.$type` → `admin.blog` → `admin.marketing` → `admin.orders` → `admin.users` → `admin.availability` → `admin.index` → остальные.
4. После каждого файла — `bunx tsc --noEmit` и быстрый смок (`/admin/cases`, `/admin/orders`).
5. UX-фиксы (одиночный клик в orders, подсветка в catalog) — отдельным проходом после миграции.

Дизайн-токены, сетки и визуальные акценты остаются прежними — это чисто структурный рефакторинг разметки.
