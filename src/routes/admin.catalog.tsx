// Тонкий layout: переключение между типами каталога теперь живёт в сайдбаре.
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/catalog")({
  component: () => <Outlet />,
});
