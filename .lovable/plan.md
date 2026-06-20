# Скачивание реального PDF вместо окна печати

Сейчас на страницах `/admin/orders/$id/quote|invoice|contract|act` кнопка «Сохранить PDF» вызывает `window.print()` (вкладка «Печать» браузера). Заменим её на скачивание настоящего PDF-файла — генератор `buildOrderDocPdf` (pdf-lib + Roboto) уже есть и используется для писем.

## Изменения

1. **`src/lib/documents/render.server.ts`**
   - Кнопка `.print-btn` становится ссылкой `<a class="print-btn" href="?format=pdf">Скачать PDF</a>` (относительный URL — работает на всех 4 маршрутах).
   - CSS остаётся (тот же скрытый-в-печати класс).

2. **`src/routes/admin.orders.$id.quote.tsx`** (и аналогично `invoice`, `contract`, `act`)
   - В начале GET-хендлера: `const wantsPdf = new URL(request.url).searchParams.get("format") === "pdf";`
   - Если `wantsPdf` — после загрузки `order/items/settings` вызвать `buildOrderDocPdf(kind, order, items, settings)` и вернуть Response с заголовками:
     ```
     content-type: application/pdf
     content-disposition: attachment; filename="<buildAttachmentFilename(kind, order)>"
     ```
     (для filename используем `filename*=UTF-8''<encoded>` чтобы кириллица не ломалась).
   - Иначе — текущая ветка с HTML-превью (как сейчас).

3. Превью внутри `admin.orders.$id.tsx` (вкладки с iframe `data:application/pdf;base64,…`) и отправка PDF в письмах **не меняются** — там уже настоящий PDF.

Никаких изменений БД, схем, дизайна.
