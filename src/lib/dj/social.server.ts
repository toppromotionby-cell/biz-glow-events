// Рейтинги и избранное DJ-библиотеки. Только сервер.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { DjAccess } from "./guard.server";

/** Оценка трека 1–5. Пересчёт среднего делает триггер dj_recalc_track_rating. */
export async function rateTrack(access: DjAccess, trackId: string, value: number): Promise<void> {
  const rating = Math.min(5, Math.max(1, Math.round(value)));
  const { error } = await supabaseAdmin
    .from("dj_ratings")
    .upsert({ track_id: trackId, user_id: access.userId, value: rating }, { onConflict: "track_id,user_id" });
  if (error) throw new Error(error.message);
}

/** Переключение «в избранном». Возвращает новое состояние. */
export async function toggleFavorite(access: DjAccess, trackId: string): Promise<{ favorite: boolean }> {
  const { data } = await supabaseAdmin
    .from("dj_favorites")
    .select("id")
    .eq("track_id", trackId)
    .eq("user_id", access.userId)
    .maybeSingle();

  if (data?.id) {
    const { error } = await supabaseAdmin.from("dj_favorites").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { favorite: false };
  }

  const { error } = await supabaseAdmin
    .from("dj_favorites")
    .insert({ track_id: trackId, user_id: access.userId });
  if (error) throw new Error(error.message);
  return { favorite: true };
}
