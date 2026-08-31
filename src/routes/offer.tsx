import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/offer")({
  head: () => ({ meta: [{ title: "Публичная оферта — event-hub.by" }] }),
  component: () => (
    <div className="page-shell section-y max-w-3xl">
      <h1 className="text-3xl font-display font-bold gradient-text">Публичная оферта</h1>
      <p className="mt-4 text-muted-foreground">Условия предоставления услуг event-hub.by.</p>
    </div>
  ),
});
