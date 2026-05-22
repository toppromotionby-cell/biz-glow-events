import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/zones")({
  head: () => ({ meta: [{ title: "Интерактивные зоны — event-hub.by" }, { name: "description", content: "Каталог интерактивных зон для мероприятий: VR, AR, фотозоны, LED." }] }),
  component: ZonesPage,
});

function ZonesPage() {
  return (
    <div className="container mx-auto px-4 py-16">
      <h1 className="text-4xl font-display font-bold gradient-text">Интерактивные зоны</h1>
      <p className="mt-4 text-muted-foreground">Каталог скоро будет доступен.</p>
    </div>
  );
}
