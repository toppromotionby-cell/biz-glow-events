import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Политика конфиденциальности — event-hub.by" },
      { name: "description", content: "Как event-hub.by собирает, использует и защищает персональные данные в соответствии с Законом РБ № 99-З." },
      { property: "og:title", content: "Политика конфиденциальности — event-hub.by" },
      { property: "og:description", content: "Как event-hub.by собирает, использует и защищает персональные данные." },
      { property: "og:url", content: "https://event-hub.by/privacy" },
    ],
    links: [{ rel: "canonical", href: "https://event-hub.by/privacy" }],
  }),
  component: () => (
    <div className="page-shell section-y max-w-3xl prose prose-invert">
      <h1 className="text-3xl font-display font-bold gradient-text">Политика конфиденциальности</h1>
      <p className="mt-4 text-muted-foreground">Мы обрабатываем персональные данные в соответствии с законодательством Республики Беларусь (Закон № 99-З «О защите персональных данных»).</p>
    </div>
  ),
});
