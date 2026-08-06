// Догрузка недостающих фото аттракционов с источника (play-game.by Store API).
// Обрабатывает ограниченную партию за вызов, чтобы уложиться в лимиты воркера.
const SRC = "https://www.play-game.by/wp-json/wc/store/v1";
const BUCKET = "catalog-media";
const MAX_PHOTOS = 3;
const UA = { "User-Agent": "Mozilla/5.0" };

export type BackfillResult = {
  processed: number;
  updated: number;
  photos: number;
  remaining: number;
  failed: string[];
};

async function sourceImages(slug: string): Promise<string[]> {
  const res = await fetch(`${SRC}/products?slug=${encodeURIComponent(slug)}`, { headers: UA });
  if (!res.ok) return [];
  const list = (await res.json()) as Array<{ images?: Array<{ src?: string }> }>;
  const imgs = list?.[0]?.images ?? [];
  return imgs.map((i) => i.src).filter((s): s is string => !!s).slice(0, MAX_PHOTOS);
}

export async function backfillAttractionPhotos(limit: number): Promise<BackfillResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: rows, error } = await supabaseAdmin
    .from("attractions")
    .select("id, slug, photo_urls")
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);

  const missing = (rows ?? []).filter((r) => !(r.photo_urls?.length));
  const batch = missing.slice(0, limit);

  let updated = 0;
  let photos = 0;
  const failed: string[] = [];

  for (const row of batch) {
    try {
      const srcs = await sourceImages(row.slug);
      const urls: string[] = [];
      for (let i = 0; i < srcs.length; i++) {
        const src = srcs[i]!;
        const imgRes = await fetch(src, { headers: UA });
        if (!imgRes.ok) continue;
        const type = imgRes.headers.get("content-type") ?? "image/jpeg";
        const buf = new Uint8Array(await imgRes.arrayBuffer());
        const extMatch = /\.(jpe?g|png|webp|gif)(?:$|\?)/i.exec(src);
        const ext = extMatch ? `.${extMatch[1]!.toLowerCase()}` : ".jpg";
        const path = `attractions/${row.slug}/${i}${ext}`;
        const { error: upErr } = await supabaseAdmin.storage
          .from(BUCKET)
          .upload(path, buf, { contentType: type, upsert: true });
        if (upErr) continue;
        const { data: pub } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
        urls.push(pub.publicUrl);
      }
      if (urls.length) {
        const { error: updErr } = await supabaseAdmin
          .from("attractions")
          .update({ photo_urls: urls })
          .eq("id", row.id);
        if (updErr) throw new Error(updErr.message);
        updated += 1;
        photos += urls.length;
      } else {
        failed.push(row.slug);
      }
    } catch {
      failed.push(row.slug);
    }
  }

  return {
    processed: batch.length,
    updated,
    photos,
    remaining: Math.max(0, missing.length - updated),
    failed: failed.slice(0, 10),
  };
}

export async function countAttractionsMissingPhotos(): Promise<number> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("attractions").select("photo_urls");
  if (error) throw new Error(error.message);
  return (data ?? []).filter((r) => !(r.photo_urls?.length)).length;
}
