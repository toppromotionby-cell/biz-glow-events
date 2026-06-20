
# Раздел «Почта» в админке

Полнофункциональный почтовый клиент в админке (`/admin/mail`) с подключением сторонних ящиков по IMAP/SMTP, синхронизацией писем в Lovable Cloud и интерфейсом в стиле Outlook, выдержанным в дизайне сайта.

## Важное техническое замечание (нужно подтвердить)

Серверный рантайм проекта — Cloudflare Workers. Он **не поддерживает прямые TCP-подключения** к произвольным IMAP/SMTP-серверам (порты 993/465/587) из стандартных Node-библиотек (`imapflow`, `nodemailer`). Чтобы реализовать IMAP/SMTP, есть два пути:

- **A. Внешний воркер на Node** (Render/Fly/Railway, бесплатный тариф) — отдельный микросервис, который держит IMAP-соединения и шлёт SMTP. Админка ходит к нему по HTTPS. Это правильный production-вариант.
- **B. Сторонний email-API** (например, Nylas / Mailtrap Inbox API) — единый REST для любых ящиков, без своего сервера. Платный после free-tier.

Я предлагаю **вариант A** с минимальным Node-сервисом на `imapflow + nodemailer`, секреты которого вы передадите через `add_secret`. Если предпочитаете B — скажите, перепланирую.

Дальнейший план описывает фронтенд + БД + интеграцию с этим внешним воркером.

## Что будет в админке

Маршрут `/admin/mail` (доступен всем авторизованным пользователям, как вы выбрали), трёхпанельный layout как в Outlook:

```text
┌──────────┬───────────────┬─────────────────────┐
│ Ящики +  │ Список писем  │ Просмотр / редактор │
│ Папки    │ (виртуальный  │ письма              │
│          │  скролл)      │                     │
└──────────┴───────────────┴─────────────────────┘
```

Функции:
- **Подключение ящика**: модалка с пресетами (Gmail, Yandex, Mail.ru, custom) — авто-подстановка серверов/портов; поля: email, пароль приложения, IMAP host/port/SSL, SMTP host/port/SSL. Проверка соединения перед сохранением.
- **Несколько ящиков** одновременно, переключение в сайдбаре.
- **Папки**: Входящие, Отправленные, Черновики, Спам, Корзина + произвольные IMAP-папки.
- **Метки/флаги**: прочитано/непрочитано, флаг важности, перемещение между папками.
- **Поиск**: по теме/отправителю/телу (full-text по БД).
- **Просмотр**: HTML-письма в sandbox `<iframe srcdoc>` (без скриптов), вложения скачиваются из Lovable Storage.
- **Composer**: тема, кому/копия/скрытая, тело (rich-text), вложения, ответить/ответить всем/переслать с цитированием.
- **Черновики**: автосохранение каждые 5 сек.
- **Правила/фильтры**: простые «если From содержит … → переместить в папку Х».

## Хранение в Lovable Cloud

Новые таблицы (миграция):

- `mail_accounts` — `id, owner_id, email, display_name, imap_host, imap_port, imap_secure, smtp_host, smtp_port, smtp_secure, username, password_encrypted, last_sync_at, sync_status, sync_error`. Пароли шифруются AES-GCM ключом из секрета `MAIL_ENC_KEY`.
- `mail_folders` — `id, account_id, name, path, kind (inbox/sent/drafts/spam/trash/custom), unread_count, total_count`.
- `mail_messages` — `id, account_id, folder_id, uid (IMAP UID), message_id, thread_id, from_addr, from_name, to_addrs jsonb, cc_addrs jsonb, bcc_addrs jsonb, subject, snippet, body_text, body_html, sent_at, received_at, seen, flagged, has_attachments, size_bytes, raw_headers jsonb`. Индексы: `(folder_id, received_at desc)`, GIN на `to_tsvector('simple', subject || ' ' || coalesce(body_text,''))`.
- `mail_attachments` — `id, message_id, filename, mime_type, size_bytes, storage_path`. Файлы в bucket `mail-attachments` (private).
- `mail_drafts` — `id, account_id, owner_id, subject, to_addrs, cc_addrs, bcc_addrs, body_html, in_reply_to, attachments jsonb, updated_at`.
- `mail_rules` — `id, account_id, name, conditions jsonb, action jsonb, enabled`.

RLS: все таблицы доступны любому пользователю с ролью из `user_roles` (вы выбрали «все пользователи» — уточните, должно ли это быть `authenticated` или конкретная роль). GRANTы на `authenticated` и `service_role`.

## Синхронизация

- При подключении ящика — серверная функция `syncAccount({accountId})` зовёт внешний воркер: тот логинится по IMAP, скачивает заголовки/тела/вложения, складывает в БД через service-role.
- Дальше — pg_cron каждые 2 минуты дёргает `/api/public/mail/sync-tick` (HMAC-подпись), который последовательно синхронит активные аккаунты дельтой по `UIDNEXT`/`MODSEQ`.
- IDLE (push) не делаем в MVP — слишком сложно для serverless.

## Отправка

- Серверная функция `sendMessage({accountId, draft})` → POST на внешний воркер → nodemailer SMTP → копия письма кладётся в IMAP-папку Sent → запись в `mail_messages`.

## Дизайн

Использую существующие токены сайта (semantic colors из `src/index.css`, shadcn-компоненты, шрифты проекта). Layout как Outlook Web: лево — навигация ящиков/папок (collapsible), центр — список писем с превью (плотный/комфортный режим), право — открытое письмо. Адаптив: на мобиле — три отдельных экрана со стрелкой «назад».

## Файлы и шаги

1. Миграция: 6 новых таблиц + GRANT + RLS + индексы.
2. `add_secret`: `MAIL_ENC_KEY`, `MAIL_WORKER_URL`, `MAIL_WORKER_SECRET` (после вашего подтверждения варианта A).
3. Server fns в `src/lib/mail.functions.ts`: `listAccounts`, `addAccount`, `deleteAccount`, `testConnection`, `listFolders`, `listMessages`, `getMessage`, `markSeen`, `moveMessage`, `deleteMessage`, `saveDraft`, `sendMessage`, `searchMessages`, `syncAccount`.
4. Публичный роут `src/routes/api/public/mail/sync-tick.ts` (HMAC).
5. Страницы:
   - `src/routes/_authenticated/admin/mail.tsx` (layout)
   - `mail.index.tsx`, `mail.$accountId.$folderPath.tsx`, `mail.$accountId.$folderPath.$messageId.tsx`, `mail.compose.tsx`.
6. Компоненты: `MailSidebar`, `MessageList`, `MessageView`, `Composer`, `AddAccountDialog`, `AttachmentPicker`, `RuleEditor`.
7. Пункт «Почта» в `AdminSidebar`.
8. Шаблон внешнего воркера — отдельный мини-проект (`mail-worker/`), README с инструкцией по деплою на Render/Fly. Этот код вне основного приложения, я подготовлю файлы, вы развернёте по инструкции.

## Что мне нужно от вас перед началом

1. Подтвердите вариант **A** (свой Node-воркер) или **B** (Nylas/Mailtrap API).
2. Уточните «все пользователи» — это любые залогиненные, или конкретная роль (admin/manager)? Сейчас понимаю как `authenticated`.
3. Любые ограничения по лимитам (макс. размер письма, хранение N дней)?
