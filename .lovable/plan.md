## Этап 1. Аудит — что есть сейчас

**Маршруты раздела «Наполнение»** (под `/admin`, гейт по ролям admin/manager/marketer/content_editor в `src/routes/admin.tsx`):

| Маршрут | Файл | LOC | Сущность |
|---|---|---|---|
| `/admin/catalog` | `admin.catalog.tsx` | 78 | Layout (4 вкладки, счётчики) |
| `/admin/catalog/$type` | `admin.catalog.$type.tsx` | 660 | CRUD zones/tech_equipment/services/production_items |
| `/admin/blog` | `admin.blog.tsx` | 186 | Статьи |
| `/admin/cases` | `admin.cases.tsx` | 196 | Кейсы |
| `/admin/testimonials` | `admin.testimonials.tsx` | 154 | Отзывы |

**Общие компоненты:** `AdminPageHeader`, `AdminListPanel`, `AdminEditorShell`, `AdminTable`, `Field`, `StatusPill`, `SortableList`, `CategoryCombobox`, `FeaturesEditor`, `ExtrasEditor`, `UniversalMediaUploader`, `PriceTableEditor`, `AdminCommandPalette`. Состояние — TanStack Query + локальный `useState`. Уведомления — `sonner`. Доступ — `useAuth` + `useRoles`. БД — прямой `supabase` клиент из браузера (RLS).

**Таблица находок (по приоритету):**

| # | Компонент | Баг / риск | Крит. | Решение |
|---|---|---|---|---|
| 1 | `admin.blog.tsx` (`save`) | Сохранение пустого `slug` падает в БД, нет проверки уникальности, slug не пересчитывается при правке заголовка после первого ввода. `confirm()` для удаления — нативный, не a11y | H | RHF + Zod, проверка уникальности через `.select('id').eq('slug', …).maybeSingle()` с debounce 400 мс, замена `confirm` на `AlertDialog` |
| 2 | `admin.blog.tsx` | Нет `useQuery` — каждый `load()` — гонка с `setEditing`. После save модалка может закрыться, но список ещё не обновлён | H | Переезд на `useQuery`/`useMutation` как в cases/testimonials |
| 3 | `admin.cases.tsx` Editor | `metrics` валится в `toast.error` если JSON битый, но пользователь видит только тост — нет подсветки поля. `services_used` парсится только при save (нет валидации формата) | M | Подсветка поля + ошибка под textarea; перенос на RHF |
| 4 | Все формы | Нет RHF+Zod, нет валидации `onBlur`/`onChange`, нет счётчиков символов (slug 80, seo_title 60, seo_description 160) | M | Единый `useFormWithSchema(zodSchema)` hook, `<FieldHint>` с лимитами |
| 5 | Все формы | Нет автосохранения черновика (localStorage) | M | `useAutoSaveDraft(key, values, 1500)` — сохраняет в `localStorage`, при открытии того же id предлагает восстановить |
| 6 | `admin.catalog.$type.tsx` | `any` повсеместно, `eslint-disable` 6 раз. Типобезопасность нулевая | M | Сгенерировать тип из `Database["public"]["Tables"][T]["Row"]`, дискриминированный union по `table` |
| 7 | `admin.catalog.$type.tsx` Editor | `cover_url` рассчитывается дважды (в форме и при save) — рассинхрон при пустой строке | L | Единая функция `computeCover(form)` |
| 8 | `admin.blog.tsx` Editor (Textarea body) | Plain textarea для тела статьи. Markdown/HTML — на усмотрение редактора, без preview | M | Tiptap (опционально, см. ниже) или хотя бы Markdown preview |
| 9 | Все списки | Нет пагинации/виртуализации. Сейчас при >200 записях рендер тормозит | M | `@tanstack/react-virtual` на `AdminListPanel`, серверная пагинация для блога/кейсов от 100+ |
| 10 | Все формы | Нет sticky-панели «Сохранено / Сохраняю… / Ошибка» — индикатор только в кнопке | L | `<SaveStatus state="saved|saving|dirty|error" />` в `AdminEditorShell` |
| 11 | UniversalMediaUploader | Нет client-side компрессии, нет проверки разрешения/типа до отправки на сервер | M | Подключить `browser-image-compression`, валидация MIME + max 10 MB, preview thumbnails |
| 12 | Все формы | Нет генерации SEO description из первого абзаца | L | Кнопка «Сгенерировать» в SEO-блоке (берёт первые 155 симв. `excerpt`/`summary`/`description`) |
| 13 | Все формы | Нет hotkeys (Cmd/Ctrl+S, Esc) | L | `useHotkeys` через существующий `AdminCommandPalette` или новый `useEditorHotkeys` |
| 14 | Все формы | Нет contextual help (tooltip «?») у неочевидных полей (slug, sort_order, featured, metrics JSON) | M | Добавить `hint`/`tooltip` пропс в `Field` + `<HelpTip>` |
| 15 | Все списки | Нет «empty state» с иллюстрацией и CTA — только текст. (Частично есть в catalog через `emptyAction`) | L | Унифицировать `<EmptyState icon, title, description, action>` |
| 16 | XSS | `excerpt`, `body`, `description` рендерятся как plain text (не `dangerouslySetInnerHTML`) — XSS-риска **нет** в админке. На публичных страницах проверить отдельно | OK | — |
| 17 | A11y | `onClick` на `div` с `role=button` и keydown — OK; иконки-кнопки имеют `aria-label`. Нет skip-link, focus-visible покрыт. Заголовки h1 ок | L | Добавить `<main>` landmark (сейчас есть), оставить как есть |
| 18 | Race conditions | Двойной клик «Сохранить» не блокируется в blog (нет `useMutation`). В cases/testimonials блокируется | M | См. #2 |
| 19 | Onboarding | Отсутствует | L | Отдельная задача; в этот рефакторинг включать опционально |
| 20 | Unit tests | Отсутствуют для slug/валидации/автосохранения | M | Vitest: `slugify`, `zodSchema.parse`, `useAutoSaveDraft` |

