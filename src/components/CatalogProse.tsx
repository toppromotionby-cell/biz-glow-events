// Единый компонент для блоков «Описание» и «Технические требования».
// Рендерит текст одинаково независимо от авторизации — никаких условных веток
// по сессии/правам, чтобы не было расхождений между гостем и пользователем.
type Variant = "modal" | "page";

export function CatalogProse({
  description,
  requirements,
  variant = "page",
}: {
  description?: string | null;
  requirements?: string | null;
  variant?: Variant;
}) {
  const hasDescription = typeof description === "string" && description.trim().length > 0;
  const hasRequirements = typeof requirements === "string" && requirements.trim().length > 0;
  if (!hasDescription && !hasRequirements) return null;

  const isModal = variant === "modal";
  const descHeading = isModal ? "text-lg" : "text-2xl";
  const reqHeading = isModal ? "text-base" : "text-xl";
  const descGap = isModal ? "mt-10" : "mt-12";
  const reqGap = isModal ? "mt-6" : "mt-8";

  return (
    <>
      {hasDescription && (
        <section className={descGap}>
          <div className="glass rounded-2xl p-6 md:p-8 w-full min-w-0 overflow-hidden">
            <h2 className={`${descHeading} font-display font-semibold mb-4`}>Описание</h2>
            <p className="prose-wrap text-[15px] leading-relaxed text-foreground/90">{description}</p>
          </div>
        </section>
      )}
      {hasRequirements && (
        <section className={reqGap}>
          <div className="glass rounded-2xl p-6 md:p-8 w-full min-w-0 overflow-hidden">
            <h2 className={`${reqHeading} font-display font-semibold mb-3`}>Технические требования</h2>
            <p className="prose-wrap text-sm leading-relaxed text-muted-foreground">{requirements}</p>
          </div>
        </section>
      )}
    </>
  );
}
