// Админские серверные функции DJ-раздела. Только тонкие обёртки.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireDjManager } from "@/lib/dj/guard.server";
import { listMembers, setMemberStatus, djStats, createMemberByAdmin } from "@/lib/dj/members.server";
import { moderateTrack, deleteTrack, updateTrack, pendingQueue } from "@/lib/dj/moderation.server";
import { listTracks } from "@/lib/dj/library.server";

const memberStatus = z.enum(["pending", "approved", "trusted", "blocked", "rejected"]);
const contentStatus = z.enum(["draft", "pending", "published", "rejected"]);

export const djAdminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireDjManager(context.userId);
    return djStats();
  });

export const djAdminMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ status: memberStatus.or(z.literal("all")).optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await requireDjManager(context.userId);
    return listMembers(data.status);
  });

export const djAdminSetMemberStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), status: memberStatus, note: z.string().max(500).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const access = await requireDjManager(context.userId);
    await setMemberStatus(access, data.id, data.status, data.note);
    return { ok: true };
  });

export const djAdminCreateMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        email: z.string().trim().email().max(255),
        nickname: z.string().trim().min(2).max(80),
        status: memberStatus,
        city: z.string().trim().max(80).optional(),
        contact: z.string().trim().max(160).optional(),
        note: z.string().trim().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireDjManager(context.userId);
    const res = await createMemberByAdmin(data);
    return { ok: true, created: res.created, tempPassword: res.tempPassword ?? null };
  });

export const djAdminQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireDjManager(context.userId);
    return pendingQueue();
  });

export const djAdminTracks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      q: z.string().max(120).optional(),
      status: contentStatus.or(z.literal("all")).optional(),
      page: z.number().int().min(1).max(500).optional(),
      pageSize: z.number().int().min(6).max(100).optional(),
    }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => listTracks(await requireDjManager(context.userId), data));

export const djAdminModerateTrack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), status: contentStatus, reason: z.string().max(500).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireDjManager(context.userId);
    await moderateTrack(data.id, data.status, data.reason);
    return { ok: true };
  });

export const djAdminUpdateTrack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      patch: z.object({
        artist: z.string().trim().min(1).max(160).optional(),
        title: z.string().trim().min(1).max(200).optional(),
        genre: z.string().max(60).nullish(),
        bpm: z.number().int().min(40).max(300).nullish(),
        key_camelot: z.string().max(4).nullish(),
        year: z.number().int().min(1900).max(2200).nullish(),
        language: z.string().max(40).nullish(),
      }),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireDjManager(context.userId);
    await updateTrack(data.id, data.patch);
    return { ok: true };
  });

export const djAdminDeleteTrack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireDjManager(context.userId);
    await deleteTrack(data.id);
    return { ok: true };
  });

