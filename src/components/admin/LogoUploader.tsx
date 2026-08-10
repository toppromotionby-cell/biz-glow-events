// LogoUploader — загрузка логотипа в любом формате с автоматической нормализацией.
// Файл читается браузером (PNG/JPEG/WebP/AVIF/GIF/BMP/SVG), обрезаются пустые
// прозрачные поля, картинка вписывается в LOGO_BOX и сохраняется как PNG
// в публичный бакет `catalog-media` (папка documents/logos).
import { useRef, useState } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const LOGO_MAX_W = 600;
export const LOGO_MAX_H = 200;
const MAX_INPUT_BYTES = 15 * 1024 * 1024;

export const LOGO_ACCEPT =
  "image/png,image/jpeg,image/webp,image/avif,image/gif,image/bmp,image/svg+xml,.png,.jpg,.jpeg,.webp,.avif,.gif,.bmp,.svg";

async function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = url;
    await img.decode();
    return img;
  } finally {
    // URL освобождаем после decode — картинка уже растеризована
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

/** Обрезает полностью прозрачные поля по краям. */
function trimAlpha(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const { width: w, height: h } = canvas;
  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, w, h).data;
  } catch {
    return canvas;
  }
  let top = h, left = w, right = -1, bottom = -1;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (data[(y * w + x) * 4 + 3] > 8) {
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }
  if (right < 0 || bottom < 0) return canvas;
  const nw = right - left + 1;
  const nh = bottom - top + 1;
  if (nw === w && nh === h) return canvas;
  const out = document.createElement("canvas");
  out.width = nw;
  out.height = nh;
  out.getContext("2d")?.drawImage(canvas, left, top, nw, nh, 0, 0, nw, nh);
  return out;
}

export type NormalizedLogo = { blob: Blob; width: number; height: number; sourceWidth: number };

/** Приводит любой поддерживаемый браузером формат к PNG, вписанному в LOGO_MAX_W×LOGO_MAX_H. */
export async function normalizeLogoFile(file: File): Promise<NormalizedLogo> {
  if (file.size > MAX_INPUT_BYTES) throw new Error("Файл больше 15 МБ");
  const isSvg = file.type === "image/svg+xml" || /\.svg$/i.test(file.name);
  const img = await loadImage(file);

  // SVG может не иметь внутренних размеров — рендерим сразу в целевом боксе
  let sw = img.naturalWidth || img.width;
  let sh = img.naturalHeight || img.height;
  if (!sw || !sh) { sw = LOGO_MAX_W; sh = LOGO_MAX_H; }
  if (isSvg) {
    const k = Math.min(LOGO_MAX_W / sw, LOGO_MAX_H / sh);
    sw = Math.max(1, Math.round(sw * k * 2)); // ×2 — запас качества для печати
    sh = Math.max(1, Math.round(sh * k * 2));
  }

  const raw = document.createElement("canvas");
  raw.width = sw;
  raw.height = sh;
  const rctx = raw.getContext("2d");
  if (!rctx) throw new Error("Canvas недоступен");
  rctx.imageSmoothingQuality = "high";
  rctx.drawImage(img, 0, 0, sw, sh);

  const trimmed = trimAlpha(raw);
  const k = Math.min(LOGO_MAX_W / trimmed.width, LOGO_MAX_H / trimmed.height);
  const tw = Math.max(1, Math.round(trimmed.width * k));
  const th = Math.max(1, Math.round(trimmed.height * k));

  const out = document.createElement("canvas");
  out.width = tw;
  out.height = th;
  const octx = out.getContext("2d");
  if (!octx) throw new Error("Canvas недоступен");
  octx.imageSmoothingQuality = "high";
  octx.drawImage(trimmed, 0, 0, tw, th);

  const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Не удалось обработать изображение");
  return { blob, width: tw, height: th, sourceWidth: trimmed.width };
}

export async function uploadNormalizedLogo(file: File, folder = "documents/logos"): Promise<{ url: string; width: number; height: number; bytes: number; lowRes: boolean }> {
  const norm = await normalizeLogoFile(file);
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
  const { error } = await supabase.storage.from("catalog-media").upload(path, norm.blob, {
    upsert: true,
    contentType: "image/png",
    cacheControl: "31536000",
  });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from("catalog-media").getPublicUrl(path);
  return {
    url: data.publicUrl,
    width: norm.width,
    height: norm.height,
    bytes: norm.blob.size,
    lowRes: norm.sourceWidth < 200,
  };
}

export function LogoUploader({
  label = "Логотип",
  hint,
  value,
  onChange,
  className,
}: {
  label?: string;
  hint?: string;
  value: string | null;
  onChange: (url: string | null) => void;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [meta, setMeta] = useState<{ w: number; h: number; kb: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handle = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const res = await uploadNormalizedLogo(file);
      onChange(res.url);
      setMeta({ w: res.width, h: res.height, kb: Math.round(res.bytes / 1024) });
      if (res.lowRes) toast.warning("Логотип небольшого разрешения — в PDF может быть нечётким");
      else toast.success("Логотип загружен и подогнан по размеру");
    } catch (e) {
      toast.error((e as Error).message || "Не удалось загрузить логотип");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); void handle(e.dataTransfer.files?.[0]); }}
        className={cn(
          "flex items-center gap-3 rounded-lg border border-dashed border-border/70 bg-background/40 p-3 transition",
          drag && "border-primary/60 bg-primary/5",
        )}
      >
        <div className="flex h-12 w-24 shrink-0 items-center justify-center overflow-hidden rounded border border-border/60 bg-background">
          {value ? (
            <img src={value} alt={label} className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="text-[10px] text-muted-foreground">нет</span>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
              {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1 h-3.5 w-3.5" />}
              {busy ? "Обработка…" : value ? "Заменить" : "Загрузить"}
            </Button>
            {value && (
              <Button type="button" size="sm" variant="ghost" onClick={() => { onChange(null); setMeta(null); }}>
                <X className="mr-1 h-3.5 w-3.5" /> Убрать
              </Button>
            )}
          </div>
          <p className="text-[11px] leading-tight text-muted-foreground">
            {hint ?? `Любой формат (PNG, JPG, WebP, SVG…). Автоматически обрежется и подгонится под ${LOGO_MAX_W}×${LOGO_MAX_H}px.`}
            {meta ? ` · ${meta.w}×${meta.h}px, ${meta.kb} КБ` : ""}
          </p>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={LOGO_ACCEPT}
        className="hidden"
        onChange={(e) => { void handle(e.target.files?.[0]); e.target.value = ""; }}
      />
    </div>
  );
}
