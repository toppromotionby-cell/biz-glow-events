// Подготовка загрузки файлов DJ-раздела: сервер выдаёт одноразовую ссылку на upload.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  AUDIO_EXTENSIONS,
  IMAGE_EXTENSIONS,
  SOFTWARE_EXTENSIONS,
  hasAllowedExtension,
} from "./types";

export type UploadKind = "audio" | "software" | "artwork";

const BUCKETS: Record<UploadKind, string> = {
  audio: "dj-audio",
  software: "dj-software",
  artwork: "dj-artwork",
};

const ALLOWED: Record<UploadKind, string[]> = {
  audio: AUDIO_EXTENSIONS,
  software: SOFTWARE_EXTENSIONS,
  artwork: IMAGE_EXTENSIONS,
};

const MAX_BYTES: Record<UploadKind, number> = {
  audio: 200 * 1024 * 1024,
  software: 2 * 1024 * 1024 * 1024,
  artwork: 10 * 1024 * 1024,
};

function safeName(name: string): string {
  const base = name.normalize("NFKD").replace(/[^\w.\-]+/g, "_").replace(/_+/g, "_");
  return base.slice(-120) || "file";
}

export async function createUploadTicket(
  userId: string,
  kind: UploadKind,
  fileName: string,
  fileSize: number,
): Promise<{ bucket: string; path: string; token: string }> {
  if (!hasAllowedExtension(fileName, ALLOWED[kind])) {
    throw new Error(`Недопустимый тип файла. Разрешено: ${ALLOWED[kind].join(", ")}`);
  }
  if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > MAX_BYTES[kind]) {
    throw new Error("Файл слишком большой или повреждён");
  }
  const bucket = BUCKETS[kind];
  const path = `${userId}/${Date.now()}-${safeName(fileName)}`;
  const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUploadUrl(path);
  if (error || !data) throw new Error(error?.message ?? "Не удалось подготовить загрузку");
  return { bucket, path, token: data.token };
}

export async function removeStoredFile(bucket: string, path: string | null | undefined): Promise<void> {
  if (!path) return;
  await supabaseAdmin.storage.from(bucket).remove([path]);
}
