// Универсальные компоненты для отображения медиа из приватного bucket `media`.
// Если путь — уже полный URL (http/blob/data), показываем как есть.
// Иначе берём подписанный URL из общего кэша (`signedMediaUrl`).
import { useEffect, useRef, useState } from "react";
import { signedMediaUrl } from "@/lib/media-url-cache";
import { cn } from "@/lib/utils";

function isAbsolute(src: string): boolean {
  return /^(https?:|blob:|data:)/i.test(src);
}

export function useResolvedUrl(path: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(() =>
    path && isAbsolute(path) ? path : null,
  );
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    if (!path) { setUrl(null); return; }
    if (isAbsolute(path)) { setUrl(path); return; }
    (async () => {
      const signed = await signedMediaUrl(path);
      if (mounted.current) setUrl(signed);
    })();
    return () => { mounted.current = false; };
  }, [path]);
  return url;
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
