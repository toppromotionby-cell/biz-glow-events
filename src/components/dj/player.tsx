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

  const value = useMemo<PlayerState>(() => ({ current, playing, play, toggle, stop }), [current, playing, play, toggle, stop]);

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
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="container mx-auto flex flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:gap-4">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{trackFullTitle(current)}</p>
              <p className="text-xs text-muted-foreground">
                {current.genre ?? "—"} · {current.bpm ? `${current.bpm} BPM` : "BPM —"} · {current.key_camelot ?? "—"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="icon" variant="ghost" onClick={() => step(-1)} aria-label="Предыдущий трек"><SkipBack className="h-4 w-4" /></Button>
              <Button size="icon" onClick={toggle} aria-label={playing ? "Пауза" : "Играть"}>
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <Button size="icon" variant="ghost" onClick={() => step(1)} aria-label="Следующий трек"><SkipForward className="h-4 w-4" /></Button>
            </div>
            <div className="flex flex-1 items-center gap-3">
              <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">{formatDuration(progress)}</span>
              <Slider
                value={[duration ? (progress / duration) * 100 : 0]}
                max={100}
                step={0.1}
                onValueChange={([v]) => {
                  const audio = audioRef.current;
                  if (audio && duration) audio.currentTime = (Number(v) / 100) * duration;
                }}
                aria-label="Позиция воспроизведения"
              />
              <span className="w-10 text-xs tabular-nums text-muted-foreground">{formatDuration(duration)}</span>
            </div>
            <div className="hidden items-center gap-2 md:flex">
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
