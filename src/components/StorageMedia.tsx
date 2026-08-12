// Универсальные компоненты для отображения медиа каталога.
// Каталог публичный: ссылка строится из пути детерминированно, без запросов
// к API и подписей, поэтому картинки видны сразу и одинаково в SSR и в браузере.
import { useMemo } from "react";
import { mediaPublicUrl } from "@/lib/media-url";
import { cn } from "@/lib/utils";

export function useResolvedUrl(path: string | null | undefined): string | null {
  return useMemo(() => (path ? mediaPublicUrl(path) || null : null), [path]);
}

export function StorageImg({
  path, alt = "", className, fallbackClassName,
}: { path: string | null | undefined; alt?: string; className?: string; fallbackClassName?: string }) {
  const url = useResolvedUrl(path);
  if (!url) {
    return <div className={cn("bg-muted/30", fallbackClassName ?? className)} aria-hidden />;
  }
  return <img src={url} alt={alt} loading="lazy" className={className} />;
}

export function StorageVideo({
  path, className, controls = true,
}: { path: string | null | undefined; className?: string; controls?: boolean }) {
  const url = useResolvedUrl(path);
  if (!url) return <div className={cn("bg-muted/30", className)} aria-hidden />;
  return (
    <video src={url} controls={controls} className={className} muted playsInline preload="metadata" />
  );
}
