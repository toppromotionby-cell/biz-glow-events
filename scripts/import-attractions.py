"""Импорт каталога аттракционов с play-game.by в Supabase (таблица attractions).

Данные берём из открытого WooCommerce Store API источника.
Медиа перекладываем в публичный bucket `catalog-media`, чтобы не хотлинкать.
"""
import json, os, re, html, urllib.request, urllib.parse, sys
from concurrent.futures import ThreadPoolExecutor

SB = os.environ["SUPABASE_URL"].rstrip("/")
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
SRC = "https://www.play-game.by/wp-json/wc/store/v1"
UA = {"User-Agent": "Mozilla/5.0"}
ROOT_CAT = 28  # Аренда и прокат аттракционов


def jget(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=90) as r:
        return json.load(r)


def sb(method, path, body=None, headers=None, raw=None):
    h = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}
    if headers:
        h.update(headers)
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    if body is not None and raw is None:
        h["Content-Type"] = "application/json"
    req = urllib.request.Request(f"{SB}{path}", data=data, headers=h, method=method)
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.status, r.read()


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
    """Кладём картинку в публичный bucket и возвращаем публичный URL."""
    ext = os.path.splitext(urllib.parse.urlparse(url).path)[1].lower() or ".jpg"
    if ext not in (".jpg", ".jpeg", ".png", ".webp", ".gif"):
        ext = ".jpg"
    key = f"attractions/{slug}/{idx}{ext}"
    try:
        req = urllib.request.Request(url, headers=UA)
        with urllib.request.urlopen(req, timeout=90) as r:
            blob = r.read()
            ctype = r.headers.get("Content-Type", "image/jpeg")
        sb("POST", f"/storage/v1/object/{key}", raw=blob,
           headers={"Content-Type": ctype, "x-upsert": "true"})
    except urllib.error.HTTPError as e:
        if e.code not in (400, 409):
            print("upload fail", url, e.code, file=sys.stderr)
            return None
    except Exception as e:
        print("upload fail", url, e, file=sys.stderr)
        return None
    return f"{SB}/storage/v1/object/public/{key}"


def main():
    cats = jget(f"{SRC}/products/categories?per_page=100")
    subs = {c["id"]: c for c in cats if c.get("parent") == ROOT_CAT and c["count"] > 0}
    print(f"подкатегорий: {len(subs)}")

    products, page = [], 1
    while True:
        chunk = jget(f"{SRC}/products?per_page=100&page={page}&category={ROOT_CAT}&order=asc&orderby=title")
        if not chunk:
            break
        products += chunk
        page += 1
        if page > 12:
            break
    print(f"товаров: {len(products)}")

    # Категории каталога
    rows = []
    for i, c in enumerate(sorted(subs.values(), key=lambda x: -x["count"])):
        rows.append({"entity_type": "attractions", "name": strip_tags(c["name"]), "sort_order": (i + 1) * 10})
    sb("DELETE", "/rest/v1/catalog_categories?entity_type=eq.attractions")
    sb("POST", "/rest/v1/catalog_categories", body=rows)

    def build(args):
        i, p = args
        slug = p["slug"]
        cat = None
        for c in p.get("categories", []):
            if c["id"] in subs:
                cat = strip_tags(c["name"])
                break
        imgs = [im["src"] for im in (p.get("images") or [])][:4]
        with ThreadPoolExecutor(max_workers=4) as ex:
            uploaded = list(ex.map(lambda t: upload(slug, t[0], t[1]), enumerate(imgs)))
        photos = [u for u in uploaded if u]
        price = price_of(p)
        title = strip_tags(p["name"]).replace(" в аренду", "").strip() or strip_tags(p["name"])
        return {
            "slug": slug,
            "title": title,
            "category": cat,
            "short_description": strip_tags(p.get("short_description"))[:600] or None,
            "description": p.get("description") or None,
            "pricing": {"from": price} if price else {},
            "photo_urls": photos,
            "video_urls": [],
            "seo_title": f"{title} — аренда в Минске | event-hub.by",
            "seo_description": (strip_tags(p.get("short_description")) or f"{title} в аренду в Минске.")[:158],
            "published": True,
            "sort_order": (i + 1) * 10,
        }

    with ThreadPoolExecutor(max_workers=6) as ex:
        out = list(ex.map(build, enumerate(products)))

    for i in range(0, len(out), 50):
        sb("POST", "/rest/v1/attractions", body=out[i:i + 50],
           headers={"Prefer": "resolution=merge-duplicates"})
        print("inserted", i + 50)
    print("готово:", len(out))


if __name__ == "__main__":
    main()
