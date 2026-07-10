# План SEO-оптимизации

Проверил текущий код: SEO-шаблоны для карточек уже есть в `catalog-page-config.ts` с fallback на `seo_title/seo_description` из БД (ручной override уже работает через админ-редактор). Canonical выводится только на страницах карточек. Sitemap динамический (`src/routes/sitemap[.]xml.tsx`). Robots.txt есть как route. Медиа-аплоадер уже жмёт в WebP и ставит `loading="lazy"`. JSON-LD Product есть, но нужно проверить Offer.

## 1. Единый шаблон мета-тегов (все 4 каталога)

Заменить в `src/lib/catalog-page-config.ts` `buildTitle` / `buildDescription` на единый формат ТЗ:

- **Title**: `«{title} в Минске — Аренда и прокат на мероприятие»`
- **Description**: `«Закажите {title} в Минске и Беларуси на выгодных условиях. Техническое обеспечение и организация мероприятий от Event Hub. Цены, фото, подбор за 15 минут!»`

Ручной override сохраняется: если в админке заполнено `seo_title` / `seo_description` — используется оно, иначе шаблон. Поля уже редактируются в `CatalogEditor.tsx` (вкладка SEO) — ничего в UI не трогаем.

Для страниц-списков (`/zones`, `/equipment`, `/services`, `/production`) оставляем текущие тексты — они уже уникальны для каждой категории.

## 2. Canonical + чистка URL от фильтров

**Список каталога** (`catalog-list-route.tsx`): добавить в `head()` `links: [{ rel: "canonical", href: config.pageUrl }]` — canonical всегда указывает на чистый URL без query-параметров (`?type=`, `?price=`, `?page=`, `?sort=`).

**Карточка** (`catalog-slug-route.tsx`): canonical уже стоит, но URL строится без query — оставляем.

**Пагинация**: сейчас пагинации на списках нет (данные грузятся одним запросом), поэтому дублей `?page=2` не будет. Если появится — canonical всё равно уже жёстко зашит на чистый URL.

## 3. Sitemap.xml и Robots.txt

**Sitemap** (`src/routes/sitemap[.]xml.tsx`): уже динамический, тянет `published=true` из `zones/tech_equipment/services/production_items/blog_posts/cases`. Проверю, что новые/удалённые позиции подхватываются автоматически — код уже корректный, менять не нужно. Добавлю в `STATIC` пропущенные страницы (`/cases/{slug}` — уже есть) и проверю кэш (сейчас 1 час).

**Robots.txt** (`src/routes/robots[.]txt.tsx`): дополнить закрытыми путями:

```
Disallow: /admin
Disallow: /profile
Disallow: /cart
Disallow: /wishlist
Disallow: /login
Disallow: /register
Disallow: /reset-password
Disallow: /forgot-password
Disallow: /lovable
Disallow: /inquiry
Disallow: /order/success
Disallow: /unsubscribe
Disallow: /*?*        # обрезаем индексацию любых URL с query
```

Правило `Disallow: /*?*` закроет фильтры/сортировки/utm.

## 4. Оптимизация изображений

`UniversalMediaUploader.tsx` **уже** сжимает при загрузке через `browser-image-compression` и конвертирует в WebP (~1.2 МБ, до 2000px). На фронте картинки идут через `<img loading="lazy">` (уже стоит в `MediaThumb` и в компонентах карточек).

Что доработаю:
- Проверю, что все `<img>` в `CatalogDetail`, `CatalogGrid`, `FeaturedCard`, `HeroSection` имеют `loading="lazy"` (кроме LCP на главной — там `fetchpriority="high"`).
- Добавлю `decoding="async"` на не-LCP изображения там, где его нет.

Дополнительная серверная перекодировка не нужна: конвертация уже произошла на клиенте перед загрузкой в Storage.

## 5. Микроразметка Product + Offer

`productJsonLd` в `CatalogDetail.tsx` уже генерирует `@type: Product`. Проверю и при необходимости дополню:
- `name`, `image` (массив), `description`, `brand: Event Hub`, `category`
- `offers`: `@type: Offer`, `priceCurrency: BYN`, `price` (из первого тарифа `pricing`), `availability: InStock`, `url` (страница карточки)
- `aggregateRating` — только если есть реальные отзывы (иначе Google карает).

Дополнительно добавлю на все страницы `BreadcrumbList` JSON-LD (Главная → Раздел → Карточка) через существующий `AutoBreadcrumbs`.

---

## Технические детали

**Файлы к изменению:**
- `src/lib/catalog-page-config.ts` — единый шаблон title/description
- `src/lib/catalog-list-route.tsx` — canonical в head
- `src/routes/robots[.]txt.tsx` — расширенный disallow
- `src/routes/sitemap[.]xml.tsx` — сверка списка статических путей
- `src/components/CatalogDetail.tsx` — расширить `productJsonLd` (Offer с ценой, BreadcrumbList)
- `src/components/CatalogGrid.tsx`, `FeaturedCard.tsx`, `HeroSection.tsx` — аудит `loading`/`decoding`

**Что НЕ трогаем:**
- БД-миграции не нужны (`seo_title`/`seo_description` уже есть)
- Админ-UI не меняем — ручной override уже работает
- Storage-политики и загрузчик медиа
- Основной sitemap-движок (он корректный)

Подтвердите — приступаю к реализации.
