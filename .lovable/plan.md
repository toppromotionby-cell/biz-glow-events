# Переработка блока «Email-рассылки» → «Приглашения новым клиентам»

Текущий блок (`/admin/campaigns/*`, таблицы `email_campaigns`, `email_campaign_recipients`, отправка через Resend) сделан под полноценные маркетинговые кампании: ролей, сегменты, отчёты, ручной HTML. Это избыточно для задачи «отправить приглашение 5–10 адресам» и часть кода вообще не работает (Resend не верифицирован для `event-hub.by`). Перерабатываем всё на простой и надёжный сценарий поверх **Lovable Emails** (тот же канал, что уже работает для писем по заказам).

## Что появится у пользователя

Страница **«Email-рассылки» → «Пригласить клиентов»** (`/admin/campaigns` оставляем как URL, чтобы не ломать пункт меню):

- Поле **«Email-адреса»** — textarea, ввод 1–10 адресов через запятую/пробел/перенос строки. Валидация и счётчик: «Распознано: N · максимум 10». Кнопка отправки активна при 1 ≤ N ≤ 10.
- Поле **«Имя получателя»** *(необязательно)* — если введено и адресов 1, идёт в обращение «Здравствуйте, Анна!»; если несколько — игнорируется, идёт нейтральное «Здравствуйте!».
- Поле **«Личное сообщение»** *(необязательно, до 500 символов)* — короткий текст под заголовком письма. Если пусто — берётся стандартный текст приглашения.
- Кнопки **«Превью письма»** (открывает iframe с готовым шаблоном) и **«Отправить тест себе»**.
- Кнопка **«Отправить приглашения»** с подтверждением.
- Сразу под формой — лог последних 20 отправленных приглашений (адрес, статус, время) из `email_send_log`, фильтр `template_name='client-invite'`.

## Письмо-приглашение (в стилистике сайта)

Новый React Email шаблон `src/lib/email-templates/client-invite.tsx`, регистрируется в `registry.ts` как `client-invite`. По образцу существующих шаблонов (`admin-order`, `admin-lead`) и оформления писем по заказам:

- Шапка: оранжевый акцентный бар + логотип/название «event-hub.by».
- Заголовок: «Добро пожаловать в event-hub.by» (или с именем).
- Короткий описательный блок (что мы делаем: зоны, оборудование, услуги, производство, под ключ).
- 3 буллета-преимущества (быстрый расчёт, готовые комплекты, поддержка по WhatsApp/Telegram).
- Опциональный блок с «Личным сообщением» от менеджера.
- CTA-кнопка «Посмотреть каталог» → `https://event-hub.by` (оранжевая, как `btn-primary-gradient`).
- Контакты внизу из `src/lib/contacts.ts` (телефон, Telegram, email).
- Subject: «Приглашение в event-hub.by» (или с именем).
- Цвета/шрифты/отступы — из общего email-стиля (тот же `Body bg:#ffffff`, акцент `#f0a040`, контейнер 600px), чтобы визуально совпадало с подтверждением заказа.

Системный футер с unsubscribe-ссылкой добавит сама инфраструктура Lovable Emails — в шаблоне его не пишем.

## Технически

1. **Шаблон** `src/lib/email-templates/client-invite.tsx` (React Email компонент + `template` export) + регистрация в `registry.ts`.
2. **Хелпер** `src/lib/email/send.ts` (тонкая обёртка над `/lovable/email/transactional/send`, JWT текущего пользователя). Используется и приглашениями, и в будущем — другими триггерами.
3. **Новая server fn** `sendClientInvitations` в `src/lib/campaigns.functions.ts`:
   - middleware `requireSupabaseAuth` + проверка роли admin/manager,
   - Zod: `{ emails: string[].min(1).max(10), recipient_name?: string, personal_message?: string.max(500) }`,
   - дедуп адресов, нижний регистр, отсев из `suppressed_emails`,
   - для каждого адреса — отдельный POST в `/lovable/email/transactional/send` с `templateName='client-invite'`, `idempotencyKey='client-invite-<sha1(email+date)>'`, `templateData: { recipientName, personalMessage }`,
   - возвращает `{ queued: N, skipped_suppressed: M, errors: [...] }`. Сами доставки и retry уже отслеживаются в `email_send_log`.
4. **Server fn** `listRecentInvites` — последние 20 строк `email_send_log` где `template_name='client-invite'`, deduped по `message_id` (как в гайде дашборда).
5. **UI**: новый `src/routes/admin.campaigns.tsx` со страницей-формой выше. Удаляем `admin.campaigns.new.tsx`, `admin.campaigns.$id.tsx`, `admin.campaigns.$id.report.tsx`, `src/components/admin/CampaignEditor.tsx`.
6. **Старый код**: удаляем `listCampaigns/getCampaign/create/update/delete/preview/test/send` server fns, helper `src/lib/email/campaign-template.server.ts`, отправку через `src/lib/email/resend.server.ts` (если больше не используется — проверю).
7. **БД (миграция)**: `drop table public.email_campaign_recipients; drop table public.email_campaigns;` Suppression / unsubscribe-токены / send-log не трогаем — они общие для всей email-инфры.

## Что не меняется

- Меню «Маркетинг → Email-рассылки» остаётся, ведёт на ту же URL `/admin/campaigns`.
- Промокоды, заказы, письма по заказам, админ-нотификации — не трогаются.
- Канал отправки — Lovable Emails через уже верифицированный `notify.event-hub.by`. Никаких новых секретов и DNS-настроек не требуется.
