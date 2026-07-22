#!/usr/bin/env python3
"""Fetch bright, sunny beach/coastal paintings from Wikimedia Commons."""

from __future__ import annotations

import json
import re
import time
import urllib.parse
import urllib.request
from html import unescape
from pathlib import Path

API = "https://commons.wikimedia.org/w/api.php"
UA = "ArtworkGalleryBot/1.0 (https://github.com/trevsm/artwork)"
ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "data" / "artworks.json"

SEARCHES = [
    'filetype:bitmap "beach" painting Sorolla',
    'filetype:bitmap "beach" painting Boudin',
    'filetype:bitmap "beach" painting "William Merritt Chase"',
    'filetype:bitmap "beach" painting Prendergast',
    'filetype:bitmap "beach" painting Potthast',
    'filetype:bitmap "beach" painting Renoir',
    'filetype:bitmap "seaside" painting Monet',
    'filetype:bitmap "beach" painting Conder',
    'filetype:bitmap "beach" painting "Stanhope Forbes"',
    'filetype:bitmap "beach" painting "Philip Wilson Steer"',
    'filetype:bitmap "beach" painting "Laura Knight"',
    'filetype:bitmap "beach" painting Cassatt',
    'filetype:bitmap "beach" painting Morisot',
    'filetype:bitmap "beach" painting "Richard Parkes Bonington"',
    'filetype:bitmap "beach" painting "Winslow Homer"',
    'filetype:bitmap "coast" painting sunny',
    'filetype:bitmap "seashore" painting',
    'filetype:bitmap "Trouville" painting beach',
    'filetype:bitmap "bathing" beach painting',
    'filetype:bitmap "playa" painting Sorolla',
    'filetype:bitmap "plage" painting Boudin',
    'filetype:bitmap "Shinnecock" beach painting',
    'filetype:bitmap "Cullercoats" beach painting',
    'filetype:bitmap "Brighton beach" painting',
    'filetype:bitmap "Scheveningen" beach painting',
    'filetype:bitmap "beach" painting impressionist',
    'filetype:bitmap "coastal scene" painting bright',
    'filetype:bitmap "on the beach" painting',
    'filetype:bitmap "at the beach" painting',
    'filetype:bitmap "seaside resort" painting',
]

DARK_RE = re.compile(
    r"\b(storm|shipwreck|wreck|tempest|moonlight|moonlit|midnight|"
    r"shipwrecked|ship.?wreck|gloomy|tragic|despair|snow.?storm|"
    r"iceberg|sea of ice|northeaster|ship in the storm|black sea at night|"
    r"stormy sea|storm at sea|wreck of hope|shipwreck on a rocky|"
    r"night over a coastal|dark sea|tempestuous|hurricane|shipwrecked|"
    r"disaster at sea|peril|drowning|death at sea)\b",
    re.I,
)

BRIGHT_RE = re.compile(
    r"\b(beach|seaside|seashore|shore|coast|sunny|summer|bathing|"
    r"trouville|deck.?chair|figures on|holiday|playa|plage|brighton|"
    r"scheveningen|shinnecock|cullercoats|breeze|strolling|walk on the beach|"
    r"children on the beach|boys on the beach|girls on the beach|"
    r"at the seashore|by the sea|on the sand|sand dunes?|tide|harbor|harbour)\b",
    re.I,
)

JUNK_RE = re.compile(
    r"\.pdf|barcode|photo of painting|in the museum|installation view|"
    r"gallery view|detail\b|fragment\b|verso\b|anagoria|sketchbook|"
    r"self[- ]portrait|portrait of|letters?\b|manuscript|"
    r"\b00[1-9]\b|whitman publishing|rutherford",
    re.I,
)

PAINTING_RE = re.compile(r"painting|oil on canvas|oil on panel|watercolor|watercolour", re.I)

STRIP_TAGS = re.compile(r"<[^>]+>")


def api(params: dict) -> dict:
    params = dict(params)
    params.setdefault("format", "json")
    url = API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=45) as response:
        return json.load(response)


def clean_html(value: str) -> str:
    value = unescape(STRIP_TAGS.sub(" ", value or ""))
    return " ".join(value.split())


def parse_year(raw: str) -> int | None:
    if not raw:
        return None
    match = re.search(r"\b(1[5-9]\d{2}|20[0-1]\d)\b", raw)
    return int(match.group(1)) if match else None


def parse_artist(raw: str, title: str, filename: str) -> str:
    raw = clean_html(raw)
    if raw:
        raw = re.sub(r"^(after|attributed to|follower of|school of)\s+", "", raw, flags=re.I)
        if len(raw) > 2 and not raw.lower().startswith("unknown"):
            return raw[:120]

    for source in (title, filename):
        match = re.match(r"^([A-Z][^\-\–—]+?)\s*[\-\–—]", source)
        if match:
            return match.group(1).strip()
        match = re.match(r"^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})", source)
        if match:
            return match.group(1).strip()
    return "Unknown"


def parse_title(raw: str, filename: str) -> str:
    title = clean_html(raw)
    if not title or title.lower().startswith("file:"):
        title = re.sub(r"^File:", "", filename)
        title = re.sub(r"\.(jpg|jpeg|png|webp)$", "", title, flags=re.I)
    title = re.sub(r"\s*-\s*Google Art Project\s*$", "", title, flags=re.I)
    title = title.strip(" -–—")
    return title[:160] if title else "Untitled"


