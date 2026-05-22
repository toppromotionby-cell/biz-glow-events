
# План: Массовая email-рассылка для пиара портала

Реализуем функцию массовых рассылок через встроенную инфраструктуру Lovable Emails (z.event-hub.by). Подходит для небольших объёмов (до нескольких сотен получателей за кампанию) — каждое письмо ставится в очередь индивидуально, очередь сама регулирует темп (~120 писем/мин по умолчанию).

## Что появится в админке

Новая вкладка/раздел **«Кампании»** в `/admin/newsletter`:

1. **Список кампаний** — таблица: тема, статус (черновик/отправляется/завершена), кол-во получателей, отправлено/ошибок, дата.
2. **Создание кампании**:
   - Тема письма
   - Контент: HTML-редактор (textarea с подсветкой) + плейсхолдер `{{name}}` для имени
   - Выбор получателей:
     - Подтверждённые подписчики (`newsletter_subscribers` где `confirmed_at IS NOT NULL`)
     - Все подписчики
     - Ручной список email (textarea, по одному на строку)
   - Кнопки: **Сохранить черновик**, **Превью**, **Отправить**
3. **Детали кампании** — прогресс отправки, журнал ошибок.

## База данных

Новые таблицы (миграция):

- `email_campaigns` — id, subject, html_content, recipient_filter (jsonb), status (`draft|sending|completed|failed`), total_recipients, sent_count, failed_count, created_by, started_at, completed_at
- `email_campaign_recipients` — id, campaign_id, email, name, status (`pending|sent|failed|suppressed`), error, sent_at

RLS: только админы.

## Логика отправки

1. **Server function** `start_campaign(campaign_id)`:
   - Загружает получателей по фильтру → вставляет в `email_campaign_recipients` со статусом `pending`
   - Меняет статус кампании на `sending`
   - Запускает фоновую обработку (пакетная постановка в очередь)
2. **Server function** `process_campaign_batch(campaign_id)`:
   - Берёт 50 pending получателей
   - Проверяет `suppressed_emails` → помечает `suppressed`
   - Для каждого вызывает `enqueue_email('transactional_emails', ...)` с шаблоном `marketing-broadcast`
   - Обновляет статус строки
   - Если остались pending — рекурсивно вызывает следующий батч
3. **Email-шаблон** `marketing-broadcast.tsx` в `src/lib/email-templates/`:
   - Принимает `subject`, `htmlContent`, `name`
   - Бренд-стилизация портала event-hub.by
   - Регистрация в `registry.ts`

Идемпотентность: `idempotencyKey = campaign-${campaign_id}-${recipient_id}`.

## Важные замечания

- **DNS для z.event-hub.by ещё не верифицирован.** Кампании можно создавать и сохранять как черновики прямо сейчас, но реальная отправка пойдёт только после подтверждения DNS. Прогресс можно отслеживать в Cloud → Emails.
- **Юридические риски**: массовая рассылка без явного согласия может ухудшить deliverability транзакционных писем (восстановление пароля). Шаблон автоматически содержит ссылку отписки (Lovable добавляет её в футер).
- **Объёмы**: для рассылок > 1000 писем за раз лучше отдельный сервис (Resend/Brevo) на другом поддомене.

## Технические детали

- Route: `src/routes/admin.newsletter.campaigns.tsx` + `src/routes/admin.newsletter.campaigns.$id.tsx`
- Server functions: `src/lib/campaigns.functions.ts` с `requireSupabaseAuth` + проверкой роли admin
- Шаблон: `src/lib/email-templates/marketing-broadcast.tsx`
- Миграция: новые таблицы с RLS (только admin)

Подтвердить — начну реализацию?
