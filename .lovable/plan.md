## Что происходит сейчас

Письма уже пытаются отправляться с правильного домена — отправитель настроен как `event-hub.by <noreply@event-hub.by>` через верифицированный subdomain `notify.event-hub.by`. DNS, ключи, очередь pgmq и cron работают.

Падение каждое 15 секунд по логам `email_send_log`:

```
status: failed
error_message: Email API error: 400 {"type":"missing_unsubscribe",
  "message":"Transactional emails must include an unsubscribe_token"}
```

После 5 попыток сообщение уходит в DLQ. Затронуты все клиентские и админ-уведомления: `admin-order`, `admin-lead`, `admin-inquiry`, `client-inquiry-received`, `client-order-confirmed` (а значит и письма после подтверждения заказа с КП/счётом/договором/актом, которые им вызываются).

## Причина

В проекте два пути отправки писем:

1. Штатный `/lovable/email/transactional/send` — он сам создаёт/находит unsubscribe-токен в `email_unsubscribe_tokens`, проверяет `suppressed_emails` и кладёт корректный payload в pgmq.
2. Хелпер `src/lib/admin-email.server.ts` — кладёт payload в `transactional_emails` напрямую через `enqueue_email`, **без** `unsubscribe_token` и без проверки suppression. Lovable Email API такие письма принципиально не принимает (политика антиспама), поэтому всё, что идёт через этот хелпер, заведомо проваливается.

То есть домен и инфраструктура ни при чём — обходной путь отправки нарушает контракт API.

## Что нужно сделать

### 1. Починить enqueue в `src/lib/admin-email.server.ts`

В функции `enqueue()`:

- Нормализовать адрес получателя (lower-case, trim).
- Проверить `suppressed_emails`: если адрес в списке — записать в `email_send_log` `status='suppressed'` и выйти без enqueue (как делает штатная роута).
- Найти существующий неиспользованный токен в `email_unsubscribe_tokens` для этого email; если нет — сгенерировать `crypto.randomUUID()` и вставить новую строку (`email`, `token`, `used_at: null`).
- Добавить в payload поле `unsubscribe_token: <token>`.
- Остальное (`from`, `sender_domain`, `idempotency_key`, лог `pending`) оставить как есть.

После этого все письма, которые сейчас падают в DLQ, начнут уходить — формат `From: event-hub.by <noreply@event-hub.by>` уже корректный.

### 2. Подтвердить, что весь поток идёт с event-hub.by

Уже так, менять ничего не нужно:

- `src/routes/lovable/email/transactional/send.ts`, `src/lib/admin-email.server.ts`, `src/routes/lovable/email/auth/webhook.ts` — все используют `SENDER_DOMAIN = "notify.event-hub.by"` и `FROM_DOMAIN = "event-hub.by"`.
- Маркетинговые рассылки `src/lib/campaigns.functions.ts` идут через Resend-коннектор и используют `sender_email` из самой кампании — это отдельный канал, к падающим транзакционкам отношения не имеет.

### 3. Прибрать «исторические» падения (по желанию)

После фикса в `email_send_log` останется куча `failed`/`dlq` строк. Их можно либо оставить как историю, либо одним запросом очистить DLQ pgmq и удалить старые `failed/dlq` записи. Скажите, нужно ли — сделаю отдельной операцией.

### 4. Проверка после правки

- Создать тестовый заказ на сайте.
- Дождаться следующего тика cron (≤ 5 секунд).
- В `email_send_log` для нового `message_id` должна появиться строка `status='sent'`.
- Письмо приходит на ящик клиента и на `ADMIN_EMAIL` с отправителя `event-hub.by <noreply@event-hub.by>`.

## Чего эта правка не делает

- Не трогает DNS, ключи, домен, cron, инфраструктуру очереди.
- Не меняет шаблоны писем (КП/счёт/договор/акт прикрепляются как раньше — они формируются в `notifyClientOrderConfirmedEmail`, которое тоже использует `enqueue()` и автоматически починится).
- Не отключает Lovable Emails и не переключает проект на Resend для транзакционок.
