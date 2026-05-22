import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/blog")({
  head: () => ({
    meta: [
      { title: "Блог о event-индустрии — event-hub.by" },
      { name: "description", content: "Кейсы, тренды и аналитика event-рынка Беларуси." },
    ],
  }),
  component: () => (
    <div className="container mx-auto px-4 py-16 max-w-3xl">
      <h1 className="text-4xl font-display font-bold gradient-text">Блог</h1>
      <p className="mt-4 text-muted-foreground">Скоро здесь появятся кейсы, обзоры оборудования и тренды event-индустрии.</p>
    </div>
  ),
});
