// Обложка трека: реальная картинка либо плейсхолдер по той же роли оформления.
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { coverCssGradient } from "@/lib/dj/cover-role";
import { SECTION_LABEL } from "@/lib/dj/sections";

export type CoverSubjectLike = {
  artist: string;
  title: string;
  section?: string | null;
  artwork_url?: string | null;
};

export function CoverArt({
  track,
  className,
  rounded = "rounded-xl",
  showFallbackText = true,
}: {
  track: CoverSubjectLike;
  className?: string;
  rounded?: string;
  showFallbackText?: boolean;
}) {
  const gradient = useMemo(
    () => coverCssGradient({ artist: track.artist, title: track.title, section: track.section }),
    [track.artist, track.title, track.section],
  );

  if (track.artwork_url) {
    return (
      <img
        src={track.artwork_url}
        alt={`Обложка: ${track.artist} — ${track.title}`}
        loading="lazy"
        decoding="async"
        className={cn("h-full w-full object-cover", rounded, className)}
      />
    );
  }

  return (
    <div
      className={cn("dj-grain relative flex h-full w-full flex-col justify-end overflow-hidden p-3", rounded, className)}
      style={{ backgroundImage: gradient }}
      role="img"
      aria-label={`Обложка: ${track.artist} — ${track.title}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-black/25" />
      {showFallbackText && (
        <div className="relative">
          <p className="truncate text-[0.6rem] font-semibold uppercase tracking-wider text-white/75">
            {track.artist}
          </p>
          <p className="line-clamp-2 text-sm font-bold leading-tight text-white">{track.title}</p>
          <p className="mt-1 text-[0.55rem] font-medium uppercase tracking-wide text-white/60">
            {track.section ? SECTION_LABEL[track.section] ?? "event-hub.by" : "event-hub.by"}
          </p>
        </div>
      )}
    </div>
  );
}
