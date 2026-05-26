import { createFileRoute, useParams } from "@tanstack/react-router";
import { CampaignEditor } from "@/components/admin/CampaignEditor";

export const Route = createFileRoute("/admin/campaigns/$id")({
  head: () => ({ meta: [{ title: "Редактирование рассылки — Админ" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: CampaignEditPage,
});

function CampaignEditPage() {
  const { id } = useParams({ from: "/admin/campaigns/$id" });
  return <CampaignEditor id={id} />;
}
