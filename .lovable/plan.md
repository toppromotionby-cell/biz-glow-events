## Что нашёл

Прошёлся по `src/routes` (70 файлов) и `src/components` (54 файла). Код в порядке, но 5 паттернов копируются повсеместно и раздувают разметку. Главные находки:

1. **Карточка `glass rounded-* overflow-hidden hover:border-primary/50 ...` встречается 122 раза.** Структура «обложка 16/10 + paragraph` с `line-clamp` повторяется на главной (кейсы, блог), в `/cases`, `/blog`, `/lp/$slug`, `geo.$city` — каждый раз заново.
2. **На главной `FEATURES.map` рендерится дважды** — в блоке «Направления» (стр. 122–132) и в «Заказ услуг» (стр. 296–318) — одинаковая иконка-плитка + заголовок + описание, но в двух разных JSX-формах.
3. **Кнопки `+` / `−` / удалить в корзине** — длинная className на 200+ символов дублируется 3 раза подряд (cart.tsx 207, 217, 227).
4. **Кнопки закрытия Dialog/Sheet/CartRecoveryBanner/SupportChat** — одинаковая className на 200+ символов скопирована в 4 местах.
5. **Hero spark-burst на главной** (60 искр через `Array.from({length:60}).map(...)` со стилями inline) занимает 22 строки JSX внутри роута и мешает читать код страницы.

Кроме этого: пустая корзина рендерит 4 почти одинаковых `<Link>` подряд; `OrderDialog` — 3 одинаковые контактные карточки; на главной кейсы и блог делают идентичную teaser-карточку.

## Предлагаемые упрощения

### Шаг 1. Вынести 4 переиспользуемых компонента (без изменения визуала)

- `src/components/ui/MediaCard.tsx` — обложка 16/10 + контент-слот. Заменяет дубли в `index.tsx` (кейсы + блог), `cases.tsx`, `blog.tsx`, `lp.$slug.tsx`, `geo.$city.tsx`. Принимает `to`, `cover`, `eyebrow`, `title`, `excerpt` или `children`.
- `src/components/ui/DirectionCard.tsx` — иконка-плитка + заголовок + описание + опциональный CTA. Заменяет оба рендера `FEATURES` на главной.
- `src/components/ui/QtyStepper.tsx` — кнопки `−` / число / `+`. Заменяет дубли в `cart.tsx` (и потенциально в `CatalogQuickView`).
- `src/components/SparkBurst.tsx` — 60 искр уезжают из `index.tsx` в отдельный файл; в роуте остаётся `<SparkBurst />`.

### Шаг 2. Свести 3 длинных className к утилитам в `src/styles.css`

В `@layer utilities` добавить:
- `.btn-icon-soft` — `h-7 w-7 inline-flex items-center justify-center rounded-md border border-border bg-background/60 hover:bg-primary/10 hover:border-primary/40 disabled:opacity-40 transition` (используют корзина, степпер).
- `.btn-icon-danger` — то же, но с `border-destructive/30 hover:text-destructive hover:bg-destructive/10`.
- `.btn-dialog-close` — длинный absolute-класс кнопки закрытия модалок; обновить `dialog.tsx`, `sheet.tsx`, `CartRecoveryBanner.tsx`, `SupportChat.tsx`.

### Шаг 3. Локальные мелочи

- В пустой корзине заменить 4 хардкод-`<Link>` на `.map()` по массиву разделов.
- В `OrderDialog` (`index.tsx`) — массив контактных карточек + один `.map()`.
- В `index.tsx` секцию «Заказ услуг» переписать через `DirectionCard` + общий рендер.

## Итого

- Минус ~250–300 строк JSX без потери функционала.
- 4 новых небольших компонента + 3 utility-класса.
- Визуал и поведение остаются ровно прежними — это чисто рефакторинг разметки.
- Отдельно НЕ трогаю: админку (другая логика, другой риск), shadcn-примитивы кроме `dialog.tsx`/`sheet.tsx` (там только замена строки className).

## Технические детали

- Все новые компоненты — презентационные, без хуков и без зависимости от данных. Принимают `to?: LinkOptions` или `onClick`.
- `MediaCard` использует тот же `<Link>` из `@tanstack/react-router` с `from={Route.fullPath}` опциональным; по умолчанию рендерит `<article>` если `to` не задан.
- `QtyStepper` — управляемый: `value`, `onChange`, `min`, `max`, `label`. Aria-label генерируется из `label`.
- Утилиты в `styles.css` идут под `@layer utilities`, чтобы их можно было перекрывать произвольным `className`.
- TypeScript строгий: проверим `bunx tsc --noEmit` после каждого шага.
- Никаких изменений в БД/RLS/server functions — это чисто фронт.

После одобрения сделаю Шаги 1→2→3 последовательно, между шагами прогоняю tsc.