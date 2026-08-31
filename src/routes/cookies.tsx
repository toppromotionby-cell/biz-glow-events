import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/cookies")({
  head: () => ({
    meta: [
      { title: "Политика использования cookies — event-hub.by" },
      { name: "description", content: "Как event-hub.by использует файлы cookie, аналитику и получает согласие пользователей." },
      { property: "og:title", content: "Политика использования cookies — event-hub.by" },
      { property: "og:description", content: "Как event-hub.by использует файлы cookie, аналитику и получает согласие пользователей." },
      { property: "og:url", content: "https://event-hub.by/cookies" },
    ],
    links: [{ rel: "canonical", href: "https://event-hub.by/cookies" }],
  }),
  component: () => (
    <div className="page-shell section-y max-w-3xl">
      <h1 className="text-3xl font-display font-bold gradient-text">Политика использования файлов cookie</h1>
      <p className="mt-4 text-muted-foreground">
        Настоящая Политика объясняет, какие файлы cookie и аналогичные технологии используются на сайте
        event-hub.by, для каких целей, и как вы можете управлять своим согласием.
      </p>

      <section className="mt-10 space-y-4 text-muted-foreground">
        <h2 className="text-xl font-semibold text-foreground">1. Что такое cookie</h2>
        <p>
          Cookie — это небольшие текстовые файлы, которые веб-сайт сохраняет на устройстве пользователя (компьютер,
          планшет, смартфон) при посещении сайта. Они позволяют распознавать устройство, запоминать настройки и
          собирать статистику использования.
        </p>
      </section>

      <section className="mt-8 space-y-4 text-muted-foreground">
        <h2 className="text-xl font-semibold text-foreground">2. Какие cookie мы используем</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong className="text-foreground">Технические (обязательные):</strong> необходимы для корректной работы
            сайта, корзины, авторизации и сохранения системных настроек (например, темы оформления). Они не требуют
            дополнительного согласия.
          </li>
          <li>
            <strong className="text-foreground">Аналитические и маркетинговые:</strong> помогают понять, как посетители
            взаимодействуют с сайтом, улучшать контент и рекламные кампании. К ним относятся Google Analytics 4,
            Яндекс.Метрика и события кликов по социальным сетям. Эти инструменты запускаются только после вашего
            согласия.
          </li>
        </ul>
      </section>

      <section className="mt-8 space-y-4 text-muted-foreground">
        <h2 className="text-xl font-semibold text-foreground">3. Согласие на аналитику</h2>
        <p>
          При первом посещении сайта отображается баннер с выбором: принять или отклонить аналитические cookie. Если
          согласие не дано, мы не передаём данные в Google Analytics, Яндекс.Метрику и не фиксируем маркетинговые
          события. Технические cookie при этом продолжают работать.
        </p>
        <p>Вы можете изменить своё решение в любой момент, обновив страницу или очистив сохранённый выбор в браузере.</p>
      </section>

      <section className="mt-8 space-y-4 text-muted-foreground">
        <h2 className="text-xl font-semibold text-foreground">4. Как управлять cookie</h2>
        <p>
          Большинство браузеров позволяют просматривать, удалять и блокировать cookie в настройках конфиденциальности.
          Полное отключение cookie может повлиять на работу некоторых функций сайта (например, корзины или входа в личный
          кабинет).
        </p>
      </section>

      <section className="mt-8 space-y-4 text-muted-foreground">
        <h2 className="text-xl font-semibold text-foreground">5. Сторонние сервисы</h2>
        <p>
          Для анализа трафика мы используем Google Analytics 4 и Яндекс.Метрику. Данные, передаваемые этим сервисам,
          анонимизированы и не позволяют идентифицировать конкретного пользователя без дополнительной информации.
        </p>
      </section>

      <section className="mt-8 space-y-4 text-muted-foreground">
        <h2 className="text-xl font-semibold text-foreground">6. Изменения в Политике</h2>
        <p>
          Мы можем обновлять настоящую Политику. Актуальная версия всегда доступна по адресу{" "}
          <a href="https://event-hub.by/cookies" className="text-primary hover:underline">
            event-hub.by/cookies
          </a>.
        </p>
      </section>

      <section className="mt-8 space-y-4 text-muted-foreground">
        <h2 className="text-xl font-semibold text-foreground">7. Контакты</h2>
        <p>
          Если у вас остались вопросы об использовании cookie, напишите нам:{" "}
          <a href="mailto:hello@event-hub.by" className="text-primary hover:underline">
            hello@event-hub.by
          </a>.
        </p>
      </section>
    </div>
  ),
});
