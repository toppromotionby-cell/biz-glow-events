// Массовая загрузка треков: только зона выбора файлов и превью очереди.
// Все метаданные, раздел, форматы и обложка определяются автоматически.
// Непонятный системе материал молча исчезает из очереди — без уведомлений.
import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, UploadCloud, Check } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { djSubmitTrack, djUploadTicket, djCheckDuplicates } from "@/lib/dj/dj.functions";
import { AUDIO_EXTENSIONS, TRACK_VERSION_LABEL, hasAllowedExtension } from "@/lib/dj/types";
import { parseAudioFile } from "@/lib/dj/metadata";
import { analyzeAudio } from "@/lib/dj/analyze";
import { evaluateIngest, type IngestPayload } from "@/lib/dj/ingest-role";
import { hashFile } from "@/lib/dj/dedupe";
import { buildTrackCover } from "@/lib/dj/artwork";
import { coverCssGradient } from "@/lib/dj/cover-role";
import { SECTION_LABEL } from "@/lib/dj/sections";

type QueueItem = {
  id: string;
  file: File;
  payload: IngestPayload;
  cover: Blob | null;
  coverUrl: string | null;
  coverPalette: string | null;
  coverSpecVersion: number | null;
  state: "ready" | "uploading" | "done";
};

const CONCURRENCY = 2;

