import { createFileRoute } from "@tanstack/react-router";
import { catalogSlugRouteOptions } from "@/lib/catalog-slug-route";

export const Route = createFileRoute("/services/$slug")(catalogSlugRouteOptions("/services"));
