// Общая сборка данных презентации для PDF: используется и админским роутом
// /admin/documents/presentations/$id/render, и публичной ссылкой /p/$token.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { mediaPublicUrl } from "@/lib/media-url";
import { normalizeCompanyProfile, type CompanyProfile } from "@/lib/documents/company-profile";
import { normalizePresentation, normalizeSlide, type Presentation } from "@/lib/presentations/model";
import { buildPresentationPdf, type ResolvedSlide } from "@/lib/presentations/pdf.server";

type Row = Record<string, unknown>;

export type PresentationBundle = {
  presentation: Presentation;
  slides: ResolvedSlide[];
  company: CompanyProfile | null;
  logoUrl: string | null;
  clientLogoUrl: string | null;
};

async function loadCompany(companyId: string | null): Promise<CompanyProfile | null> {
  if (companyId) {
    const { data } = await supabaseAdmin
      .from("company_profiles").select("*").eq("id", companyId).maybeSingle();
    if (data) return normalizeCompanyProfile(data as Row);
  }
  const { data } = await supabaseAdmin
    .from("company_profiles").select("*").eq("is_default", true).maybeSingle();
  return data ? normalizeCompanyProfile(data as Row) : null;
}

/** Собирает презентацию по id либо по публичному токену. */
export async function loadPresentationBundle(
  by: { id: string } | { token: string },
): Promise<PresentationBundle | null> {
  const query = supabaseAdmin.from("presentations").select("*");
  const { data: row } = await ("id" in by
    ? query.eq("id", by.id)
    : query.eq("public_token", by.token).eq("share_enabled", true)
  ).maybeSingle();
  if (!row) return null;

  const presentation = normalizePresentation(row as Row);
  const { data: slideRows } = await supabaseAdmin
    .from("presentation_slides").select("*")
    .eq("presentation_id", presentation.id).order("position");
  const slides = ((slideRows ?? []) as Row[]).map((r, i) => normalizeSlide(r, i));
  const company = await loadCompany(presentation.company_id);

  const urls = new Map<string, string>();
  for (const p of [
    ...slides.map((s) => s.image_url).filter((v): v is string => !!v),
    ...slides.flatMap((s) => s.content.images ?? []),
    ...(presentation.logo_url ? [presentation.logo_url] : []),
    ...(presentation.client_logo_url ? [presentation.client_logo_url] : []),
    ...(company?.logo_url ? [company.logo_url] : []),
  ]) if (p) urls.set(p, mediaPublicUrl(p));

  const resolved: ResolvedSlide[] = slides.map((s) => {
    const unique = Array.from(new Set([...(s.image_url ? [s.image_url] : []), ...(s.content.images ?? [])]));
    return {
      ...s,
      resolved_image_url: s.image_url ? (urls.get(s.image_url) ?? null) : null,
      resolved_images: unique.map((p) => urls.get(p) ?? null).filter((v): v is string => !!v),
    };
  });

  const brandLogoSrc = presentation.logo_url || company?.logo_url || null;
  return {
    presentation,
    slides: resolved,
    company,
    logoUrl: brandLogoSrc ? (urls.get(brandLogoSrc) ?? brandLogoSrc) : null,
    clientLogoUrl: presentation.client_logo_url
      ? (urls.get(presentation.client_logo_url) ?? presentation.client_logo_url)
      : null,
  };
}

export function buildBundlePdf(b: PresentationBundle): Promise<Uint8Array> {
  return buildPresentationPdf(b.presentation, b.slides, b.company, b.logoUrl, b.clientLogoUrl);
}
