// Старый список КП промо объединён с общим центром документов
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/documents/promo/")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/documents" });
  },
});
