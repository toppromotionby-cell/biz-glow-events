## Что меняем

Клиентские письма (`client-order-confirmed`, `client-inquiry-received`) сейчас:
- покрашены в фиолетовый (`#a78bfa`), а сайт — чёрный фон + оранжевый primary;
- прикладывают документы как ссылки на signed URL в Supabase Storage (HTML-файлы, активные кнопки в письме).

Нужно:
1. Перерисовать письма в фирменном стиле сайта (чёрный фон, оранжевый акцент `#f0a040`, Space Grotesk/Inter с fallback на system, тонкие границы, без «фиолета»).
2. Документы (КП, Счёт, Договор, Акт) генерировать как PDF и прикладывать к письму как вложения; убрать блок «Документы по заказу» со ссылками из тела письма.

## Реализация

### 1. PDF вместо HTML в `generateAndUploadOrderDocuments`
- Текущий `buildQuoteHtml/...` возвращает HTML, который грузится в `order-attachments` как `.html` и подписывается signed URL'ом.
- В Cloudflare Workers нельзя Puppeteer/sharp. Добавляем `pdf-lib` (чистый JS, работает в workerd) и пишем `buildOrderDocPdf(kind, order, items, settings): Promise<Uint8Array>` — отрисовывает шапку (название компании + реквизиты), мета (номер/дата/клиент), таблицу позиций, итог и подпись. Стили близкие к существующему `renderShell` (акцентная полоса, моно-цифры), но средствами pdf-lib.
- В `generateAndUploadOrderDocuments` меняем: путь `orders/${orderId}/${kind}-${date}.pdf`, contentType `application/pdf`, signed URL по-прежнему сохраняем в `order_timeline` (для админки/повторного скачивания), но **в письмо больше не передаём**.

### 2. Вложения в письме клиенту
- Расширяем тип очереди и сам процессор:
  - В payload в `enqueue()` добавляем `attachments?: Array<{ filename: string; content_base64: string; content_type: string }>`.
  - В `src/routes/lovable/email/queue/process.ts` пробрасываем `attachments` в `sendLovableEmail`. Если Lovable Email API не поддержит вложения — для `label === 'client-order-confirmed'` отправляем напрямую через уже существующий `sendViaResend` (Resend поддерживает `attachments: [{ filename, content }]`), минуя upstream, но сохраняя запись в `email_send_log` и suppression-чек. Решение примем по первому прогону; код напишем так, чтобы свитч на Resend был локальным.
- `notifyClientOrderConfirmedEmail` принимает `documentsPdf: Array<{ filename: string; bytes: Uint8Array }>` (вместо `documents` со ссылками) и кладёт их в payload в base64.

### 3. Редизайн HTML писем под сайт
В `buildClientOrderConfirmedEmail` и `notifyClientInquiryReceivedEmail`:
- фон `#000000`, карточка `#0c0c10` с border `1px solid #1a1a1f`, радиус 16px;
- заголовки и акценты — оранжевый `#f0a040` (или градиент `linear-gradient(135deg,#f0a040,#f5c97a)` для кнопок);
- текст `#e8e8ec`, вторичный `#9a9aa3`;
- шрифт `'Space Grotesk', system-ui, sans-serif` для заголовков, `'Inter', system-ui, sans-serif` для body (всё inline, без `@import` — email-клиенты деградируют в system-ui);
- убрать блок «Документы по заказу» — заменить одной строкой «КП, счёт, договор и акт во вложении к этому письму (PDF)»;
- сохранить структуру: статус-пилюля, мета заказа, таблица позиций, итог/оплачено/осталось, кнопка «Личный кабинет», подпись.
- В `notifyClientInquiryReceivedEmail` — те же токены цвета и шрифтов; вложений нет, ссылка на уточняющую анкету остаётся (это не документ, а сам CTA письма).

### 4. Что не трогаем
- Админские письма (`admin-order`, `admin-lead`, `admin-inquiry`) — у них своя логика и роль, дизайн остаётся.
- `src/lib/documents/render.server.ts` (HTML-документы для админки/печати) — продолжает использоваться для просмотра в админке.
- Authentication-письма, очередь pgmq, suppression, unsubscribe — без изменений.

## Технические детали

- Новый пакет: `bun add pdf-lib`.
- PDF-шрифты: используем встроенный `StandardFonts.Helvetica` + bold — кириллица в Standard 14 шрифтах PDF **не поддерживается**. Поэтому встраиваем TTF: кладём `Inter-Regular.ttf` и `Inter-Bold.ttf` в `src/assets/fonts/` (через `lovable-assets`), грузим их в `pdf-lib` через `pdfDoc.embedFont(bytes, { subset: true })`. Это критично — без этого русский текст в PDF превратится в крякозябры.
- Размер вложения: 4 PDF × ~30–60 КБ ≈ 200 КБ — в пределах лимитов Resend (40 МБ) и pgmq payload (1 МБ).
- В `email_send_log` отдельно не логируем размер вложений; статусы `sent/failed` остаются.

```text
orders.functions.ts
  └─ generateAndUploadOrderDocumentsPdf()   ← новое, отдаёт {pdfBytes, signedUrl}
        ├─ buildOrderDocPdf(kind, ...)      ← новое, pdf-lib
        └─ upload .pdf + signed URL (для админки)
  └─ sendOrderConfirmationEmailAndLog()
        └─ notifyClientOrderConfirmedEmail({ ..., attachments: pdfs })

admin-email.server.ts
  └─ buildClientOrderConfirmedEmail()       ← новые цвета/шрифты, без блока документов
  └─ notifyClientInquiryReceivedEmail()     ← новые цвета/шрифты
  └─ enqueue() пробрасывает attachments в payload

routes/lovable/email/queue/process.ts
  └─ передаёт attachments в send; для client-order-confirmed — fallback на sendViaResend
```

## Проверка после реализации

1. Подтвердить заказ в админке → проверить в `email_send_log` статус `sent`.
2. Открыть письмо в почте: фон чёрный, акценты оранжевые, нет блока «Документы по заказу», 4 PDF вложения, кириллица читается.
3. Открыть `inquiry-received` — стиль обновился, ссылка на анкету работает.
