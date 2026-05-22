import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/production")({
  head: () => ({ meta: [{ title: "Производство — event-hub.by" }, { name: "description", content: "Производство декораций, конструкций и фотозон под ключ." }] }),
  component: ProductionPage,
});

function ProductionPage() {
  return (
    <div className="container mx-auto px-4 py-16">
      <h1 className="text-4xl font-display font-bold gradient-text">Производство</h1>
      <p className="mt-4 text-muted-foreground">Каталог скоро будет доступен.</p>
    </div>
  );
}
