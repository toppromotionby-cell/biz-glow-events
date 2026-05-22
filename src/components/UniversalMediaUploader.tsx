// UniversalMediaUploader — drag&drop + строгий лимит ≤5 фото и ≤5 видео.
// Валидация MIME и размера. Загрузка в Supabase Storage bucket `media`,
// путь: /{entity}/{slug}/{type}-{timestamp}-{name}.
// Возвращает массивы публичных путей (для signed URL на фронте).
import { useCallback, useState } from "react";
import { Upload, X, Image as ImageIcon, Video, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const MAX_PHOTOS = 5;
const MAX_VIDEOS = 5;
const MAX_PHOTO_SIZE = 5 * 1024 * 1024;       // 5 MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024;      // 50 MB
const PHOTO_MIMES = ["image/jpeg", "image/png", "image/webp"];
const VIDEO_MIMES = ["video/mp4", "video/webm"];

export interface MediaUploaderProps {
  entity: string;          // например "zones"
  slug: string;            // slug сущности
  photoUrls: string[];
  videoUrls: string[];
  onChange: (next: { photoUrls: string[]; videoUrls: string[] }) => void;
}

export function UniversalMediaUploader({
  entity, slug, photoUrls, videoUrls, onChange,
}: MediaUploaderProps) {
  const [uploading, setUploading] = useState(false);

  const uploadFiles = useCallback(async (files: FileList | File[], kind: "photo" | "video") => {
    setUploading(true);
    try {
      const arr = Array.from(files);
      const limit = kind === "photo" ? MAX_PHOTOS : MAX_VIDEOS;
      const current = kind === "photo" ? photoUrls : videoUrls;
      const maxSize = kind === "photo" ? MAX_PHOTO_SIZE : MAX_VIDEO_SIZE;
      const mimes = kind === "photo" ? PHOTO_MIMES : VIDEO_MIMES;

      if (current.length + arr.length > limit) {
        toast.error(`Максимум ${limit} ${kind === "photo" ? "фото" : "видео"}`);
        return;
      }

      const uploaded: string[] = [];
      for (const file of arr) {
        if (!mimes.includes(file.type)) {
          toast.error(`Неверный формат: ${file.name}`);
          continue;
        }
        if (file.size > maxSize) {
          toast.error(`Файл слишком большой: ${file.name}`);
          continue;
        }
        const path = `${entity}/${slug}/${kind}-${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
        const { error } = await supabase.storage.from("media").upload(path, file, {
          upsert: false,
          contentType: file.type,
        });
        if (error) {
          toast.error(`Ошибка загрузки ${file.name}: ${error.message}`);
          continue;
        }
        uploaded.push(path);
      }

      if (kind === "photo") onChange({ photoUrls: [...photoUrls, ...uploaded], videoUrls });
      else onChange({ photoUrls, videoUrls: [...videoUrls, ...uploaded] });

      if (uploaded.length) toast.success(`Загружено: ${uploaded.length}`);
    } finally {
      setUploading(false);
    }
  }, [entity, slug, photoUrls, videoUrls, onChange]);

  const remove = async (path: string, kind: "photo" | "video") => {
    await supabase.storage.from("media").remove([path]);
    if (kind === "photo") onChange({ photoUrls: photoUrls.filter(p => p !== path), videoUrls });
    else onChange({ photoUrls, videoUrls: videoUrls.filter(p => p !== path) });
  };

  return (
    <div className="space-y-6">
      <DropZone
        kind="photo"
        label="Фотографии"
        icon={<ImageIcon className="h-5 w-5" />}
        count={photoUrls.length}
        limit={MAX_PHOTOS}
        accept="image/jpeg,image/png,image/webp"
        items={photoUrls}
        disabled={uploading}
        onFiles={(f) => uploadFiles(f, "photo")}
        onRemove={(p) => remove(p, "photo")}
      />
      <DropZone
        kind="video"
        label="Видео"
        icon={<Video className="h-5 w-5" />}
        count={videoUrls.length}
        limit={MAX_VIDEOS}
        accept="video/mp4,video/webm"
        items={videoUrls}
        disabled={uploading}
        onFiles={(f) => uploadFiles(f, "video")}
        onRemove={(p) => remove(p, "video")}
      />
    </div>
  );
}

function DropZone({
  kind, label, icon, count, limit, accept, items, disabled, onFiles, onRemove,
}: {
  kind: "photo" | "video";
  label: string;
  icon: React.ReactNode;
  count: number;
  limit: number;
  accept: string;
  items: string[];
  disabled: boolean;
  onFiles: (files: FileList) => void;
  onRemove: (path: string) => void;
}) {
  const full = count >= limit;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="flex items-center gap-2 text-sm font-medium">{icon} {label}</h4>
        <span className={cn("text-xs", full ? "text-destructive" : "text-muted-foreground")}>
          {count} / {limit}
        </span>
      </div>
      <label
        className={cn(
          "glass rounded-xl border-2 border-dashed p-6 text-center cursor-pointer block transition",
          full || disabled ? "opacity-50 cursor-not-allowed" : "hover:border-primary/50",
        )}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (!full && !disabled) onFiles(e.dataTransfer.files);
        }}
      >
        <input
          type="file"
          multiple
          accept={accept}
          disabled={full || disabled}
          className="hidden"
          onChange={(e) => e.target.files && onFiles(e.target.files)}
        />
        <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm">
          {full ? <><AlertCircle className="inline h-4 w-4 mr-1" />Достигнут лимит</> : "Перетащите файлы или нажмите"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {kind === "photo" ? "JPEG/PNG/WebP, ≤5MB" : "MP4/WebM, ≤50MB"}
        </p>
      </label>
      {items.length > 0 && (
        <div className="grid grid-cols-5 gap-2">
          {items.map((path) => (
            <div key={path} className="relative aspect-square glass rounded-md overflow-hidden group">
              <div className="flex items-center justify-center h-full text-xs text-muted-foreground truncate p-1">
                {path.split("/").pop()}
              </div>
              <button
                type="button"
                onClick={() => onRemove(path)}
                className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition"
                aria-label="Удалить"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
