
## Что получится

Android-приложение event-hub.by — это TWA (Trusted Web Activity), тонкая нативная обёртка вокруг твоего опубликованного сайта. Без браузерной строки, с иконкой на рабочем столе, можно загрузить в Google Play.

- Сайт `event-hub.by` и Android-приложение работают **одновременно** и используют **одну и ту же базу** (Lovable Cloud). Авторизация, корзина, заказы, админка — всё общее.
- Любое изменение на сайте появляется в приложении мгновенно (ничего пересобирать не нужно).
- Сборка `.apk` / `.aab` происходит **на твоём компьютере** одной командой Bubblewrap CLI — внутри Lovable собрать APK невозможно (нет Android SDK).

## Что я сделаю в проекте (со стороны сайта)

1. **Иконка приложения** — сгенерирую квадратную PNG-иконку 512×512 (на основе текущего favicon с оранжевой звездой) и maskable-вариант для Android-адаптивных иконок. Сохраню в `public/icon-512.png`, `public/icon-192.png`, `public/icon-maskable-512.png`.

2. **Web App Manifest** — `public/manifest.webmanifest`:
   - name: "event-hub.by", short_name: "Event Hub"
   - start_url: "/", scope: "/", display: "standalone"
   - theme_color: `#000000`, background_color: `#000000`
   - lang: `ru-BY`, иконки (any + maskable)
   - shortcuts: Каталог, Корзина, Профиль

3. **Подключение манифеста и мета-тегов** в `src/routes/__root.tsx`:
   - `<link rel="manifest" href="/manifest.webmanifest">`
   - `apple-touch-icon` 180×180, `mobile-web-app-capable`
   - existing `theme-color` оставляем

4. **Digital Asset Links** — `public/.well-known/assetlinks.json`. Это ключевой файл для TWA: подтверждает, что приложение и домен принадлежат одному владельцу, иначе Chrome покажет браузерную строку поверх приложения. Заполнится после того, как ты сгенерируешь signing key и пришлёшь SHA-256 fingerprint (один раз).
   - На время первой сборки положу шаблон с placeholder fingerprint, ты заменишь на реальный.
   - Обслуживание `/.well-known/...` через TanStack — добавлю route `src/routes/.well-known/assetlinks[.]json.tsx`, отдающий статический JSON с правильным content-type, чтобы файл доехал на Cloudflare Worker без проблем.

5. **Bubblewrap-конфиг** — `twa/twa-manifest.json`:
   - host: `event-hub.by`
   - packageId: `by.event_hub.twa`
   - appName: "event-hub.by", launcherName: "Event Hub"
   - themeColor / backgroundColor синхронны с сайтом
   - signingKey: путь, который ты создашь локально

6. **Инструкция сборки APK** — `twa/README.md` с пошаговыми командами:
   - Установка Node 18+ и `@bubblewrap/cli`
   - `bubblewrap init --manifest=https://event-hub.by/manifest.webmanifest`
   - `bubblewrap build` → получаешь `app-release-signed.apk` и `.aab` для Google Play
   - Получение SHA-256 fingerprint из подписанного APK + что вставить в `assetlinks.json`
   - Тестирование на Android-устройстве через `adb install`

## Что нужно от тебя (один раз, после моих изменений)

1. Поставить на свой Mac/PC Node 18+ и Java 17.
2. Запустить 3 команды из `twa/README.md`.
3. Прислать мне SHA-256 fingerprint созданного ключа — я обновлю `assetlinks.json`.
4. Опубликовать сайт (кнопка Publish в Lovable), чтобы новый манифест и assetlinks стали доступны на `event-hub.by`.
5. Установить полученный `.apk` на телефон или загрузить `.aab` в Google Play Console.

## Чего этот план НЕ делает

- Не создаёт нативный Kotlin-проект — это TWA, а не отдельная нативная реализация.
- Не отдаёт готовый подписанный APK из Lovable (физически невозможно — нет Android SDK в песочнице).
- Не добавляет push-уведомления / нативную камеру / биометрию. Если позже понадобится — переезжаем на Capacitor отдельной задачей.

## Технические детали

- Манифест и assetlinks.json раздаются с того же домена, что и сайт (`event-hub.by`), через TanStack server routes для гарантированных HTTP-заголовков.
- Иконки PNG, не SVG: TWA/Android требует растровые иконки 192/512 + maskable.
- `display: standalone` без `display: fullscreen` — оставляет статус-бар, как принято в Play Store.
- `theme_color: #000000` совпадает с уже выставленным в `__root.tsx`.
- Иконки и манифест статичны — отдаются Cloudflare как обычные файлы из `public/`.

После твоего «ОК» я переключусь в build mode и сделаю всё за один проход.
