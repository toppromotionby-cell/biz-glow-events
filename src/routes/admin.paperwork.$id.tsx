// Страница редактирования корпоративного документа.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2 } from "lucide-react";
import { adminKeys } from "@/lib/query-keys";
import { getPaperworkDocument } from "@/lib/paperwork.functions";
import { getCompanyProfiles } from "@/lib/company-profiles.functions";
import { PaperworkEditor } from "@/components/admin/paperwork/PaperworkEditor";

export const Route = createFileRoute("/admin/paperwork/$id")({
  head: () => ({ meta: [{ title: "Документ — админка" }] }),
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  const getDoc = useServerFn(getPaperworkDocument);
  const getProfiles = useServerFn(getCompanyProfiles);

  const detail = useQuery({
    queryKey: [...adminKeys.paperwork, id],
    queryFn: () => getDoc({ data: { id } }),
  });

  const profiles = useQuery({
    queryKey: ["company-profiles"],
    queryFn: () => getProfiles({}),
  });

  if (detail.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Загрузка документа…
      </div>
    );
  }
  if (detail.error || !detail.data) {
    return <p className="p-8 text-center text-sm text-destructive">Документ не найден.</p>;
  }

  const companyId = detail.data.document.company_profile_id;
  const company = (profiles.data ?? []).find((p) => p.id === companyId) ?? null;

  return (
    <div className="space-y-4">
      <Link to="/admin/paperwork" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ArrowLeft className="h-4 w-4" /> Все документы
      </Link>
      <PaperworkEditor detail={detail.data} company={company} />
    </div>
  );
}
