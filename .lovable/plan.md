## Цель

Поднять скорость первой загрузки (LCP) и сократить размер фронтенд‑бандла, попутно вычистив дублирующий и мёртвый код. Поведение и вёрстка сохраняются.

## Что будет сделано

### 1. Ускорение LCP главной страницы

- Заменить рендер‑блокирующую загрузку Google Fonts на неблокирующую (`preload` + `media=print/onload` swap), добавить `font-display: swap` через query.
- Добавить `preload` для og/hero‑картинки только на главной (через `head().links` в `src/routes/index.tsx`), `fetchpriority="high"`.
- Подготовить WebP/AVIF варианты тяжёлых картинок: `og-default.jpg` (112 КБ) и иконки `icon-512/icon-maskable-512` (84 КБ) — пересжать без потери качества.
- Убрать из дерева `__root.tsx` всё, что не нужно при первом пэйнте, и подключить с задержкой: `EffectsLayer`, `FloatingContacts`, `ExitIntentModal`, `CookieConsent`, `ScriptInjector`, `CartSync`, `AutoBreadcrumbs` — обернуть в динамический импорт после `requestIdleCallback`/первого взаимодействия. Header/Footer и `<Outlet />` остаются синхронными.
- В `DynamicToaster` заменить `MutationObserver` на подписку на `matchMedia('(prefers-color-scheme: ...)')` + событие смены темы — без наблюдения за DOM.

### 2. Сокращение бандла

- Ленивая загрузка тяжёлых модалок на главной (`src/routes/index.tsx`): `CatalogQuickView`, `CatalogChoiceModal`, `LeadForm`, `GuestEstimator`, `TestimonialsTeaser` — через `lazy()` + `Suspense`.
- Проверить, что `recharts` и `@fullcalendar/*` тянутся только в админ‑роуты (они на отдельных файлах роутов — авто‑сплит TanStack их выделит). Где есть случайный импорт `@/components/ui/chart` из публичных файлов — убрать.
- Убрать неиспользуемое: `CartRecoveryBanner` (только в комментариях в `__root.tsx`), проверить `SupportChat` (внутри `FloatingContacts` уже включён, оставить один источник).
- Чистка лишних `useEffect`/слушателей в `EffectsLayer`: убрать `setInterval(observe, 1500)` — заменить на одноразовый `MutationObserver` с дебаунсом; убрать ручное переключение `style.overflow` и `style.position` (вынести в CSS‑класс).
- Удалить неиспользуемые импорты и компоненты, найденные точечной чисткой (после ESLint/ts‑скана).
- Проверить `src/styles.css` (941 строка) на неиспользуемые селекторы и удалить мёртвые правила.

### 3. Серверный/данные слой (минимально, чтобы не сломать поведение)

- Удостовериться, что `homeQueryOptions` имеет адекватный `staleTime` (60 с уже стоит — оставить) и не дёргает повторно при навигации.
- В `__root.tsx` оставить `preconnect`/`dns-prefetch` к Supabase только если первый запрос идёт с клиента; для SSR‑роутов оставить как есть.

### 4. Чек‑лист валидации

- Собрать прод‑бандл, замерить размер (`dist/` сравнить до/после).
- Снять `browser--performance_profile` главной до/после (LCP, JS heap, long tasks).
- Пройти все ключевые сценарии: главная, каталог, карточка, корзина, профиль, админка — визуально и без ошибок в консоли.

## Что НЕ меняем

- Бизнес‑логику, RLS, миграции БД, API серверных функций.
- Дизайн‑систему, токены, вёрстку.
- Структуру роутов и URL.

## Техническая сводка (для разработчика)

```
src/routes/__root.tsx        — defer-mount второстепенных глобалов, заменить
                               рендер-блокирующий Google Fonts на preload+swap
src/routes/index.tsx         — lazy() для модалок, preload LCP-картинки в head()
src/components/EffectsLayer  — убрать setInterval, упростить ripple
src/components/CartRecoveryBanner.tsx — удалить (не используется)
src/styles.css               — удалить неиспользуемые селекторы
public/og-default.jpg        — пересжать + добавить .webp
public/icon-512.png, icon-maskable-512.png — пересжать
```

Ожидаемый эффект: JS‑бандл главной −20…35%, LCP −0.3…0.8 с на 4G‑профиле, меньше long tasks за счёт убранного `setInterval` и `MutationObserver` в Toaster.
