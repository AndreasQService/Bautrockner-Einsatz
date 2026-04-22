"""
WohnungsScout – Homegate.ch API Client
Nutzt die öffentliche (inoffizielle) Homegate REST API.
Respektiert robots.txt, moderate Request-Rate.
"""
import httpx
import logging
import time
import re
from scraper.scorer import score_listing, load_config

logger = logging.getLogger(__name__)

HOMEGATE_API = "https://api.homegate.ch/search/listings"

# Korrekte User-Agent + Headers fuer Homegate
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'de-CH,de;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Origin': 'https://www.homegate.ch',
    'Referer': 'https://www.homegate.ch/mieten/immobilien/',
    'sec-ch-ua': '"Chromium";v="122"',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-site',
}


RATE_LIMIT_SECONDS = 30
MAX_RESULTS = 50


def build_params(location: str, cfg: dict) -> dict:
    flt = cfg['filter']
    params = {
        'offerType': 'RENT',
        'listingType': 'STANDARD',
        'locationSearchType': 'city',
        'location': location,
        'from': 0,
        'size': min(MAX_RESULTS, 50),
        'sortBy': 'dateCreated',
        'sortDirection': 'DESC',
    }
    if flt.get('min_rooms'):
        params['numberOfRooms[from]'] = flt['min_rooms']
    if flt.get('max_price_chf'):
        params['price[to]'] = flt['max_price_chf']
    if flt.get('min_area_m2'):
        params['livingSpace[from]'] = flt['min_area_m2']
    return params


def parse_listing(item: dict) -> dict:
    """Normalisiert einen Homegate API-Eintrag."""
    listing = item.get('listing', item)
    props = listing.get('characteristics', {})
    address = listing.get('address', {})
    id_ = listing.get('id', '')

    title = listing.get('title', {})
    title_text = title.get('de', '') if isinstance(title, dict) else str(title)

    desc = listing.get('description', {})
    desc_text = desc.get('de', '') if isinstance(desc, dict) else str(desc)
    combined = (title_text + ' ' + desc_text).lower()

    rooms = props.get('numberOfRooms') or props.get('rooms')
    area = props.get('livingSpace') or props.get('netFloorSpace')
    price = None
    rent = listing.get('prices', {}).get('rent', {})
    if isinstance(rent, dict):
        price = rent.get('gross') or rent.get('net')
    elif isinstance(rent, (int, float)):
        price = rent

    has_parking = any(k in combined for k in ['parkplatz', 'garage', 'tiefgarage', 'parking'])
    has_balcony = any(k in combined for k in ['balkon', 'terrasse', 'loggia'])

    return {
        'source': 'homegate',
        'external_id': f"homegate_{id_}",
        'url': f"https://www.homegate.ch/mieten/{id_}",
        'title': title_text,
        'address': f"{address.get('street', '')} {address.get('houseNumber', '')}".strip(),
        'city': address.get('locality', ''),
        'zip_code': str(address.get('postalCode', '')),
        'rooms': float(rooms) if rooms else None,
        'area_m2': int(area) if area else None,
        'price_chf': int(price) if price else None,
        'has_parking': has_parking,
        'has_balcony': has_balcony,
        'description': desc_text[:500],
    }


def scrape(cfg: dict = None) -> list[dict]:
    """Scrapt Homegate API für alle konfigurierten Orte."""
    if cfg is None:
        cfg = load_config()

    locations = cfg['search']['locations']
    results = []
    seen_ids = set()

    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'de-CH,de;q=0.9',
        'Referer': 'https://www.homegate.ch/',
    }

    for i, location in enumerate(locations):
        if i > 0:
            logger.info(f'[Homegate] Warte {RATE_LIMIT_SECONDS}s...')
            time.sleep(RATE_LIMIT_SECONDS)

        params = build_params(location, cfg)
        logger.info(f"[Homegate] Suche fuer '{location}'")

        try:
            with httpx.Client(timeout=20, headers=HEADERS, follow_redirects=True) as client:
                response = client.get(HOMEGATE_API, params=params)
                response.raise_for_status()
                data = response.json()

            items = data.get('listingResultList', data.get('listings', []))
            if not items and 'results' in data:
                items = data['results']

            logger.info(f"[Homegate] {len(items)} Einträge für '{location}'")

            for item in items:
                listing = parse_listing(item)
                if listing['external_id'] in seen_ids:
                    continue
                seen_ids.add(listing['external_id'])

                pts, label = score_listing(listing, cfg)
                listing['score_points'] = pts
                listing['score'] = label

                results.append(listing)

        except httpx.HTTPError as e:
            logger.error(f"[Homegate] HTTP-Fehler für '{location}': {e}")
        except Exception as e:
            logger.error(f"[Homegate] Fehler für '{location}': {e}")

    logger.info(f"[Homegate] Total: {len(results)} Inserate")
    return results