**Что НЕ войдёт в этот рефакторинг (вне разумного scope, предлагаю как отдельные задачи):**
- driver.js / intro.js onboarding-туры — отдельная фича на 4-6 часов
- Полноценный Tiptap WYSIWYG с Markdown-переключением и таблицами — отдельная задача (~6 часов; сейчас Markdown preview хватит)
- Undo/Redo для 20 действий через паттерн event-sourcing
- Offline queue с retry (Service Worker)
- Проверка битых ссылок в контенте (нужен фоновый job)
- Полный Lighthouse > 90 с прогонами CI и LCP/FID/CLS таргетами для админки — админка noindex, оптимизация перформанса оправдана только при реальной деградации
- Сборка `audit_log` для UI (запись в БД уже идёт через `audit_log` таблицу) — отдельный UI на этап

---

## Этап 2-5. План работ (4 фазы, каждая отдельный заход)

### Фаза A — Безопасность и стабильность форм (H+M)

- `src/lib/admin/schemas.ts` — Zod-схемы для blog/cases/testimonials/catalog (slug regex, длины, обязательные)
- `src/lib/admin/use-form-with-schema.ts` — RHF + zodResolver обёртка, `dirty/saving/saved/error` статус
- `src/lib/admin/use-slug-unique.ts` — debounce-проверка уникальности slug через supabase
- `src/lib/admin/use-autosave-draft.ts` — localStorage, debounce 1500 мс, восстановление при reopen
- Перевод `admin.blog.tsx` на `useQuery` + `useMutation` (фикс #1, #2, #18)
- Замена `confirm()` на `AlertDialog` во всех админках
- В `Field` добавить `hint`, `tooltip`, `error`, `counter` пропсы — единый шаблон вывода ошибок и счётчиков

### Фаза B — UX/UI: layout, навигация, help-система (Этап 3 + 4)

- `AdminCatalogLayout` (`admin.catalog.tsx`) и каждый раздел получают единый header: **Breadcrumbs** (есть в `admin.tsx`, расширить до 2-3 уровней) → **Action bar** (Поиск / Фильтры / + Создать) → контент → пагинация
- Sticky action bar внизу в `AdminEditorShell`: `[Черновик] [Предпросмотр] [Опубликовать]`
- `<HelpTip text="…" link="…" />` рядом со slug, sort_order, featured, published_at, metrics JSON, pricing tiers, SEO-полями
- `<EmptyState>` компонент + единая иллюстрация
- Hotkeys: Cmd/Ctrl+S сохранить, Esc закрыть превью/редактор, Cmd/Ctrl+N — создать (через CommandPalette)

### Фаза C — Real-time валидация, медиа, автоматизация (Этап 5)

- Live-валидация в `useFormWithSchema` (onBlur + onChange debounce 300 мс), подсветка `border-destructive`, сообщение под полем
- `UniversalMediaUploader`: добавить `browser-image-compression` (target 1600px / 200 KB), drag&drop уже есть, проверка MIME/size на клиенте, прогресс-бар
- SEO-блок: кнопка «Сгенерировать description» (slice первого абзаца до 155 симв.)
- `SaveStatus` индикатор в `AdminEditorShell`: dirty → «Изменения не сохранены», saving → «Сохраняю…», saved → «Сохранено · 12:34», error → красный + retry
- `useAutoSaveDraft` интеграция во все 4 редактора (blog/cases/testimonials/catalog)
- Серверная пагинация для блога (limit 50) и виртуализация списков от 100 элементов

### Фаза D — Тесты, типы, чистка (Этап 6)

- Vitest: `slugify`, `zodSchema.safeParse` на корректных/невалидных кейсах, `useAutoSaveDraft` сохраняет/восстанавливает
- Удалить `any` в `admin.catalog.$type.tsx`, использовать `Database["public"]["Tables"][T]["Row"]` + дискриминированный union
- Прогон `bun run build` + проверка console.error/warn в Playwright по 4 страницам админки на 320/768/1024/1440 px
- Самопроверка по чек-листу Этапа 6 — отчёт в чате

---

## Технические решения

- TypeScript strict — без `any` в новом коде
- Формы: `react-hook-form` + `zod` + `@hookform/resolvers` (все три уже есть в проекте)
- Состояние: TanStack Query для серверного, локальный `useState` для UI — Zustand не нужен (нет глобального админ-стейта)
- Таблицы: оставляем текущий `AdminListPanel` + `SortableList`, виртуализация через `@tanstack/react-virtual` (новая зависимость) только в Фазе C при необходимости
- Медиа: `browser-image-compression` — новая зависимость в Фазе C
- WYSIWYG: **не подключаю** Tiptap в этот рефакторинг — Markdown preview достаточен; если нужен полноценный редактор, заведу отдельной задачей
- Onboarding: **не подключаю** driver.js — отдельная задача

## Порядок исполнения

Предлагаю стартовать с **Фазы A** (безопасность форм + стабильность blog). После апрува плана:
1. Делаю Фазу A → показываю diff → жду «ок»
2. Фаза B → diff → «ок»
3. Фаза C → diff → «ок»
4. Фаза D → финальный отчёт по чек-листу

Каждая фаза самодостаточна и не ломает соседние разделы. Если хочется быстрее — можно объединить A+B и C+D, но риск регрессий растёт.

## Вопросы

1. **WYSIWYG для тела статьи блога** — нужен Tiptap сейчас (добавит ~150 KB, отдельный этап +4-6 часов), или достаточно Markdown с preview?
2. **Onboarding-тур (driver.js)** — включать или отложить?
3. **Серверная пагинация** — у вас сейчас сколько максимум записей в blog/cases? Если <100 — виртуализация и пагинация лишние.
4. **Старт** — иду по Фазе A, или хочется сначала точечно что-то критичное (например, только фикс blog save)?
