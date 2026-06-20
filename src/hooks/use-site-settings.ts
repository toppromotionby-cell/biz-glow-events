// Хук читает публичные настройки сайта (соц.ссылки) с кэшем 5 минут.
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSiteSettings, type SiteSettings } from "@/lib/site-settings.functions";

const EMPTY: SiteSettings = { instagram_url: null, tiktok_url: null };

export function useSiteSettings(): SiteSettings {
  const fn = useServerFn(getSiteSettings);
  const { data } = useQuery({
    queryKey: ["site-settings", "public"],
    queryFn: () => fn(),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
  return data ?? EMPTY;
}
