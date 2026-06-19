import { createFileRoute } from "@tanstack/react-router";
import { catalogListRouteOptions } from "@/lib/catalog-list-route";

export const Route = createFileRoute("/services")(catalogListRouteOptions("/services"));
