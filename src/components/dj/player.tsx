// Глобальный плеер DJ-раздела: очередь, волна, громкость. Только клиент.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, X, ListMusic } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CoverArt } from "@/components/dj/CoverArt";
import { Waveform } from "@/components/dj/Waveform";
import { cn } from "@/lib/utils";
import { djStreamUrl } from "@/lib/dj/dj.functions";
import { formatDuration, trackFullTitle, type DjTrack } from "@/lib/dj/types";
import { toast } from "sonner";


type PlayerState = {
  current: DjTrack | null;
  playing: boolean;
  queue: DjTrack[];
  play: (track: DjTrack, queue?: DjTrack[]) => void;
  toggle: () => void;
  stop: () => void;
};

const Ctx = createContext<PlayerState | null>(null);

export function useDjPlayer(): PlayerState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useDjPlayer вне DjPlayerProvider");
  return ctx;
}

export function DjPlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [current, setCurrent] = useState<DjTrack | null>(null);
  const [queue, setQueue] = useState<DjTrack[]>([]);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.9);
  const [muted, setMuted] = useState(false);

  const load = useCallback(async (track: DjTrack) => {
    try {
      const { url } = await djStreamUrl({ data: { id: track.id } });
      const audio = audioRef.current;
      if (!audio) return;
      audio.src = url;
      audio.volume = muted ? 0 : volume;
      await audio.play();
      setPlaying(true);
    } catch (e) {
      setPlaying(false);
      toast.error(e instanceof Error ? e.message : "Не удалось воспроизвести трек");
    }
  }, [muted, volume]);

  const play = useCallback((track: DjTrack, nextQueue?: DjTrack[]) => {
    setCurrent(track);
    if (nextQueue) setQueue(nextQueue);
    void load(track);
  }, [load]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !current) return;
    if (audio.paused) { void audio.play(); setPlaying(true); }
    else { audio.pause(); setPlaying(false); }
  }, [current]);

  const step = useCallback((delta: number) => {
    if (!current || queue.length === 0) return;
    const i = queue.findIndex((t) => t.id === current.id);
    const next = queue[(i + delta + queue.length) % queue.length];
    if (next) play(next, queue);
  }, [current, queue, play]);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    setPlaying(false);
    setCurrent(null);
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.volume = muted ? 0 : volume;
  }, [volume, muted]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (e.code === "Space" && current) { e.preventDefault(); toggle(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, toggle]);

  const value = useMemo<PlayerState>(
    () => ({ current, playing, queue, play, toggle, stop }),
    [current, playing, queue, play, toggle, stop],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <audio
        ref={audioRef}
        preload="none"
        onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onEnded={() => step(1)}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
      />
      {current && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-primary/25 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="h-0.5 w-full bg-gradient-to-r from-primary via-accent to-primary opacity-70" />
          <div className="page-shell flex flex-col gap-2 py-3 md:flex-row md:items-center md:gap-4">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg">
                <CoverArt track={current} rounded="rounded-lg" showFallbackText={false} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{trackFullTitle(current)}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {current.genre ?? "—"} · {current.bpm ? `${current.bpm} BPM` : "BPM —"} · {current.key_camelot ?? "—"}
                </p>
              </div>
              {playing && (
                <span className="dj-eq ml-1 hidden text-primary sm:inline-flex" aria-hidden><i /><i /><i /><i /></span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button size="icon" variant="ghost" onClick={() => step(-1)} aria-label="Предыдущий трек"><SkipBack className="h-4 w-4" /></Button>
              <Button
                size="icon"
                onClick={toggle}
                aria-label={playing ? "Пауза" : "Играть"}
                className="h-11 w-11 rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-glow hover:opacity-90"
              >
                {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 translate-x-0.5" />}
              </Button>
              <Button size="icon" variant="ghost" onClick={() => step(1)} aria-label="Следующий трек"><SkipForward className="h-4 w-4" /></Button>
            </div>

            <div className="flex flex-[1.4] items-center gap-3">
              <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">{formatDuration(progress)}</span>
              <Waveform
                seedKey={current.id}
                progress={duration ? progress / duration : 0}
                onSeek={(ratio) => {
                  const audio = audioRef.current;
                  if (audio && duration) audio.currentTime = ratio * duration;
                }}
                height={36}
              />
              <span className="w-10 text-xs tabular-nums text-muted-foreground">{formatDuration(duration)}</span>
            </div>

            <div className="hidden items-center gap-2 md:flex">
              <Popover>
                <PopoverTrigger asChild>
                  <Button size="icon" variant="ghost" aria-label="Очередь воспроизведения">
                    <ListMusic className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80 p-0">
                  <p className="border-b border-border/60 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Очередь · {queue.length}
                  </p>
                  <ul className="max-h-72 overflow-y-auto py-1">
                    {queue.length === 0 && <li className="px-3 py-4 text-sm text-muted-foreground">Очередь пуста</li>}
                    {queue.map((t) => (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={() => play(t, queue)}
                          className={cn(
                            "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/60",
                            t.id === current.id && "bg-primary/10 text-primary",
                          )}
                        >
                          <span className="truncate">{trackFullTitle(t)}</span>
                          <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">
                            {formatDuration(t.duration_sec)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </PopoverContent>
              </Popover>
              <Button size="icon" variant="ghost" onClick={() => setMuted((m) => !m)} aria-label="Звук">
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </Button>
              <div className="w-24">
                <Slider value={[muted ? 0 : volume * 100]} max={100} onValueChange={([v]) => { setMuted(false); setVolume(Number(v) / 100); }} aria-label="Громкость" />
              </div>
              <Button size="icon" variant="ghost" onClick={stop} aria-label="Закрыть плеер"><X className="h-4 w-4" /></Button>
            </div>
          </div>
        </div>
      )}

    </Ctx.Provider>
  );
}
