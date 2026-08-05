// /admin/documents → редирект на список КП.
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/documents/")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/documents/quotes" });
  },
});
