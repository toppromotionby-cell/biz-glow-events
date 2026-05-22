// Scrape missing event-tech.by catalog pages and upsert into Supabase `zones` table.
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("missing env"); process.exit(1); }
const sb = createClient(url, key);

const lines = fs.readFileSync("/tmp/et/missing_url.tsv", "utf8").trim().split("\n");

function decodeHtml(s) {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&laquo;/g, "«")
    .replace(/&raquo;/g, "»")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&hellip;/g, "…");
}
function clean(s) { return decodeHtml((s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")).trim(); }
function truncate(s, max) {
  s = clean(s);
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  for (const sep of [". ", "! ", "? "]) {
    const i = cut.lastIndexOf(sep);
    if (i > max * 0.6) return cut.slice(0, i + 1).trim();
  }
  const i = cut.lastIndexOf(" ");
  return (i > max * 0.6 ? cut.slice(0, i) : cut).replace(/[ ,;:]+$/, "") + "…";
}

function extract(html, pageUrl) {
  const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const title = titleMatch ? clean(titleMatch[1]) : "";

  const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
  const metaDesc = descMatch ? decodeHtml(descMatch[1]) : "";

  // photos from fotoProduct
  const photoSet = new Set();
  const photoRe = /images\/fotoProduct\/[^"'\s)]+\.(?:jpg|jpeg|png|webp)/gi;
  let m;
  while ((m = photoRe.exec(html))) {
    photoSet.add("https://event-tech.by/" + m[0]);
  }
  const photos = [...photoSet].slice(0, 6);

  // youtube videos
  const videoSet = new Set();
  const ytRe = /youtube\.com\/(?:embed\/|watch\?v=)([a-zA-Z0-9_-]{6,})/gi;
  while ((m = ytRe.exec(html))) {
    videoSet.add(`https://www.youtube.com/embed/${m[1]}`);
  }
  const videos = [...videoSet].slice(0, 5);

  // price: look for first "от XXX" or first "XXX BYN"
  let price = null;
  const ot = html.match(/от\s*<?[^>]*>?\s*(\d{2,5})/i);
  if (ot) price = Number(ot[1]);
  else {
    const byn = html.match(/(\d{2,5})\s*BYN/i);
    if (byn) price = Number(byn[1]);
  }

  // description: try to get content between h1 and first iframe/photo block,
  // fallback to meta description
  let description = metaDesc;
  const afterH1 = html.split(/<\/h1>/i)[1];
  if (afterH1) {
    const paragraphs = [...afterH1.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
      .map((x) => clean(x[1]))
      .filter((s) => s.length > 30 && !/cookie|©|политик/i.test(s))
      .slice(0, 6);
    if (paragraphs.length) description = paragraphs.join("\n\n");
  }

  return {
    title,
    metaDesc,
    description,
    photos,
    videos,
    price,
    sourceUrl: pageUrl,
  };
}

async function fetchPage(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; LovableBot/1.0)" } });
      if (res.ok) return await res.text();
    } catch (e) { /* retry */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}

const rows = [];
let i = 0;
for (const line of lines) {
  i++;
  const [slug, pageUrl] = line.split("\t");
  process.stdout.write(`[${i}/${lines.length}] ${slug} ... `);
  const html = await fetchPage(pageUrl);
  if (!html) { console.log("FAIL"); continue; }
  const data = extract(html, pageUrl);
  if (!data.title) { console.log("no h1, skip"); continue; }
  const short = truncate(data.metaDesc || data.description || data.title, 300);
  const desc = truncate(data.description || short, 2500);
  let seo_title = `${data.title} — аренда в Минске | event-hub.by`;
  if (seo_title.length > 60) seo_title = truncate(data.title, 60);
  rows.push({
    slug,
    title: data.title,
    category: "Интерактивные зоны",
    short_description: short,
    description: desc,
    seo_title,
    seo_description: truncate(data.metaDesc || short, 160),
    photo_urls: data.photos,
    video_urls: data.videos,
    pricing: data.price !== null ? { from: data.price } : {},
    features: [],
    faq: [],
    requirements: null,
    published: true,
  });
  console.log(`OK photos=${data.photos.length} vids=${data.videos.length} price=${data.price ?? "—"}`);
}

console.log(`\nUpserting ${rows.length} zones...`);
const CHUNK = 25;
for (let i = 0; i < rows.length; i += CHUNK) {
  const slice = rows.slice(i, i + CHUNK);
  const { error } = await sb.from("zones").upsert(slice, { onConflict: "slug" });
  if (error) { console.error("ERR", error); process.exit(1); }
  console.log(`  upserted ${i + slice.length}/${rows.length}`);
}
console.log("DONE");
