// SEO description: берём первые 155 символов осмысленного текста, режем по слову.
export function generateSeoDescription(...sources: Array<string | null | undefined>): string {
  const raw = sources.find((s) => typeof s === "string" && s.trim().length > 0) ?? "";
  const plain = String(raw)
    .replace(/<[^>]+>/g, " ")
    .replace(/[#>*`_~\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (plain.length <= 155) return plain;
  const cut = plain.slice(0, 155);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 80 ? cut.slice(0, lastSpace) : cut).replace(/[.,;:!?]+$/, "") + "…";
}
