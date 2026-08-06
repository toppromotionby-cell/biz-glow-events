"""Импорт каталога аттракционов с play-game.by в Supabase (таблица attractions).

Двухфазный устойчивый импорт:
  фаза 1 — товары пишутся в БД партиями сразу (без фото);
  фаза 2 — фото скачиваются с ретраями, кладутся в публичный bucket
           `catalog-media` и дописываются в строку по одной позиции.
Скрипт идемпотентен: повторный запуск дополняет то, что не докачалось.
"""
import json, os, re, html, time, urllib.request, urllib.parse, urllib.error, sys
from concurrent.futures import ThreadPoolExecutor

SB = os.environ["SUPABASE_URL"].rstrip("/")
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
SRC = "https://www.play-game.by/wp-json/wc/store/v1"
UA = {"User-Agent": "Mozilla/5.0"}
ROOT_CAT = 28  # Аренда и прокат аттракционов
MAX_PHOTOS = 3


def jget(url, tries=4):
    for a in range(tries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except Exception as e:
            if a == tries - 1:
                raise
            time.sleep(2 * (a + 1))


def sb(method, path, body=None, headers=None, raw=None, tries=3):
    h = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}
    if headers:
        h.update(headers)
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    if body is not None and raw is None:
        h["Content-Type"] = "application/json"
    last = None
    for a in range(tries):
        try:
            req = urllib.request.Request(f"{SB}{path}", data=data, headers=h, method=method)
            with urllib.request.urlopen(req, timeout=120) as r:
                return r.status, r.read()
        except urllib.error.HTTPError as e:
            raise
        except Exception as e:
            last = e
            time.sleep(2 * (a + 1))
    raise last


def strip_tags(s):
    s = re.sub(r"<[^>]+>", " ", s or "")
    return re.sub(r"\s+", " ", html.unescape(s)).strip()


def price_of(p):
    pr = p.get("prices") or {}
    for k in ("price", "regular_price"):
        v = pr.get(k)
        if v:
            try:
                minor = int(pr.get("currency_minor_unit", 2))
                return round(int(v) / (10 ** minor), 2)
            except Exception:
                pass
    return 0


def upload(slug, idx, url):
    ext = os.path.splitext(urllib.parse.urlparse(url).path)[1].lower() or ".jpg"
    if ext not in (".jpg", ".jpeg", ".png", ".webp", ".gif"):
        ext = ".jpg"
    key = f"attractions/{slug}/{idx}{ext}"
    blob = ctype = None
    for a in range(3):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=45) as r:
                blob = r.read()
                ctype = r.headers.get("Content-Type", "image/jpeg")
            break
        except Exception:
            time.sleep(1.5 * (a + 1))
    if not blob:
        return None
    try:
        sb("POST", f"/storage/v1/object/{key}", raw=blob,
           headers={"Content-Type": ctype, "x-upsert": "true"})
    except urllib.error.HTTPError as e:
        if e.code not in (400, 409):
            return None
    except Exception:
        return None
    return f"{SB}/storage/v1/object/public/{key}"


def fetch_products():
    products, page = [], 1
    while page <= 12:
        chunk = jget(f"{SRC}/products?per_page=100&page={page}&category={ROOT_CAT}&order=asc&orderby=title")
        if not chunk:
            break
        products += chunk
        page += 1
    return products


def main():
    cats = jget(f"{SRC}/products/categories?per_page=100")
    subs = {c["id"]: c for c in cats if c.get("parent") == ROOT_CAT and c["count"] > 0}
    products = fetch_products()
    print(f"подкатегорий: {len(subs)}, товаров: {len(products)}", flush=True)

    rows = [{"entity_type": "attractions", "name": strip_tags(c["name"]), "sort_order": (i + 1) * 10}
            for i, c in enumerate(sorted(subs.values(), key=lambda x: -x["count"]))]
    sb("DELETE", "/rest/v1/catalog_categories?entity_type=eq.attractions")
    sb("POST", "/rest/v1/catalog_categories", body=rows)

    # --- фаза 1: строки без фото, партиями ---
    payload, images = [], {}
    for i, p in enumerate(products):
        slug = p["slug"]
        cat = next((strip_tags(c["name"]) for c in p.get("categories", []) if c["id"] in subs), None)
        title = strip_tags(p["name"]).replace(" в аренду", "").strip() or strip_tags(p["name"])
        price = price_of(p)
        images[slug] = [im["src"] for im in (p.get("images") or [])][:MAX_PHOTOS]
        payload.append({
            "slug": slug,
            "title": title,
            "category": cat,
            "short_description": strip_tags(p.get("short_description"))[:600] or None,
            "description": p.get("description") or None,
            "pricing": {"from": price} if price else {},
            "photo_urls": [],
            "video_urls": [],
            "seo_title": f"{title} — аренда в Минске | event-hub.by",
            "seo_description": (strip_tags(p.get("short_description")) or f"{title} в аренду в Минске.")[:158],
            "published": True,
            "sort_order": (i + 1) * 10,
        })

    for i in range(0, len(payload), 50):
        sb("POST", "/rest/v1/attractions", body=payload[i:i + 50],
           headers={"Prefer": "resolution=merge-duplicates,return=minimal"})
        print("rows", min(i + 50, len(payload)), "/", len(payload), flush=True)

    # --- фаза 2: медиа ---
    def media(slug):
        urls = images.get(slug) or []
        if not urls:
            return slug, 0
        got = [u for u in (upload(slug, n, u) for n, u in enumerate(urls)) if u]
        if got:
            sb("PATCH", f"/rest/v1/attractions?slug=eq.{urllib.parse.quote(slug)}",
               body={"photo_urls": got}, headers={"Prefer": "return=minimal"})
        return slug, len(got)

    todo = [r["slug"] for r in payload]
    done = 0
    with ThreadPoolExecutor(max_workers=8) as ex:
        for slug, n in ex.map(media, todo):
            done += 1
            if done % 25 == 0:
                print("media", done, "/", len(todo), flush=True)
    print("готово:", len(payload), flush=True)


if __name__ == "__main__":
    main()
