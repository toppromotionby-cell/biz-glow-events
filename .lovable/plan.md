## Контекст и диагноз

Письма «не доходят», хотя в истории видно «Письмо отправлено». В `email_send_log` все записи `client-order-confirmed` уходят в `dlq` с ошибкой:

```
Email API error: 403 no_matching_sender — "No sender domain matches the requested sender domain"
```

Причина: в проекте верифицирован отправитель `notify.event-hub.by`, но в коде (`admin-email.server.ts`, `lovable/email/transactional/send.ts`, `lovable/email/auth/webhook.ts`) жёстко прописан `SENDER_DOMAIN = "z.event-hub.by"`. После 5 попыток сообщения улетают в DLQ → клиент не получает письмо. UI при этом честно показывает «отправлено в очередь», но провайдер отбивает 403.

Параллельно пользователь хочет:
1. Чтобы после подтверждения заказа клиенту приходили КП, Счёт, Договор и Акт оказанных услуг.
2. Чтобы рядом с КП/Счётом/Договором появился «Акт выполненных услуг» с тем же функционалом, что и Договор (отдельная страница рендера + блок настроек в `/admin/settings/documents`).

## Что делаем

### 1. Чиним отправку писем (корневая причина «не доходят»)

- В трёх файлах меняем константу `SENDER_DOMAIN` с `z.event-hub.by` на `notify.event-hub.by`:
  - `src/lib/admin-email.server.ts`
  - `src/routes/lovable/email/transactional/send.ts`
  - `src/routes/lovable/email/auth/webhook.ts`
- `FROM_DOMAIN` оставляем `event-hub.by` (это From-заголовок).
- После фикса очередь сама перестанет ронять сообщения; чтобы старые «застрявшие» письма не висели как DLQ навсегда, ничего дополнительно делать не нужно — новые отправки пойдут с новыми `message_id` (per `resend`/`confirm`).

### 2. Новый документ «Акт оказанных услуг»

**Миграция БД** — расширяем существующий singleton `document_settings`:

- `act_validity_days int default 5`
- `act_footer text default '…'`
- `act_intro text default 'Настоящий Акт составлен о том, что Исполнитель оказал, а Заказчик принял услуги в полном объёме и надлежащего качества. Стороны претензий друг к другу не имеют.'`

Дефолты прописываются в `DEFAULT_DOCUMENT_SETTINGS` и схеме Zod в `src/lib/document-settings.functions.ts`.

**Новый серверный маршрут** `src/routes/admin.orders.$id.act.tsx`:

- Структура 1:1 как у `admin.orders.$id.contract.tsx`/`invoice.tsx`: `requireStaff` + загрузка `orders`+`order_items`+`document_settings`, рендер через общий `renderShell` из `src/lib/documents/render.server.ts`.
- Шапка: «Акт оказанных услуг №<id> от <date>», город, реквизиты Исполнителя/Заказчика (через `partyCard`).
- Таблица позиций с итогом (как в счёте, но без блока «к оплате»).
- Текст из `settings.act_intro`, footer из `settings.act_footer`, упоминание срока приёмки `act_validity_days`.
- Подписи сторон (как в договоре/счёте).

**Кнопка в `OrderDialog.tsx`** — расширяем `openDoc` тип до `"quote" | "invoice" | "contract" | "act"` и добавляем четвёртую кнопку «Акт».

**Настройки `/admin/settings/documents`** — добавляем таб «Акт» с теми же контролами, что у «Договор»/«Счёт»: дни приёмки, вступительный текст, footer, кнопка «Открыть пример» (передаёт `kind="act"` в `openPreview`).

### 3. Документы в письме подтверждения

Поскольку SaaS-провайдер не поддерживает вложения, прикладывать будем ссылки. Чтобы клиент мог открыть документы без авторизации, делаем подписанные публичные URL:

- Расширяем `sendOrderConfirmationEmailAndLog` (`src/lib/orders.functions.ts`): перед отправкой генерируем 4 HTML-документа (`quote/invoice/contract/act`) теми же функциями, что используют серверные роуты (рефакторим render-логику в `src/lib/documents/render.server.ts` так, чтобы её можно было вызвать и из роута, и из server fn), сохраняем каждый в bucket `order-attachments` под путём `orders/<order_id>/<kind>-<yyyymmdd>.html` через `supabaseAdmin.storage`, получаем `createSignedUrl` на 30 дней.
- В `buildClientOrderConfirmedEmail` (`src/lib/admin-email.server.ts`) добавляем секцию «Документы» с четырьмя кнопками-ссылками (КП, Счёт, Договор, Акт) в едином стиле письма; передаём URLs через `ClientOrderConfirmedPayload.documents`.
- Если документ не удалось сгенерировать/загрузить — конкретная ссылка просто скрывается; письмо всё равно уходит, ошибка пишется в `order_timeline` как `documents_attach_failed` с деталями.

### 4. Проверка

- `tsc --noEmit` зелёный.
- Запуск Playwright против `localhost`: открываем `/admin/orders/<id>` под админом (restore session из env), жмём «Акт» — открывается HTML страница, скриншот.
- На странице `/admin/settings/documents` переключаемся на таб «Акт», правим значение, ждём автосейв, жмём «Открыть пример» — проверяем что изменение появилось.
- Подтверждаем заказ → в `email_send_log` ожидаем `status='sent'` (не `dlq`) и `error_message IS NULL`; проверяем что в письме рендерятся 4 ссылки.

## Технические детали (не для пользователя)

- `renderShell`/`esc`/`money`/`partyCard` уже общие — для Акта используем их же; новых стилей не вводим.
- Сторадж `order-attachments` уже существует и приватный; используем `createSignedUrl(path, 60*60*24*30)`.
- В Zod-схему `SettingsSchema` добавляем три новых поля; в `normalize()` правок не нужно.
- `OrderTimelineList` уже отображает любые event'ы — отдельной локализации `documents_attach_failed` не делаем (fallback на сырое имя).
- Поскольку `email_send_log` теперь будет иметь `sent`/`dlq` корректно, страница `/admin/notifications` сразу начнёт показывать реальный статус без правок.

## Вне scope

- Реальная PDF-генерация (остаёмся на HTML + print-to-PDF в браузере клиента — кнопка печати уже в `renderShell`).
- Версионность шаблонов/история правок.
- Перевыпуск ранее «DLQ-нутых» писем — можно нажать «Отправить повторно» в карточке заказа после фикса.
