# Починка двух упавших тестов мобильной вёрстки

## Причина (проверено запуском теста и чтением файлов)

`src/components/__tests__/mobile-layout.test.ts` сверяет классы Tailwind по исходникам. Два кейса отстали от рефакторинга каталога:

1. **«CatalogChoiceModal: cards stay centered until md…»** — карточки разделов больше не описаны внутри `CatalogChoiceModal.tsx`. Он теперь рендерит `grid-tiles` + общий компонент `CatalogSectionTile` из `src/components/catalog/CatalogNav.tsx`. Старых классов (`flex h-full flex-col items-center text-center gap-3`, `md:flex-row`, `justify-center md:justify-start`) в файле нет. Плюс шапка сейчас `text-center sm:text-center`, а тест ждёт другой вариант.
2. **«Catalog landing cards…»** — тест читает `src/routes/catalog.tsx`, которого нет: маршрут переименован в `src/routes/catalog.index.tsx`, а карточки живут в `CatalogSectionCard` (тот же `CatalogNav.tsx`). Тест падает с `ENOENT`.

То есть это не поломка вёрстки, а устаревшие ожидания теста: единый стиль карточек (иконка слева, текст справа, `min-w-0`/`shrink-0`) применяется теперь на всех ширинах намеренно.

## Что сделать

Обновить только тестовый файл `src/components/__tests__/mobile-layout.test.ts`, без изменений в UI:

- Кейс модалки: проверять, что `CatalogChoiceModal.tsx` использует `grid-tiles` и `CatalogSectionTile`, а `DialogHeader` остаётся с `text-center`.
- Кейс страницы каталога: читать `src/routes/catalog.index.tsx` (существование маршрута) и проверять инварианты карточки в `src/components/catalog/CatalogNav.tsx`: `h-full flex flex-col`, `shrink-0` у иконки, `min-w-0 flex-1` у текстового блока, перенос длинных заголовков (`text-balance`/`leading-snug`).
- Добавить короткий комментарий, что карточки каталога централизованы в `CatalogNav.tsx`, чтобы тест снова не разошёлся с кодом.

Остальные 7 кейсов (industries, about, terms-rental, partners, delivery, DirectionCard) не трогаем — они проходят.

## Проверка

`bunx vitest run src/components/__tests__/mobile-layout.test.ts` — ожидаем 9 passed.
