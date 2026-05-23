// MediaShield — комплексный deterrent против скачивания медиа.
// ⚠️ ВАЖНО: 100% защита медиа в браузере НЕВОЗМОЖНА (любой может сделать скриншот
// или открыть DevTools). Это слой отпугивающих мер, который усложняет ручное скачивание.
// Реальная защита — это signed URLs с TTL 15 мин (см. createSignedMediaUrl ниже)
// + watermark на медиа на этапе загрузки в админке (TODO в следующей итерации).
import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface MediaShieldProps {
  children: ReactNode;
  className?: string;
  /** Блокировать DevTools хоткеи. Использовать на каталогах. */
  blockDevtools?: boolean;
}

export function MediaShield({ children, className, blockDevtools = false }: MediaShieldProps) {
  useEffect(() => {
    if (!blockDevtools) return;
    const handler = (e: KeyboardEvent) => {
      // Ctrl+S, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U, F12
      const blocked =
        ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && ["i","I","j","J","c","C"].includes(e.key)) ||
        ((e.ctrlKey || e.metaKey) && (e.key === "u" || e.key === "U")) ||
        e.key === "F12";
      if (blocked) e.preventDefault();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [blockDevtools]);

  return (
    <div
      className={cn("media-shield relative", className)}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      {children}
      {/* Прозрачный оверлей поверх медиа */}
      <div
        aria-hidden="true"
        className="absolute inset-0 z-10 pointer-events-auto bg-transparent"
        style={{ background: "transparent" }}
      />
    </div>
  );
}

interface ShieldedImageProps {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
}

export function ShieldedImage({ src, alt, className, width, height }: ShieldedImageProps) {
  return (
    <MediaShield className={className}>
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading="lazy"
        decoding="async"
        className="w-full h-full object-cover select-none"
        draggable={false}
      />
    </MediaShield>
  );
}

interface ShieldedVideoProps {
  src: string;
  poster?: string;
  className?: string;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
}

export function ShieldedVideo({
  src, poster, className, autoPlay = true, loop = true, muted = true,
}: ShieldedVideoProps) {
  return (
    <MediaShield className={className}>
      <video
        src={src}
        poster={poster}
        autoPlay={autoPlay}
        loop={loop}
        muted={muted}
        playsInline
        preload="metadata"
        controlsList="nodownload noremoteplayback"
        disablePictureInPicture
        className="w-full h-full object-cover"
      />
    </MediaShield>
  );
}

/**
 * Получить временный signed URL для медиа из защищённого bucket.
 * TTL 15 минут — после этого ссылка истекает.
 */
import { supabase } from "@/integrations/supabase/client";
export async function createSignedMediaUrl(path: string, ttlSeconds = 900): Promise<string | null> {
  const { data, error } = await supabase.storage.from("media").createSignedUrl(path, ttlSeconds);
  if (error) {
    if (import.meta.env.DEV) console.error("createSignedUrl failed:", error);
    return null;
  }
  return data.signedUrl;
}
