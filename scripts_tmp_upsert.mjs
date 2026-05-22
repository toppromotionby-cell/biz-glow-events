// Upsert zones via Supabase admin SDK
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('missing env'); process.exit(1); }
const sb = createClient(url, key);

const items = JSON.parse(fs.readFileSync('/tmp/et/items.json', 'utf8'));

function clean(s) { return (s||'').replace(/\s+/g,' ').replaceAll('&nbsp;',' ').trim(); }
function truncate(s, max) {
  s = clean(s); if (s.length <= max) return s;
  const cut = s.slice(0, max);
  for (const sep of ['. ', '! ', '? ']) {
    const i = cut.lastIndexOf(sep);
    if (i > max*0.6) return cut.slice(0, i+1).trim();
  }
  const i = cut.lastIndexOf(' ');
  return (i > max*0.6 ? cut.slice(0,i) : cut).replace(/[ ,;:]+$/,'') + '…';
}

const rows = items.map(it => {
  const title = clean(it.title);
  const short = truncate(it.short_description || it.description || title, 300);
  const desc = truncate(it.description || short, 2000);
  let seo_title = `${title} — аренда в Минске | event-hub.by`;
  if (seo_title.length > 60) seo_title = truncate(title, 60);
  return {
    slug: it.slug,
    title,
    category: clean(it.category) || 'Интерактивные зоны',
    short_description: short,
    description: desc,
    seo_title,
    seo_description: truncate(short, 160),
    photo_urls: (it.photo_urls || []).slice(0, 5),
    video_urls: (it.video_urls || []).slice(0, 5),
    pricing: it.pricing || {},
    features: [],
    faq: [],
    published: true,
  };
});

console.log(`Upserting ${rows.length} zones...`);
const { data, error } = await sb.from('zones').upsert(rows, { onConflict: 'slug' }).select('slug');
if (error) { console.error('ERR', error); process.exit(1); }
console.log(`OK: ${data.length} rows`);
// remove placeholder
const { error: e2 } = await sb.from('zones').delete().eq('slug','new-1779430196172');
if (e2) console.error('delete placeholder:', e2); else console.log('placeholder removed');
