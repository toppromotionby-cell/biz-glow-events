import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "Политика конфиденциальности — event-hub.by" }] }),
  component: () => (
    <div className="container mx-auto px-4 py-16 max-w-3xl prose prose-invert">
      <h1 className="text-3xl font-display font-bold gradient-text">Политика конфиденциальности</h1>
      <p className="mt-4 text-muted-foreground">Мы обрабатываем персональные данные в соответствии с законодательством Республики Беларусь (Закон № 99-З «О защите персональных данных»).</p>
    </div>
  ),
});
