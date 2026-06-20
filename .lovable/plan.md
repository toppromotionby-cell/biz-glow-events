## Что меняем в разделе «Контент → Наполнение»

### 1. Сайдбар: разворачиваем подразделы
В `AdminSidebar.tsx` группа «Контент» вместо одной строки «Наполнение» получает 4 подссылки:
Зоны (Package) · Оборудование (Wrench) · Услуги (Sparkles) · Производство (Factory). Плюс «Кейсы», «Отзывы», «Блог».

### 2. Убираем верхние табы каталога
`admin.catalog.tsx` становится тонкой обёрткой с `<Outlet />` — навигация переехала в сайдбар.

### 3. Список (`admin.catalog.$type.tsx`)
- Удаляем состояние `preview` и панель превью. Клик по карточке открывает редактор сразу.
- Шапка: убираем подсказку «клик по записи открывает подробный просмотр» — оставляем «N записей».
- Поиск, чекбокс «Выбрать все» и счётчик находок — в одну строку.

### 4. Редактор (`CatalogEditor.tsx`)
- **Collapsible-секции**: «Основное» (Заголовок, Категория, Цены, Краткое/Полное описание, Медиа) — раскрыто; «Доп. поля» (Требования, Фичи, Доп. услуги) и «SEO и URL» (Slug, SEO title/description) — свернуты.
- **Автосейв**: debounce 1.2 с пишет в БД, индикатор статуса через существующий `SaveStatus` (`saving`/`saved`/`dirty`/`error`). Кнопку «Сохранить» убираем.
- **Kebab-меню** в шапке: «Открыть на сайте ↗» (по типу → `/zones/$slug`, `/equipment/$slug`, `/services/$slug`, `/production/$slug`), «Дублировать», «Переместить в → …», «Удалить». Постоянный `Select` переноса убираем.
- **Авто-slug** через существующий `slugify(title)` — только если slug пустой или начинается с `new-` (созданный по умолчанию). Ручное редактирование slug — внутри секции SEO.

### 5. Карточка списка (`CatalogListItem.tsx`)
Клик по карточке = редактирование. Убираем `onPreview` и кнопку-«карандаш» (избыточны), оставляем «Дублировать».

### 6. Удаляем
`src/components/admin/catalog/PreviewPanel.tsx` — больше не используется.

### Файлы
- edit: `src/components/admin/AdminSidebar.tsx`
- edit: `src/routes/admin.catalog.tsx`
- edit: `src/routes/admin.catalog.$type.tsx`
- rewrite: `src/components/admin/catalog/CatalogEditor.tsx`
- edit: `src/components/admin/catalog/CatalogListItem.tsx`
- delete: `src/components/admin/catalog/PreviewPanel.tsx`

Публичная часть и схема БД не меняются.