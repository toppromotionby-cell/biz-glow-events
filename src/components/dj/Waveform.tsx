// Псевдо-волна прогресса: рисунок детерминирован сидом трека, поэтому стабилен.
import { useEffect, useMemo, useRef } from "react";
import { coverSeed } from "@/lib/dj/cover-role";
import { cn } from "@/lib/utils";

const BARS = 120;

function buildPeaks(seed: number): number[] {
  let a = seed || 1;
  const rnd = () => {
    a = (a * 1664525 + 1013904223) % 4294967296;
    return a / 4294967296;
  };
  const peaks: number[] = [];
  for (let i = 0; i < BARS; i += 1) {
    const t = i / BARS;
    // Огибающая: тише в начале и конце, плотнее в середине — как у клубного трека.
    const envelope = 0.42 + 0.58 * Math.sin(Math.PI * Math.min(1, Math.max(0, (t - 0.02) / 0.96)));
    const beat = 0.75 + 0.25 * Math.abs(Math.sin(t * Math.PI * 16));
    peaks.push(Math.min(1, Math.max(0.1, envelope * beat * (0.65 + rnd() * 0.5))));
  }
  return peaks;
}

export function Waveform({
  seedKey,
  progress,
  onSeek,
  className,
  height = 40,
}: {
  seedKey: string;
  /** 0..1 */
  progress: number;
  onSeek?: (ratio: number) => void;
  className?: string;
  height?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const peaks = useMemo(() => buildPeaks(coverSeed(seedKey)), [seedKey]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    const width = parent?.clientWidth ?? 320;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = "100%";
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const style = getComputedStyle(canvas);
    const played = style.getPropertyValue("--wave-played").trim() || "#ff8a3d";
    const rest = style.getPropertyValue("--wave-rest").trim() || "rgba(255,255,255,0.22)";

    const gap = 1.5;
    const bw = Math.max(1, width / BARS - gap);
    peaks.forEach((p, i) => {
      const x = i * (bw + gap);
      const h = Math.max(2, p * (height - 4));
      ctx.fillStyle = i / BARS <= progress ? played : rest;
      const y = (height - h) / 2;
      ctx.beginPath();
      const r = Math.min(bw / 2, 1.5);
      ctx.roundRect(x, y, bw, h, r);
      ctx.fill();
    });
  }, [peaks, progress, height]);

  return (
    <div
      className={cn("relative w-full select-none", onSeek && "cursor-pointer", className)}
      onClick={(e) => {
        if (!onSeek) return;
        const rect = e.currentTarget.getBoundingClientRect();
        onSeek(Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)));
      }}
      role={onSeek ? "slider" : undefined}
      aria-label={onSeek ? "Перемотка трека" : undefined}
      aria-valuenow={Math.round(progress * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      tabIndex={onSeek ? 0 : undefined}
      onKeyDown={(e) => {
        if (!onSeek) return;
        if (e.key === "ArrowRight") onSeek(Math.min(1, progress + 0.02));
        if (e.key === "ArrowLeft") onSeek(Math.max(0, progress - 0.02));
      }}
      style={{
        // Токены дизайн-системы прокидываем в canvas через CSS-переменные.
        ["--wave-played" as string]: "var(--primary)",
        ["--wave-rest" as string]: "color-mix(in oklab, var(--foreground) 22%, transparent)",
      }}
    >
      <canvas ref={canvasRef} />
    </div>
  );
}
