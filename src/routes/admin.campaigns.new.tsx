import { createFileRoute } from "@tanstack/react-router";
import { CampaignEditor } from "@/components/admin/CampaignEditor";

export const Route = createFileRoute("/admin/campaigns/new")({
  head: () => ({ meta: [{ title: "Новая рассылка — Админ" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: () => <CampaignEditor />,
});
