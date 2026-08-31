// Загрузка трека участником клуба: файл идёт в приватный бакет по одноразовой ссылке.
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, UploadCloud } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { djSubmitTrack, djUploadTicket } from "@/lib/dj/dj.functions";
import {
  AUDIO_EXTENSIONS, CAMELOT_KEYS, GENRES, LANGUAGES, TRACK_VERSIONS, TRACK_VERSION_LABEL,
  hasAllowedExtension,
} from "@/lib/dj/types";

const NONE = "__none__";

export function UploadTrackDialog({ invalidateKey }: { invalidateKey: unknown[] }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<string>("");
  const fileRef = useRef<HTMLInputElement | null>(null);
  const artRef = useRef<HTMLInputElement | null>(null);

  const [form, setForm] = useState({
    artist: "", title: "", version: "original",
    genre: "", key_camelot: "", language: "",
    bpm: "", year: "",
  });
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function readDuration(file: File): Promise<number | null> {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const audio = new Audio();
      audio.preload = "metadata";
      audio.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(Math.round(audio.duration) || null); };
      audio.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
      audio.src = url;
    });
  }

  async function uploadFile(kind: "audio" | "artwork", file: File): Promise<string> {
    const ticket = await djUploadTicket({ data: { kind, fileName: file.name, fileSize: file.size } });
    const { error } = await supabase.storage.from(ticket.bucket).uploadToSignedUrl(ticket.path, ticket.token, file);
    if (error) throw new Error(error.message);
    return ticket.path;
  }

  async function submit() {
    const file = fileRef.current?.files?.[0];
    if (!file) { toast.error("Выберите аудиофайл"); return; }
    if (!hasAllowedExtension(file.name, AUDIO_EXTENSIONS)) {
      toast.error(`Допустимые форматы: ${AUDIO_EXTENSIONS.join(", ")}`);
      return;
    }
    if (!form.artist.trim() || !form.title.trim()) { toast.error("Заполните артиста и название"); return; }

    setBusy(true);
    try {
      setStage("Загружаем аудио…");
      const audioPath = await uploadFile("audio", file);

      let artworkPath: string | null = null;
      const art = artRef.current?.files?.[0];
      if (art) {
        setStage("Загружаем обложку…");
        artworkPath = await uploadFile("artwork", art);
      }

      setStage("Сохраняем карточку…");
      const duration = await readDuration(file);
      const res = await djSubmitTrack({
        data: {
          artist: form.artist,
          title: form.title,
          version: form.version as (typeof TRACK_VERSIONS)[number],
          genre: form.genre || null,
          key_camelot: form.key_camelot || null,
          language: form.language || null,
          bpm: form.bpm ? Number(form.bpm) : null,
          year: form.year ? Number(form.year) : null,
          duration_sec: duration,
          tags: [],
          audio_path: audioPath,
          artwork_path: artworkPath,
          format: file.name.split(".").pop()?.toLowerCase() ?? null,
          file_size: file.size,
        },
      });
      toast.success(res.status === "published" ? "Трек опубликован" : "Трек отправлен на модерацию");
      setOpen(false);
      setForm({ artist: "", title: "", version: "original", genre: "", key_camelot: "", language: "", bpm: "", year: "" });
      if (fileRef.current) fileRef.current.value = "";
      if (artRef.current) artRef.current.value = "";
      void qc.invalidateQueries({ queryKey: invalidateKey });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось загрузить трек");
    } finally {
      setBusy(false);
      setStage("");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
      <DialogTrigger asChild>
        <Button><UploadCloud className="mr-2 h-4 w-4" /> Загрузить трек</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Загрузка трека</DialogTitle>
          <DialogDescription>Файл увидят только участники клуба. Новые загрузки проходят модерацию.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="dj-file">Аудиофайл *</Label>
            <Input id="dj-file" ref={fileRef} type="file" accept={AUDIO_EXTENSIONS.join(",")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dj-artist">Артист *</Label>
            <Input id="dj-artist" value={form.artist} onChange={(e) => set("artist", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dj-title">Название *</Label>
            <Input id="dj-title" value={form.title} onChange={(e) => set("title", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Версия</Label>
            <Select value={form.version} onValueChange={(v) => set("version", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-64">
                {TRACK_VERSIONS.map((v) => <SelectItem key={v} value={v}>{TRACK_VERSION_LABEL[v]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Жанр</Label>
            <Select value={form.genre || NONE} onValueChange={(v) => set("genre", v === NONE ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Не указан" /></SelectTrigger>
              <SelectContent className="max-h-64">
                <SelectItem value={NONE}>Не указан</SelectItem>
                {GENRES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dj-bpm">BPM</Label>
            <Input id="dj-bpm" type="number" min={40} max={300} value={form.bpm} onChange={(e) => set("bpm", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Тональность</Label>
            <Select value={form.key_camelot || NONE} onValueChange={(v) => set("key_camelot", v === NONE ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Не указана" /></SelectTrigger>
              <SelectContent className="max-h-64">
                <SelectItem value={NONE}>Не указана</SelectItem>
                {CAMELOT_KEYS.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dj-year">Год</Label>
            <Input id="dj-year" type="number" min={1900} max={2100} value={form.year} onChange={(e) => set("year", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Язык</Label>
            <Select value={form.language || NONE} onValueChange={(v) => set("language", v === NONE ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Не указан" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Не указан</SelectItem>
                {LANGUAGES.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="dj-art">Обложка (необязательно)</Label>
            <Input id="dj-art" ref={artRef} type="file" accept="image/*" />
          </div>
        </div>

        {busy && (
          <div className="space-y-2">
            <Progress value={undefined} />
            <p className="text-xs text-muted-foreground">{stage}</p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Отмена</Button>
          <Button onClick={() => void submit()} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
            Отправить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