export function UploadTrackDialog({ invalidateKey }: { invalidateKey: unknown[] }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [analyzing, setAnalyzing] = useState(0);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const seen = useRef<{ hashes: Set<string>; keys: Set<string> }>({ hashes: new Set(), keys: new Set() });

  const reset = useCallback(() => {
    setItems((prev) => {
      for (const i of prev) if (i.coverUrl) URL.revokeObjectURL(i.coverUrl);
      return [];
    });
    seen.current = { hashes: new Set(), keys: new Set() };
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  /** Разбор партии файлов. Всё, что не проходит роль приёма, отбрасывается тихо. */
  const ingest = useCallback(async (fileList: FileList | File[]) => {
    const files = Array.from(fileList).filter((f) => hasAllowedExtension(f.name, AUDIO_EXTENSIONS));
    if (!files.length) return;
    setAnalyzing((n) => n + files.length);

    const accepted: QueueItem[] = [];
    for (const file of files) {
      try {
        const parsed = await parseAudioFile(file);
        const needBpm = !parsed.bpm;
        const [hash, acoustic] = await Promise.all([
          hashFile(file),
          analyzeAudio(file, { needBpm }),
        ]);
        const result = evaluateIngest(parsed, {
          contentHash: hash,
          energy: acoustic.energy,
          bpmFallback: acoustic.bpm,
        });
        if (!result.accept) continue;
        const { payload } = result;
        if (seen.current.hashes.has(payload.content_hash) || seen.current.keys.has(payload.dedupe_key)) continue;
        seen.current.hashes.add(payload.content_hash);
        seen.current.keys.add(payload.dedupe_key);

        let cover: Blob | null = null;
        let coverUrl: string | null = null;
        let coverPalette: string | null = null;
        let coverSpecVersion: number | null = null;
        try {
          const built = await buildTrackCover({
            artist: payload.artist,
            title: payload.title,
            section: payload.section,
            meta: result.coverMeta,
          });
          cover = built.blob;
          coverUrl = URL.createObjectURL(built.blob);
          coverPalette = built.paletteId;
          coverSpecVersion = built.specVersion;
        } catch {
          // Без обложки трек всё равно валиден — она догенерится на витрине.
        }

        accepted.push({
          id: `${payload.content_hash}-${accepted.length}`,
          file,
          payload,
          cover,
          coverUrl,
          coverPalette,
          coverSpecVersion,
          state: "ready",
        });
      } catch {
        // Нечитаемый файл — молча пропускаем.
      } finally {
        setAnalyzing((n) => Math.max(0, n - 1));
      }
    }

    if (!accepted.length) return;

    // Дубликаты, уже лежащие в библиотеке, снимаем так же тихо.
    let taken = { hashes: [] as string[], keys: [] as string[] };
    try {
      taken = await djCheckDuplicates({
        data: {
          hashes: accepted.map((i) => i.payload.content_hash),
          keys: accepted.map((i) => i.payload.dedupe_key),
        },
      });
    } catch {
      // Проверка недоступна — полагаемся на уникальные индексы БД.
    }
    const hashSet = new Set(taken.hashes);
    const keySet = new Set(taken.keys);
    const fresh = accepted.filter((i) => {
      const dup = hashSet.has(i.payload.content_hash) || keySet.has(i.payload.dedupe_key);
      if (dup && i.coverUrl) URL.revokeObjectURL(i.coverUrl);
      return !dup;
    });
    if (fresh.length) setItems((prev) => [...prev, ...fresh]);
  }, []);

  async function uploadOne(item: QueueItem) {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, state: "uploading" } : i)));
    const audioTicket = await djUploadTicket({
      data: { kind: "audio", fileName: item.file.name, fileSize: item.file.size },
    });
    const audioRes = await supabase.storage
      .from(audioTicket.bucket)
      .uploadToSignedUrl(audioTicket.path, audioTicket.token, item.file);
    if (audioRes.error) throw new Error(audioRes.error.message);

    let artworkPath: string | null = null;
    if (item.cover) {
      try {
        const artTicket = await djUploadTicket({
          data: { kind: "artwork", fileName: `${item.payload.content_hash}.jpg`, fileSize: item.cover.size },
        });
        const artRes = await supabase.storage
          .from(artTicket.bucket)
          .uploadToSignedUrl(artTicket.path, artTicket.token, item.cover);
        if (!artRes.error) artworkPath = artTicket.path;
      } catch {
        // Обложка необязательна.
      }
    }

    await djSubmitTrack({
      data: {
        ...item.payload,
        audio_path: audioTicket.path,
        artwork_path: artworkPath,
        file_size: item.file.size,
        cover_palette: item.coverPalette,
        cover_spec_version: item.coverSpecVersion,
      },
    });
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, state: "done" } : i)));
  }

  async function uploadAll() {
    const queue = items.filter((i) => i.state === "ready");
    if (!queue.length) return;
    setBusy(true);
    let ok = 0;
    let failed = 0;
    const cursor = { index: 0 };
    const worker = async () => {
      while (cursor.index < queue.length) {
        const item = queue[cursor.index++];
        if (!item) break;
        try { await uploadOne(item); ok += 1; } catch { failed += 1; }
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
    setBusy(false);
    if (ok) toast.success(`Загружено треков: ${ok}`);
    if (failed) toast.error(`Не удалось загрузить: ${failed}`);
    void qc.invalidateQueries({ queryKey: invalidateKey });
    if (!failed) { reset(); setOpen(false); }
  }

  const readyCount = items.filter((i) => i.state === "ready").length;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (busy) return; setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button><UploadCloud className="mr-2 h-4 w-4" /> Загрузить треки</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Загрузка треков</DialogTitle>
          <DialogDescription>
            Просто выберите файлы или папку. Артист, название, версия, BPM, тональность,
            раздел и обложка определяются автоматически.
          </DialogDescription>
        </DialogHeader>

        <label
          className={cn(
            "glass block cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition",
            busy ? "pointer-events-none opacity-50" : "hover:border-primary/60",
          )}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); if (!busy) void ingest(e.dataTransfer.files); }}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={AUDIO_EXTENSIONS.join(",")}
            className="hidden"
            disabled={busy}
            onChange={(e) => { if (e.target.files) void ingest(e.target.files); }}
          />
          <UploadCloud className="mx-auto mb-2 h-9 w-9 text-muted-foreground" />
          <p className="text-sm font-medium">Перетащите файлы или нажмите</p>
          <p className="mt-1 text-xs text-muted-foreground">
            MP3 · WAV · FLAC · AIFF · M4A — можно сразу папкой
          </p>
        </label>

        {analyzing > 0 && (
          <div className="space-y-2">
            <Progress value={undefined} />
            <p className="text-xs text-muted-foreground">Анализируем метаданные… осталось {analyzing}</p>
          </div>
        )}

        {items.length > 0 && (
          <div className="max-h-[46vh] space-y-2 overflow-y-auto pr-1">
            {items.map((i) => (
              <PreviewRow key={i.id} item={i} />
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); setOpen(false); }} disabled={busy}>Отмена</Button>
          <Button onClick={() => void uploadAll()} disabled={busy || readyCount === 0}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
            Загрузить{readyCount ? ` (${readyCount})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PreviewRow({ item }: { item: QueueItem }) {
  const p = item.payload;
  const meta = [
    p.version_label || (p.version !== "original" ? TRACK_VERSION_LABEL[p.version] : null),
    p.bpm ? `${p.bpm} BPM` : null,
    p.key_camelot,
    SECTION_LABEL[p.section] ?? p.section,
    p.formats.length ? `${p.formats.length} формат(а)` : null,
  ].filter(Boolean).join(" · ");

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/60 p-2">
      <div
        className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-muted"
        style={item.coverUrl ? undefined : { backgroundImage: coverCssGradient({ artist: p.artist, title: p.title, section: p.section }) }}
      >
        {item.coverUrl && <img src={item.coverUrl} alt="" className="h-full w-full object-cover" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{p.artist} — {p.title}</p>
        <p className="truncate text-xs text-muted-foreground">{meta}</p>
      </div>
      {item.state === "uploading" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      {item.state === "done" && <Check className="h-4 w-4 text-primary" />}
    </div>
  );
}
