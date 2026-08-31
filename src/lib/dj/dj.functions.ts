// Серверные функции DJ-клуба. Файл — только тонкие обёртки (правило splitting).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { loadDjAccess, requireMember, requireTrusted, assertRateLimit } from "@/lib/dj/guard.server";
import {
  listTracks,
  getTrack,
  trackAudioUrl,
  bumpCounter,
  listSoftware,
  softwareDownloadUrl,
  listCategories,
  loadShowcase,
} from "@/lib/dj/library.server";
import { rateTrack, toggleFavorite } from "@/lib/dj/social.server";
import { applyForMembership } from "@/lib/dj/members.server";
import { createUploadTicket } from "@/lib/dj/upload.server";
import { insertTrack, findExistingDuplicates } from "@/lib/dj/moderation.server";
import { TRACK_VERSIONS } from "@/lib/dj/types";

const filtersSchema = z.object({
  q: z.string().max(120).optional(),
  section: z.string().max(30).optional(),
  categoryId: z.string().uuid().optional(),
  formatSlug: z.string().max(30).optional(),
  genres: z.array(z.string().max(60)).max(30).optional(),
  genre: z.string().max(60).optional(),
  version: z.string().max(40).optional(),
  language: z.string().max(40).optional(),
  bpmMin: z.number().int().min(40).max(300).optional(),
  bpmMax: z.number().int().min(40).max(300).optional(),
  key: z.string().max(4).optional(),
  yearMin: z.number().int().min(1900).max(2200).optional(),
  yearMax: z.number().int().min(1900).max(2200).optional(),
  freshDays: z.number().int().min(1).max(365).optional(),
  favoritesOnly: z.boolean().optional(),
  sort: z.enum(["new", "rating", "popular", "artist", "bpm"]).optional(),
  page: z.number().int().min(1).max(500).optional(),
  pageSize: z.number().int().min(6).max(100).optional(),
  status: z.enum(["draft", "pending", "published", "rejected", "all"]).optional(),
});

export const djMyAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => loadDjAccess(context.userId));

export const djApply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      nickname: z.string().trim().min(2).max(60),
      city: z.string().trim().max(80).optional(),
      bio: z.string().trim().max(1000).optional(),
      contact: z.string().trim().max(200).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => applyForMembership(context.userId, data));

export const djListTracks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => filtersSchema.parse(d ?? {}))
  .handler(async ({ data, context }) => listTracks(await requireMember(context.userId), data));

export const djGetTrack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => getTrack(await requireMember(context.userId), data.id));

export const djStreamUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const access = await requireMember(context.userId);
    const url = await trackAudioUrl(access, data.id);
    await bumpCounter(data.id, "play_count");
    return { url };
  });

export const djDownloadTrack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const access = await requireMember(context.userId);
    await assertRateLimit("dj_downloads", "user_id", access.userId, 120, 60);
    const url = await trackAudioUrl(access, data.id, true);
    await bumpCounter(data.id, "download_count");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("dj_downloads").insert({ user_id: access.userId, target_type: "track", target_id: data.id });
    return { url };
  });

export const djRate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), value: z.number().int().min(1).max(5) }).parse(d))
  .handler(async ({ data, context }) => {
    await rateTrack(await requireMember(context.userId), data.id, data.value);
    return { ok: true };
  });

export const djToggleFavorite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => ({
    favorite: await toggleFavorite(await requireMember(context.userId), data.id),
  }));

export const djListSoftware = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      q: z.string().max(120).optional(),
      category: z.string().max(40).optional(),
      platform: z.string().max(40).optional(),
    }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => listSoftware(await requireMember(context.userId), data));

export const djSoftwareDownload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ versionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const access = await requireMember(context.userId);
    await assertRateLimit("dj_downloads", "user_id", access.userId, 120, 60);
    const url = await softwareDownloadUrl(access, data.versionId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("dj_downloads").insert({ user_id: access.userId, target_type: "software", target_id: data.versionId });
    return { url };
  });

export const djUploadTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      kind: z.enum(["audio", "software", "artwork"]),
      fileName: z.string().min(1).max(200),
      fileSize: z.number().int().positive(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const access = await requireTrusted(context.userId);
    return createUploadTicket(access.userId, data.kind, data.fileName, data.fileSize);
  });

export const djSubmitTrack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      artist: z.string().trim().min(1).max(160),
      title: z.string().trim().min(1).max(200),
      version: z.enum(TRACK_VERSIONS).default("original"),
      genre: z.string().max(60).nullish(),
      bpm: z.number().int().min(40).max(300).nullish(),
      key_camelot: z.string().max(4).nullish(),
      year: z.number().int().min(1900).max(2200).nullish(),
      language: z.string().max(40).nullish(),
      energy: z.number().int().min(1).max(10).nullish(),
      duration_sec: z.number().int().min(1).max(36000).nullish(),
      tags: z.array(z.string().max(40)).max(20).default([]),
      audio_path: z.string().min(1).max(400),
      artwork_path: z.string().max(400).nullish(),
      format: z.string().max(20).nullish(),
      section: z.string().max(30).optional(),
      formats: z.array(z.string().max(30)).max(10).default([]),
      file_size: z.number().int().positive().nullish(),
      bitrate_kbps: z.number().int().positive().max(5000).nullish(),
      album: z.string().max(200).nullish(),
      source_filename: z.string().max(300).nullish(),
      content_hash: z.string().length(64).nullish(),
      dedupe_key: z.string().max(400).nullish(),
      work_key: z.string().max(400).nullish(),
      cover_palette: z.string().max(40).nullish(),
      cover_spec_version: z.number().int().min(1).max(99).nullish(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const access = await requireTrusted(context.userId);
    const status = access.isManager ? "published" : "pending";
    // Определяем оригинал/ремикс: скобки → музыкальный каталог → наша библиотека.
    const { resolveTrackVersion } = await import("@/lib/dj/lookup.server");
    const verdict = await resolveTrackVersion({
      artist: data.artist,
      title: data.title,
      sourceFilename: data.source_filename ?? null,
      workKey: data.work_key ?? null,
    });
    const id = await insertTrack(
      access.userId,
      {
        ...data,
        version: verdict.version,
        is_remix: verdict.is_remix,
        remixer: verdict.remixer,
        original_track_id: verdict.original_track_id,
        version_source: verdict.version_source,
      },
      status,
    );
    return { id, status, versionLabel: verdict.version_label };
  });


/** Проверка дубликатов перед загрузкой — возвращает уже занятые хэши и ключи. */
export const djCheckDuplicates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      hashes: z.array(z.string().length(64)).max(200).default([]),
      keys: z.array(z.string().max(400)).max(200).default([]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireTrusted(context.userId);
    return findExistingDuplicates(data.hashes, data.keys);
  });

/** Справочник разделов и категорий — публичный, без чувствительных данных. */
export const djCategories = createServerFn({ method: "GET" }).handler(async () => listCategories());

/** Витрина главной /dj — публичная, только карточки без ссылок на аудио. */
export const djShowcase = createServerFn({ method: "GET" }).handler(async () => loadShowcase());
