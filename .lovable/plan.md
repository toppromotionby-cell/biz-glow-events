# Раздел «Шаблоны писем» в админке

## Где

В сайдбаре **Система** → новый пункт **«Шаблоны писем»** → роут `/admin/settings/emails`.
Доступ — только роли `admin`/`manager` (как в `admin.settings.*`).

## Какие письма попадают в редактор

Три категории в одном списке, с фильтром-табами:

1. **Транзакционные (сайт)** — то, что уже в `src/lib/email-templates/registry.ts`: `admin-order`, `admin-lead`, `client-invite`.
2. **Auth-письма** — `signup`, `magic-link`, `recovery`, `invite`, `email-change`, `reauthentication` (уже есть как React Email в `src/lib/email-templates/`).
3. **Статусы заказа** — добавляем 4 новых шаблона: `order-confirmed`, `order-paid`, `order-completed`, `order-cancelled`. Триггер — функция БД `log_order_status_change` уже фиксирует смену статуса; добавим server fn, который при изменении `orders.status` шлёт письмо клиенту.

## Что именно можно редактировать (полный HTML)

Для каждого шаблона:

- **Тема письма** (`subject`) — с поддержкой `{{переменных}}`.
- **Preheader** (короткий текст-превью в инбоксе).
- **HTML-тело письма** — полнофункциональный редактор кода (CodeMirror с подсветкой HTML). Внутри — Mustache-подобные плейсхолдеры: `{{clientName}}`, `{{orderId}}`, `{{total}}`, `{{actionUrl}}` и т.д.
- **Флаг «Включено»** — если выключено, используется встроенный React-шаблон по умолчанию (страховка от поломки).
- **Кнопка «Сбросить к шаблону по умолчанию»** — выкидывает override и возвращает дефолт из кода.

Жёстко не редактируется (закладывается в код, чтобы не сломать доставку):
- Технические headers, `Body backgroundColor: #ffffff`, футер с unsubscribe (его дописывает инфраструктура Lovable Emails автоматически).

## База данных

Новая таблица `email_templates`:

```text
template_key      text  PK    -- 'admin-order', 'signup', 'order-paid', …
category          text         -- 'transactional' | 'auth' | 'order-status'
subject           text
preheader         text
html_body         text         -- с {{placeholders}}
enabled           boolean      -- default true
updated_by        uuid → auth.users
updated_at        timestamptz
```

RLS: read/write только для `has_role(auth.uid(),'admin')` и `'manager'`; `GRANT` на `authenticated` и `service_role`. Серверные функции отправки читают через `supabaseAdmin` (RLS bypass), потому что письма уходят и для гостей (auth signup, admin notifications).

История версий и аудит — **не делаем** (вы не выбрали этот пункт). Базовый audit-log уже пишется триггером `write_audit_log` — его подключим к новой таблице, и кто/когда менял будет видно в существующем `/admin/audit`.

## Рендеринг и подстановка переменных

Новый helper `src/lib/email-templates/render-with-override.ts`:

1. Берёт `template_key` и `data`.
2. Если в `email_templates` есть row и `enabled=true` — берёт `subject`/`html_body` оттуда, прогоняет Mustache-подстановку (`{{name}}` → `escapeHtml(data.name)`), затем санитизирует через DOMPurify (server-side, `isomorphic-dompurify`) — снимает `<script>`, `on*=`, `javascript:`-ссылки.
3. Иначе — рендерит существующий React Email компонент из `registry.ts` (текущее поведение).

Точки интеграции:
- `src/routes/lovable/email/transactional/send.ts` — заменить прямой `render(component)` на `renderWithOverride(name, data)`.
- `src/routes/lovable/email/auth/webhook.ts` — аналогично для auth-шаблонов.
- Новая server fn `notifyOrderStatus(orderId, status)` — вызывается из существующих server fn обновления заказа (`src/lib/orders.functions.ts`), шлёт письмо клиенту через `/lovable/email/transactional/send`.

## UI редактора

Страница `/admin/settings/emails`:

