# Сборка Android-приложения event-hub.by (TWA / APK)

Это инструкция, как собрать `.apk` (для установки вручную) и `.aab` (для Google Play) из уже опубликованного сайта `event-hub.by`. Сборка делается локально на твоём компьютере один раз — дальше любые изменения сайта подхватываются автоматически без пересборки.

## Что нужно установить (один раз)

1. **Node.js 18+** — https://nodejs.org/
2. **Java JDK 17** — `brew install openjdk@17` (Mac) или с сайта Oracle / Adoptium.
3. **Bubblewrap CLI**:

   ```bash
   npm install -g @bubblewrap/cli
   ```

   Bubblewrap при первом запуске сам скачает Android SDK / Gradle.

## Шаг 1. Клонировать конфиг

В этом проекте уже лежит готовый `twa/twa-manifest.json`. Скопируй папку `twa/` к себе на компьютер (или просто `git clone` всего проекта).

```bash
cd twa
```

## Шаг 2. Инициализация и сборка

```bash
# Bubblewrap прочитает twa-manifest.json и сгенерирует Android-проект
bubblewrap init --manifest=https://event-hub.by/manifest.webmanifest

# При первом запуске спросит:
# - принять лицензии Android SDK → y
# - сгенерировать ключ для подписи → y (запомни пароли!)

# Собрать APK + AAB
bubblewrap build
```

Готово. На выходе ты получишь:

- `app-release-signed.apk` — установить напрямую на телефон.
- `app-release-bundle.aab` — загрузить в Google Play Console.

## Шаг 3. Получить SHA-256 fingerprint и обновить assetlinks.json

Без этого шага Chrome будет показывать сверху URL-бар (приложение работает, но выглядит как браузер).

```bash
keytool -list -v -keystore android.keystore -alias android | grep "SHA256:"
```

Скопируй строку вида `AA:BB:CC:...` (64 hex-символа через двоеточие) и пришли мне — я обновлю файл `src/routes/.well-known/assetlinks[.]json.tsx` в проекте, ты опубликуешь сайт через кнопку Publish, и приложение станет «полноэкранным».

> Если выкладываешь в Google Play и используешь Play App Signing, добавь и второй fingerprint — Google его покажет в Play Console → Setup → App integrity → App signing key certificate.

## Шаг 4. Установить APK на телефон

```bash
# через USB-кабель с включённой отладкой
adb install app-release-signed.apk
```

или просто скинь `.apk` себе в Telegram / на Drive и открой на телефоне (нужно разрешить «установка из неизвестных источников»).

## Шаг 5. Загрузить в Google Play (опционально)

1. https://play.google.com/console → Create app
2. Upload `app-release-bundle.aab`
3. После первого релиза скопируй SHA-256 из Play Console → Setup → App signing → добавь его в наш `assetlinks.json` (см. Шаг 3).

## Обновление приложения

**Сам контент сайта обновлять не нужно** — приложение всегда показывает актуальную версию `event-hub.by`.

Пересобирать APK нужно только если:
- меняется иконка / название / package id
- увеличивается `appVersionCode` для нового релиза в Play

```bash
# В twa-manifest.json увеличь appVersionCode (1 → 2 → 3...) и appVersionName (1.0.0 → 1.0.1)
bubblewrap update
bubblewrap build
```

## Если что-то пошло не так

- **«Verification failed» при первом запуске** → не дошёл до Шага 3, пришли SHA-256.
- **Белый экран** → проверь, что `https://event-hub.by/manifest.webmanifest` открывается в браузере.
- **Bubblewrap не находит JDK** → `export JAVA_HOME=$(/usr/libexec/java_home -v 17)` (Mac).
