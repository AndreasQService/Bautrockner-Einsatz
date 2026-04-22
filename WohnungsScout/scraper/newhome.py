"""
WohnungsScout – Newhome.ch RSS Scraper
Newhome bietet offizielle RSS-Feeds für Suchabos.
100% legal – kein Scraping, nur RSS-Parsing.
"""
import feedparser
import httpx
import re
import logging
from urllib.parse import quote
from datetime import datetime
from scraper.scorer import score_listing, load_config

logger = logging.getLogger(__name__)


def build_rss_url(location: str, cfg: dict) -> str:
    """Baut die Newhome RSS-URL für einen Ort."""
    flt = cfg['filter']
    params = [
        f"place={quote(location, safe='')}",
        "typeOfHousing=3",
        "typeOfOffer=1",
    ]
    if flt.get('max_price_chf'):
        params.append(f"priceMax={flt['max_price_chf']}")
    if flt.get('min_rooms'):
        params.append(f"roomsFrom={flt['min_rooms']}")
    if flt.get('min_area_m2'):
        params.append(f"livingSpaceFrom={flt['min_area_m2']}")

    base = "https://www.newhome.ch/de/mieten/wohnungen/suche/ergebnis/rss"
    return f"{base}?{'&'.join(params)}"


def parse_entry(entry: dict) -> dict:
    """Parst einen RSS-Eintrag in ein normalisiertes Dict."""
    title = entry.get('title', '')
    summary = entry.get('summary', '')
    link = entry.get('link', '')

    # Preis extrahieren: "CHF 1'800.–" oder "CHF 1800"
    price = None
    price_match = re.search(r"CHF\s*([\d']+)", title + ' ' + summary)
    if price_match:
        price = int(price_match.group(1).replace("'", ''))

    # Zimmer: "3.5-Zimmerwohnung" oder "3 Zimmer"
    rooms = None
    rooms_match = re.search(r"(\d+\.?\d*)[- ]?[Zz]immer", title + ' ' + summary)
    if rooms_match:
        rooms = float(rooms_match.group(1))

    # Fläche: "82 m²"
    area = None
    area_match = re.search(r"(\d+)\s*m²", summary)
    if area_match:
        area = int(area_match.group(1))

    # Parkplatz/Balkon Keywords
    combined = (title + summary).lower()
    has_parking = any(k in combined for k in ['parkplatz', 'garage', 'tiefgarage', 'parking', 'stellplatz'])
    has_balcony = any(k in combined for k in ['balkon', 'terrasse', 'loggia'])

    # Ort aus Titel
    city = ''
    city_match = re.search(r',\s*(\d{4}\s+\w[\w\s]+)$', title)
    if city_match:
        city = city_match.group(1).strip()

    external_id = link.split('/')[-1].split('?')[0] or entry.get('id', link)

    return {
        'source': 'newhome',
        'external_id': f"newhome_{external_id}",
        'url': link,
        'title': title,
        'city': city,
        'price_chf': price,
        'rooms': rooms,
        'area_m2': area,
        'has_parking': has_parking,
        'has_balcony': has_balcony,
        'description': summary,
    }


def scrape(cfg: dict = None) -> list[dict]:
    """Scrapt alle Newhome RSS-Feeds für alle konfigurierten Orte."""
    if cfg is None:
        cfg = load_config()

    locations = cfg['search']['locations']
    results = []
    seen_ids = set()

    headers = {
        'User-Agent': 'WohnungsScout/1.0 (persönlicher Wohnungssuche-Bot; respektiert robots.txt)',
        'Accept': 'application/rss+xml, application/xml, text/xml',
    }

    for location in locations:
        url = build_rss_url(location, cfg)
        logger.info(f"[Newhome] RSS fuer '{location}'")

        try:
            with httpx.Client(timeout=15, headers=headers, follow_redirects=True) as client:
                response = client.get(url)
                response.raise_for_status()

            feed = feedparser.parse(response.text)
            entries = feed.get('entries', [])
            logger.info(f"[Newhome] {len(entries)} Einträge für '{location}'")

            for entry in entries:
                listing = parse_entry(entry)
                if listing['external_id'] in seen_ids:
                    continue
                seen_ids.add(listing['external_id'])

                # Score berechnen
                pts, label = score_listing(listing, cfg)
                listing['score_points'] = pts
                listing['score'] = label

                results.append(listing)

        except httpx.HTTPError as e:
            logger.error(f"[Newhome] HTTP-Fehler für '{location}': {e}")
        except Exception as e:
            logger.error(f"[Newhome] Fehler für '{location}': {e}")

    logger.info(f"[Newhome] Total: {len(results)} Inserate")
    return results