```text
┌──────────────────────────┬──────────────────────────────────────────┐
│ Список шаблонов          │ Редактор выбранного шаблона              │
│  [Все] [Сайт] [Auth] [Статусы]                                       │
│  ▸ Новый заказ           │ Категория · Ключ · [Сбросить] [Тест]     │
│  ▸ Новая заявка          │ ─────────────────────────────────────    │
│  ▸ Приглашение в кабинет │ Тема: [____________________________]     │
│  ▸ Подтверждение оплаты  │ Preheader: [_______________________]     │
│  ▸ Регистрация (auth)    │                                          │
│  …                       │ ┌─ Код HTML ────────┬─ Превью ─────────┐ │
│                          │ │ <Html>            │ [iframe srcDoc]  │ │
│                          │ │   ...{{name}}...  │                  │ │
│                          │ └───────────────────┴──────────────────┘ │
│                          │ Доступные переменные:                    │
│                          │  {{clientName}} — имя клиента            │
│                          │  {{orderId}} — ID заказа                 │
│                          │  …                                       │
│                          │ [Сохранить]   [Отмена]                   │
└──────────────────────────┴──────────────────────────────────────────┘
```

- **Live-превью** — iframe c `srcDoc`, дебаунс 300 мс, рендерит результат подстановки `previewData` (берём из React-шаблона) в текущий HTML.
- **Тест-отправка** — модалка «Отправить тест на email», POST в `/lovable/email/transactional/send` с `templateName` + `previewData` + указанным адресом + флагом `useDraft=true` (тогда send использует ещё не сохранённую черновую версию из тела запроса). Результат в toast + строкой статуса.
- **Список переменных** — берётся из `previewData` соответствующего шаблона + статический справочник (описания), показывается прямо под редактором, клик копирует `{{key}}` в буфер.

## Безопасность HTML-редактора

- Серверная санитизация (`isomorphic-dompurify`) на каждом рендере, не только при сохранении.
- Перед сохранением — Zod-валидация: `subject` 1–200 символов, `html_body` ≤ 200 KB, обязательно валидный HTML (parse через `parse5`, ошибки показываем в редакторе).
- Запрет `<script>`, `<iframe>`, `on*` атрибутов, `javascript:` URL — DOMPurify конфиг.
- Все `{{var}}` экранируются как текст (HTML-entities) — нельзя вставить XSS через данные заказа.
- При ошибке рендера фолбэк на дефолтный React-шаблон + лог в `email_send_log.error_message`.

## Что меняется в коде

Новые файлы:
- `supabase/migrations/<ts>_email_templates.sql` — таблица, RLS, GRANT, audit-триггер.
- `src/lib/email-templates/render-with-override.ts` — рендер с подстановкой и санитизацией.
- `src/lib/email-templates/order-confirmed.tsx`, `order-paid.tsx`, `order-completed.tsx`, `order-cancelled.tsx` — дефолты + регистрация в `registry.ts`.
- `src/lib/email-templates.functions.ts` — server fn: `listEmailTemplates`, `getEmailTemplate(key)`, `saveEmailTemplate(...)`, `resetEmailTemplate(key)`, `previewEmailTemplate(key, draftSubject, draftHtml)`, `sendTestEmail(key, recipient, draftSubject?, draftHtml?)` — все с `requireSupabaseAuth` + проверкой `has_role admin/manager`.
- `src/routes/admin.settings.emails.tsx` — UI (список + редактор + iframe-превью).
- `src/lib/order-notifications.functions.ts` — `notifyOrderStatus`.

Правки:
- `src/lib/email-templates/registry.ts` — добавить 4 новых шаблона, добавить поле `variables: Record<string,string>` (описания переменных для UI).
- `src/routes/lovable/email/transactional/send.ts` и `src/routes/lovable/email/auth/webhook.ts` — использовать `renderWithOverride`.
- `src/components/admin/AdminSidebar.tsx` — пункт «Шаблоны писем» в группе «Система».
- `src/routes/admin.tsx` — крошка для `/admin/settings/emails`.
- `src/lib/orders.functions.ts` — вызов `notifyOrderStatus` при смене `status`.
- `package.json` — `isomorphic-dompurify`, `parse5`, `@uiw/react-codemirror` + `@codemirror/lang-html`.

## Проверка

1. Открываем `/admin/settings/emails`, видим список из 13 шаблонов (3 + 6 + 4) с табами.
2. Редактируем `admin-order`: меняем тему и текст → live-превью обновляется → тест-отправка приходит на свой адрес с новым контентом.
3. «Сбросить к дефолту» → строка удаляется → следующий рендер берёт React-шаблон.
4. Смена статуса заказа в `/admin/orders/:id` на «paid» → в `email_send_log` появляется запись `order-paid`, клиенту приходит письмо.
5. Изменения шаблона видны в `/admin/audit` (через существующий триггер `write_audit_log`).
