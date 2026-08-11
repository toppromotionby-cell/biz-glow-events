// Server route: /admin/documents/presentations/$id/render?format=pdf — PDF 16:9.
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireStaff } from "@/lib/admin-route-guard";
import { buildPdfResponse } from "@/lib/documents/pdf-http.server";
import { normalizeCompanyProfile, type CompanyProfile } from "@/lib/documents/company-profile";
import {
  normalizePresentation, normalizeSlide, presentationFileName,
} from "@/lib/presentations/model";
import { buildPresentationPdf, type ResolvedSlide } from "@/lib/presentations/pdf.server";

type Row = Record<string, unknown>;

/** Приватные пути bucket `media` подписываем, абсолютные URL оставляем как есть. */
async function resolveUrls(paths: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const priv = paths.filter((p) => p && !/^https?:\/\//i.test(p));
  for (const p of paths) if (/^https?:\/\//i.test(p)) map.set(p, p);
  if (priv.length) {
    const { data } = await supabaseAdmin.storage.from("media").createSignedUrls(priv, 900);
    for (const row of data ?? []) {
      if (row.path && row.signedUrl) map.set(row.path, row.signedUrl);
    }
  }
  return map;
}

export const Route = createFileRoute("/admin/documents/presentations/$id/render")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const auth = await requireStaff(request);
        if (auth instanceof Response) return auth;

        const [{ data: row }, { data: slideRows }] = await Promise.all([
          supabaseAdmin.from("presentations").select("*").eq("id", params.id).maybeSingle(),
          supabaseAdmin
            .from("presentation_slides")
            .select("*")
            .eq("presentation_id", params.id)
            .order("position"),
        ]);
        if (!row) return new Response("Not found", { status: 404 });

        const presentation = normalizePresentation(row as Row);
        const slides = ((slideRows ?? []) as Row[]).map((r, i) => normalizeSlide(r, i));

        let company: CompanyProfile | null = null;
        if (presentation.company_id) {
          const { data: cRow } = await supabaseAdmin
            .from("company_profiles")
            .select("*")
            .eq("id", presentation.company_id)
            .maybeSingle();
          if (cRow) company = normalizeCompanyProfile(cRow as Row);
        }
        if (!company) {
          const { data: cRow } = await supabaseAdmin
            .from("company_profiles")
            .select("*")
            .eq("is_default", true)
            .maybeSingle();
          if (cRow) company = normalizeCompanyProfile(cRow as Row);
        }

        const paths = [
          ...slides.map((s) => s.image_url).filter((v): v is string => !!v),
          ...slides.flatMap((s) => s.content.images ?? []),
          ...(presentation.logo_url ? [presentation.logo_url] : []),
          ...(presentation.client_logo_url ? [presentation.client_logo_url] : []),
          ...(company?.logo_url ? [company.logo_url] : []),
        ];
        const urls = await resolveUrls(paths);

        const resolved: ResolvedSlide[] = slides.map((s) => {
          const list = [
            ...(s.image_url ? [s.image_url] : []),
            ...(s.content.images ?? []),
          ];
          const unique = Array.from(new Set(list));
          return {
            ...s,
            resolved_image_url: s.image_url ? (urls.get(s.image_url) ?? null) : null,
            resolved_images: unique
              .map((p) => urls.get(p) ?? null)
              .filter((v): v is string => !!v),
          };
        });
        const brandLogoSrc = presentation.logo_url || company?.logo_url || null;
        const logoUrl = brandLogoSrc ? (urls.get(brandLogoSrc) ?? brandLogoSrc) : null;
        const clientLogoUrl = presentation.client_logo_url
          ? (urls.get(presentation.client_logo_url) ?? presentation.client_logo_url)
          : null;

        return buildPdfResponse({
          filename: presentationFileName(presentation.title, "pdf"),
          operation: "presentation",
          entityId: params.id,
          build: () => buildPresentationPdf(presentation, resolved, company, logoUrl, clientLogoUrl),
        });
      },
    },
  },
});
