## Цель
1. Переработать дизайн КП, счёта и договора в едином стиле сайта (фирменный градиент-заголовок, типографика, лого, моно-номер).
2. Добавить страницу «Настройки документов» в админке, где можно один раз ввести юр. реквизиты, банк, подпись директора, текст оферты и параметры (предоплата, срок действия и т. д.) — без правок в коде.

## Что появится у пользователя

### Новая страница `/admin/settings/documents`
Раздел «Система» в сайдбаре. Карточки-вкладки:
- **Компания и бренд** — название юрлица, бренд, УНП, юр. адрес, телефон, e-mail, сайт, URL логотипа, акцентный цвет.
- **Банковские реквизиты** — наименование банка, БИК, расчётный счёт.
- **Подписант** — ФИО, должность, основание («действующего на основании Устава»).
- **Параметры КП** — срок действия (дней), произвольный текст футера, примечание об НДС.
- **Параметры счёта** — срок оплаты, текст футера.
- **Параметры договора** — % предоплаты, срок предоплаты, дней до мероприятия без возврата, % пени за просрочку, город юрисдикции.
- **Тело договора** — редактор разделов (заголовок + список абзацев), можно добавлять/удалять/менять порядок. По умолчанию загружаются текущие 5 разделов.

Сохранение через `notify.autosaved` (используем уже существующий хелпер из прошлого этапа), валидация Zod, поле «Предпросмотр» — кнопка открывает КП/счёт/договор по последнему заказу для проверки.

### Новый дизайн документов
- Шапка: тонкая полоса акцентного градиента сверху, слева — лого (если задано) + бренд, справа — мета-блок с моно-номером документа.
- Карточки сторон (исполнитель/заказчик) — лёгкая рамка, мягкий фон без фиолетовой заливки.
- Таблица — зебра, моно-цифры, sticky-итог.
- Подписи — две колонки с местом под подпись/печать.
- Подвал — мелкий текст из настроек.
- Печать (`@media print`) — без кнопки, корректные поля A4, hairline-разделители.
- Все цвета — из `accent_color` настроек (CSS-переменная `--accent`), без хардкода `#6d28d9`.

## Технические детали

### Миграция БД
Таблица `public.document_settings` — единственная строка с `singleton boolean primary key default true`:
- Колонки: `company_legal_name`, `company_brand`, `company_unp`, `company_address`, `company_phone`, `company_email`, `company_website`, `logo_url`, `accent_color` (default `#6d28d9`),
- `bank_name`, `bank_bic`, `bank_account`,
- `signer_name`, `signer_title`, `signer_basis`,
- `quote_validity_days int` default 14, `quote_footer text`, `vat_note text`,
- `invoice_validity_days int` default 5, `invoice_footer text`,
- `contract_prepayment_pct numeric` default 50, `contract_prepayment_days int` default 3, `contract_cancel_days int` default 7, `contract_late_fee_pct numeric` default 0.1, `contract_jurisdiction_city text` default 'Минск',
- `contract_sections jsonb` default = массив 5 текущих разделов,
- `updated_at`, `updated_by`.

GRANT: `authenticated SELECT/UPDATE`, `service_role ALL`. RLS: чтение `authenticated`, изменение только админам через `public.has_role(auth.uid(), 'admin')`. Триггер `touch_updated_at` + сидинг одной строки `INSERT ... ON CONFLICT DO NOTHING`.

### Серверные функции
Новый файл `src/lib/document-settings.functions.ts`:
- `getDocumentSettings` — публичная (для документов) и админская — через `requireSupabaseAuth`.
- `updateDocumentSettings` — `requireSupabaseAuth` + проверка `has_role('admin')`, валидация Zod.

### Рендер документов
Один общий хелпер `src/lib/documents/render.server.ts`:
- `renderDocumentShell({ title, settings, body })` — общая HEAD/CSS/header/footer.
- Подфункции `renderQuote(order, items, settings)`, `renderInvoice(...)`, `renderContract(...)`.

Существующие три роута (`admin.orders.$id.quote/invoice/contract.tsx`) переписать на использование общего шаблона + чтение настроек из БД. Если строки настроек нет — берётся встроенный дефолт.

### UI «Настройки документов»
- Файл `src/routes/admin.settings.documents.tsx` (+ обновить `AdminSidebar.tsx` — пункт «Документы» в группе «Система», иконка `FileCog`).
- Подкомпоненты в `src/components/admin/settings/`: `CompanySection`, `BankSection`, `SignerSection`, `QuoteSection`, `InvoiceSection`, `ContractParamsSection`, `ContractBodyEditor` (DnD-список разделов).
- Загрузка через `useSuspenseQuery`, сохранение `useMutation` → `updateDocumentSettings` с дебаунсом 800 мс и `notify.autosaved`.
- Кнопка «Открыть пример» рядом с каждой секцией — открывает соответствующий документ для последнего заказа.

### Безопасность
- Все правки настроек — только админ (`has_role`).
- Документы по-прежнему за `requireStaff`.
- Никаких секретов в реквизитах — только публичные данные юрлица.

### Вне scope
- PDF-генерация на сервере (остаётся print-to-PDF браузера).
- Загрузка логотипа в Storage (пока только URL; можно расширить позже).
- Версионирование шаблонов договора.

## Порядок выполнения
1. Миграция `document_settings` + сидинг дефолтов.
2. Серверные функции `get/updateDocumentSettings`.
3. Общий рендер-хелпер + переписанные quote/invoice/contract в новом стиле.
4. Страница `/admin/settings/documents` + пункт в сайдбаре.
5. Smoke-test через Playwright: открыть документы, изменить настройки, перепроверить отображение.
