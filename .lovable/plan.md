
## Что замерил

Снял профиль текущего preview (мобильный viewport 623×362) и просмотрел код главной/Hero/`DeferredGlobals`/`vite.config`. Цифры из preview — это dev-режим (без минификации, без бандлинга, с `@react-refresh`), поэтому абсолютные значения завышены. Но узкие места видны и в проде.

**Реальные снимки:**
- FCP/FP: ~2964 мс
- TTFB: 1240 мс, DOMContentLoaded: 2887 мс
- Render-blocking: `src/styles.css` (25 КБ, 877 мс), `@tanstack-start/styles.css` (554 мс)
- Самый тяжёлый ресурс: **`/hero-bg.jpg` — 253 КБ, 1129 мс** (один и тот же файл 1920×1080 уходит и на мобилку, и на десктоп)
- DOM: 892 ноды, depth 15 — нормально
- JS heap: 2.5–3.1 МБ, Task Duration 262 мс — нормально

## Что хорошо уже сделано (не трогаем)
- Hero `<img>` с `fetchPriority="high"`, `loading="eager"`, явными width/height — CLS под контролем
- Тяжёлые модалки/виджеты лениво (`CatalogChoiceModal`, `CatalogQuickView`, `LeadForm`, `GuestEstimator`, `TestimonialsTeaser`)
- `DeferredGlobals` откладывает `EffectsLayer`, `FloatingContacts`, `CookieConsent`, `ScriptInjector`, `CartSync` до `requestIdleCallback`
- Google Fonts: `display=swap` + preconnect
- TanStack Query с loader prefetch — без waterfall'ов

## План оптимизаций (по убыванию эффекта)

### 1. Hero-картинка — главная точка боли (LCP на мобильных)
- Сгенерировать AVIF + WebP варианты `hero-bg.jpg` через `imagegen`/`sharp`, плюс мобильный размер ~828px шириной.
- Заменить `<img src>` на `<picture>` с `<source type="image/avif">` + `<source type="image/webp">` + `srcset`/`sizes` (mobile 828w, desktop 1920w).
- Ожидаемый эффект: 253 КБ → ~50 КБ на мобиле, LCP −600–900 мс.
- Обновить `<link rel="preload">` в `__root.tsx`/route head на нужный формат через `imagesrcset`/`imagesizes`, чтобы preload совпал с выбранным `<source>`.

### 2. Мобильный hero высотой `min-h-[92vh]`
- На мобильном устройстве 92vh — это огромный «пустой» экран и поощряет браузер рендерить весь блюр/градиенты до контента ниже.
- Сделать `min-h-[88svh] md:min-h-[92vh]` (`svh` корректно учитывает мобильный UI) и убрать декоративные `blur-[100px]/blur-[80px]` пятна на мобилке (`hidden md:block`). Большие `filter: blur` — дорогой compositing на слабых GPU.

### 3. Уменьшить render-blocking CSS
- `src/styles.css` 25 КБ + tanstack-css. В проде они минифицируются и кэшируются, но всё равно блокируют рендер. Проверить, что в `src/styles.css` нет неиспользуемых `@import` и большого блока кастомных utility (Tailwind v4 уже tree-shake'ит). Если есть тяжёлые `@keyframes`/большие custom-properties только для админки — вынести их в `admin.tsx` head.

### 4. Lucide-иконки бьют по бандлу
- В `index.tsx` импортируется 9 иконок из `lucide-react`; в `HeroSection` ещё 5. По всему сайту — сотни. Lucide через named import обычно tree-shake'ится корректно, но стоит подтвердить, что в проде нет полного `lucide-react/dist/esm/icons/index.js` (быстрый аудит через `vite build --debug`).
- При желании заменить на `lucide-react/icons/<name>` (или `@lucide/lab`) для гарантированного per-icon импорта.

### 5. Дополнительная ленивая загрузка ниже первого экрана
- `Cases`, `Blog teaser`, секция «Заказ услуг» — сейчас рендерятся синхронно на mount. Обернуть их в `Suspense` + `lazy()` + IntersectionObserver-триггер (как `DeferredGlobals`), чтобы они не участвовали в первом гидрате. Особенно `MediaCard` × N с подгрузкой обложек.
- `RecentlyViewed`, `CartCrossSell` (если присутствуют на главной/каталоге) — проверить, что они стартуют только по idle.

### 6. Изображения в каталоге/featured
- `FeaturedCard`/`MediaCard` — добавить `loading="lazy"` + `decoding="async"` + `sizes` для всех картинок ниже первого экрана. Подключить on-the-fly transform через Supabase Storage `?width=…&format=webp` (Storage Transformations) для thumbnail'ов вместо отдачи оригиналов.

### 7. Google Fonts → self-host (опционально)
- 85 мс на CSS-запрос к `fonts.googleapis.com` + дальше .woff2 с `fonts.gstatic.com` = 2 DNS/TLS. Self-host Space Grotesk + Inter (`@fontsource/...`) с `font-display: swap` экономит ~150 мс RTT на мобилке.

### 8. Микро
- Добавить `<meta name="theme-color">` уже есть? проверить. Не критично для perf, но улучшает воспринимаемую скорость.
- `manifest.webmanifest` сейчас грузится в render-pipeline (548 мс). Добавить ему `crossorigin="use-credentials"` только если он реально нужен — иначе `<link rel="manifest">` уже не блокирует.
- На мобиле отключить `animate-pulse-glow` (для `VALUES` иконок) — анимация запускается на ноде ~14× раз в секунду на каждой иконке и греет CPU. Поставить `motion-safe:` и `md:` префиксы.

## Технические детали (для исполнения)

### Hero `<picture>` (упрощённый шаблон)
```tsx
import heroAvifMobile from "/hero-bg-828.avif";
import heroWebpMobile from "/hero-bg-828.webp";
import heroAvifDesktop from "/hero-bg-1920.avif";
import heroWebpDesktop from "/hero-bg-1920.webp";

<picture>
  <source type="image/avif" srcSet={`${heroAvifMobile} 828w, ${heroAvifDesktop} 1920w`} sizes="100vw" />
  <source type="image/webp" srcSet={`${heroWebpMobile} 828w, ${heroWebpDesktop} 1920w`} sizes="100vw" />
  <img src={heroBg} alt="" fetchPriority="high" loading="eager" decoding="async"
       width={1920} height={1080} className="h-full w-full object-cover" />
</picture>
```

### Preload в head (route `/`)
```ts
links: [
  { rel: "preload", as: "image", href: heroAvifDesktop,
    imagesrcset: `${heroAvifMobile} 828w, ${heroAvifDesktop} 1920w`,
    imagesizes: "100vw", type: "image/avif", fetchpriority: "high" },
],
```

### Defer ниже-первого-экрана
```tsx
const TestimonialsTeaser = lazy(() => import("@/components/TestimonialsTeaser")...);
const BlogTeaser = lazy(() => import("@/components/BlogTeaser")...);

<InView fallback={<div className="h-96" />}>
  <Suspense fallback={null}><BlogTeaser posts={posts} /></Suspense>
</InView>
```

## Что НЕ буду делать без подтверждения
- Перерабатывать дизайн hero или контент.
- Менять архитектуру роутов / SSR.
- Включать платный CDN/Cloudflare Image Resizing (если только не подтвердите).

## Что хочу уточнить перед стартом

1. Делаю **полный список (пункты 1–8)** или только **критичный минимум** (1, 2, 5)?
2. По шрифтам — оставляем Google Fonts или **self-host через `@fontsource`**?

Если ответы «полный список + self-host» — берусь сразу за всё. Иначе сделаю в указанном объёме.
