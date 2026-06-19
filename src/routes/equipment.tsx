import { createFileRoute } from "@tanstack/react-router";
import { catalogListRouteOptions } from "@/lib/catalog-list-route";

export const Route = createFileRoute("/equipment")(catalogListRouteOptions("/equipment"));
