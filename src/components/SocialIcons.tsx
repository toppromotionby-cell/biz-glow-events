// Иконки соцсетей (Instagram + TikTok). Рендерим только если URL задан в админке.
// Каждая иконка обёрнута в Toggleable — можно скрыть отдельно через «Видимость секций».
import { Instagram } from "lucide-react";
import { TikTokIcon } from "@/components/icons/TikTokIcon";
import { Toggleable } from "@/lib/site-sections";
import { useSiteSettings } from "@/hooks/use-site-settings";
import { cn } from "@/lib/utils";

type Variant = "footer" | "card";

export function SocialIcons({
  variant = "footer",
  className,
}: {
  variant?: Variant;
  className?: string;
}) {
  const { instagram_url, tiktok_url } = useSiteSettings();

  if (!instagram_url && !tiktok_url) return null;

  const baseBtn =
    variant === "footer"
      ? "inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-card/50 text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-card transition"
      : "inline-flex h-10 w-10 items-center justify-center rounded-full bg-card text-primary hover:scale-105 transition";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {instagram_url && (
        <Toggleable sectionKey="footer.social.instagram" as="div">
          <a
            href={instagram_url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Мы в Instagram"
            title="Instagram"
            className={baseBtn}
          >
            <Instagram className="h-4 w-4" />
          </a>
        </Toggleable>
      )}
      {tiktok_url && (
        <Toggleable sectionKey="footer.social.tiktok" as="div">
          <a
            href={tiktok_url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Мы в TikTok"
            title="TikTok"
            className={baseBtn}
          >
            <TikTokIcon size={16} />
          </a>
        </Toggleable>
      )}
    </div>
  );
}
