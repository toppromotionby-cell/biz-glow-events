import { createFileRoute, redirect } from "@tanstack/react-router";

// Калькулятор живёт только на главной странице; старый URL ведёт туда же.
export const Route = createFileRoute("/calculator")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
