import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/equipment")({
  head: () => ({ meta: [{ title: "Оборудование — event-hub.by" }, { name: "description", content: "Аренда event-оборудования: звук, свет, экраны, LED." }] }),
  component: EquipmentPage,
});

function EquipmentPage() {
  return (
    <div className="container mx-auto px-4 py-16">
      <h1 className="text-4xl font-display font-bold gradient-text">Оборудование</h1>
      <p className="mt-4 text-muted-foreground">Каталог скоро будет доступен.</p>
    </div>
  );
}