def search_files(query: str, limit: int = 50) -> list[str]:
    titles: list[str] = []
    offset = 0
    while len(titles) < limit:
        data = api(
            {
                "action": "query",
                "list": "search",
                "srsearch": query,
                "srnamespace": 6,
                "srlimit": min(50, limit - len(titles)),
                "sroffset": offset,
            }
        )
        batch = data.get("query", {}).get("search", [])
        if not batch:
            break
        titles.extend(item["title"] for item in batch)
        offset = data.get("continue", {}).get("sroffset")
        if offset is None:
            break
        time.sleep(0.15)
    return titles


def fetch_image_batch(titles: list[str]) -> list[dict]:
    results: list[dict] = []
    for i in range(0, len(titles), 40):
        chunk = titles[i : i + 40]
        data = api(
            {
                "action": "query",
                "titles": "|".join(chunk),
                "prop": "imageinfo",
                "iiprop": "url|extmetadata|mime|size",
                "iiurlwidth": 960,
            }
        )
        for page in data.get("query", {}).get("pages", {}).values():
            if "missing" in page:
                continue
            info = (page.get("imageinfo") or [None])[0]
            if not info:
                continue
            mime = info.get("mime", "")
            if not mime.startswith("image/"):
                continue
            width = info.get("width") or 0
            height = info.get("height") or 0
            if width < 500 or height < 350:
                continue

            meta = info.get("extmetadata") or {}
            filename = page.get("title", "")
            blob = " ".join(
                clean_html(meta.get(key, {}).get("value", ""))
                for key in ("ObjectName", "ImageDescription", "Artist", "Categories")
            )
            blob = f"{blob} {filename}"

            if JUNK_RE.search(blob):
                continue
            if DARK_RE.search(blob):
                continue

            title = parse_title(meta.get("ObjectName", {}).get("value", ""), filename)
            artist = parse_artist(meta.get("Artist", {}).get("value", ""), title, filename)
            year = parse_year(meta.get("DateTimeOriginal", {}).get("value", "")) or parse_year(title)

            score = 0
            if BRIGHT_RE.search(blob):
                score += 4
            if PAINTING_RE.search(blob):
                score += 3
            if "PD-Art" in blob or "paintings" in blob.lower():
                score += 2
            if "beach" in blob.lower() or "seaside" in blob.lower() or "seashore" in blob.lower():
                score += 2
            if score < 3:
                continue

            src = info.get("thumburl") or info.get("url")
            if not src or "upload.wikimedia.org" not in src:
                continue
            if not src.endswith((".jpg", ".jpeg", ".png", ".webp")) and "/thumb/" not in src:
                continue

            results.append(
                {
                    "src": src,
                    "title": title,
                    "artist": artist,
                    "year": year,
                    "professional": True,
                    "style": "Ocean & Beach",
                    "_score": score,
                }
            )
        time.sleep(0.15)
    return results


def normalize_src(src: str) -> str:
    return re.sub(r"/\d+px-", "/960px-", src)


def load_existing() -> list[dict]:
    with DATA_PATH.open() as handle:
        return json.load(handle)


def save_existing(data: list[dict]) -> None:
    with DATA_PATH.open("w") as handle:
        json.dump(data, handle, indent=2, ensure_ascii=False)
        handle.write("\n")


def retag_dark_ocean_entries(data: list[dict]) -> int:
    moved = 0
    for art in data:
        if art.get("style") != "Ocean & Beach":
            continue
        blob = f"{art.get('title','')} {art.get('src','')} {art.get('artist','')}"
        if DARK_RE.search(blob):
            art["style"] = "Dark Romantic"
            moved += 1
    return moved


def main() -> None:
    existing = load_existing()
    existing_srcs = {a["src"] for a in existing}
    existing_srcs.update(normalize_src(s) for s in existing_srcs)

    candidate_titles: list[str] = []
    seen_search: set[str] = set()
    for query in SEARCHES:
        for title in search_files(query, limit=40):
            if title not in seen_search:
                seen_search.add(title)
                candidate_titles.append(title)
        time.sleep(0.1)

    print(f"Search found {len(candidate_titles)} unique files")

    fetched = fetch_image_batch(candidate_titles)
    print(f"Passed filters: {len(fetched)}")

    new_entries: list[dict] = []
    for art in sorted(fetched, key=lambda item: item["_score"], reverse=True):
        src = art["src"]
        if src in existing_srcs or normalize_src(src) in existing_srcs:
            continue
        entry = {k: v for k, v in art.items() if not k.startswith("_")}
        new_entries.append(entry)
        existing_srcs.add(src)

    moved = retag_dark_ocean_entries(existing)
    combined = existing + new_entries
    save_existing(combined)

    ocean_count = sum(1 for a in combined if a.get("style") == "Ocean & Beach")
    print(f"Added {len(new_entries)} bright beach paintings")
    print(f"Re-tagged {moved} dark seascapes to Dark Romantic")
    print(f"Ocean & Beach total: {ocean_count}")
    print(f"Collection total: {len(combined)}")


if __name__ == "__main__":
    main()
