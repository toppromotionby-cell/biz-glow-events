// Старый список КП объединён с общим центром документов
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/documents/quotes/")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/documents" });
  },
});
