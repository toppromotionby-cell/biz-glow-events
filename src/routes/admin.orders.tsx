// Layout-роут /admin/orders. Сам по себе ничего не рендерит — пропускает
// дочерние маршруты (index — список, $id — карточка заказа на полной странице).
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/orders")({
  component: () => <Outlet />,
});
