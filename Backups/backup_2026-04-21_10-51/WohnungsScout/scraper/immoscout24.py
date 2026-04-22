"""
WohnungsScout – ImmoScout24 Scraper (Patchright Stealth)
Korrekte Selektoren und Parser basierend auf echtem Seiteninhalt.
"""
import re, time, random, logging
from scraper.scorer import score_listing, load_config

logger = logging.getLogger(__name__)
RATE_PAUSE = (8, 18)

# Kanton-URLs liefern viel mehr Treffer als Ort-URLs
# Wir suchen nach Kanton Thurgau mit PLZ-Filter
SEARCH_REGIONS = {
    'Bottighofen': ('kanton-thurgau', '8598'),
    'Kreuzlingen':  ('kanton-thurgau', '8280'),
    'Konstanz':     None,  # DE-Ort, nicht auf IS24.ch
}


def build_url(location: str, cfg: dict) -> str:
    flt = cfg['filter']
    # Direkte Ort-Suche (funktioniert bei genug Treffern)
    loc = location.lower().replace(' ', '-').replace('ü', 'u').replace('ä', 'a').replace('ö', 'o')
    params = []
    if flt.get('max_price_chf'):
        params.append(f"pf={flt['max_price_chf']}")
    if flt.get('min_rooms'):
        params.append(f"nrf={int(flt['min_rooms'])}")
    if flt.get('min_area_m2'):
        params.append(f"slf={flt['min_area_m2']}")
    qs = '&'.join(params)
    return f"https://www.immoscout24.ch/de/immobilien/mieten/ort-{loc}?{qs}"


def build_region_url(cfg: dict) -> str:
    """Kanton Thurgau URL – liefert alle Treffer in der Region."""
    flt = cfg['filter']
    params = ['r=20']  # 20km Radius
    if flt.get('max_price_chf'):
        params.append(f"pf={flt['max_price_chf']}")
    if flt.get('min_rooms'):
        params.append(f"nrf={int(flt['min_rooms'])}")
    if flt.get('min_area_m2'):
        params.append(f"slf={flt['min_area_m2']}")
    qs = '&'.join(params)
    return f"https://www.immoscout24.ch/de/immobilien/mieten/kanton-thurgau?{qs}"


def parse_card(card) -> dict | None:
    """
    Parst eine HgCardElevated-Karte.
    Text-Format: '3.5 Zimmer,\xa0104m²,\xa0CHF 3'400.–\nAdresse'
    """
    try:
        text = card.inner_text()

        # ── URL / ID ──────────────────────────────
        link_el = card.query_selector('a[href*="/de/d/"]')
        if not link_el:
            link_el = card.query_selector('a[href]')
        href = link_el.get_attribute('href') if link_el else ''
        url = ('https://www.immoscout24.ch' + href) if href.startswith('/') else href
        ext_id = href.split('/')[-1].split('?')[0] if href else ''
        if not ext_id:
            return None

        # ── Zimmer ───────────────────────────────
        # Format: "3.5 Zimmer," oder "3 Zimmer,"
        rooms_match = re.search(r'(\d+[.,]\d*|\d+)\s*Zimmer', text)
        rooms = float(rooms_match.group(1).replace(',', '.')) if rooms_match else None

        # ── Fläche ───────────────────────────────
        # Format: "104m²" oder "104 m²"
        area_match = re.search(r'(\d+)\s*m\u00b2', text)
        area = int(area_match.group(1)) if area_match else None

        # ── Preis ────────────────────────────────
        # Format: "CHF 3'400.–" oder "CHF 1'800.–"
        price_match = re.search(r"CHF\s*([\d'''\u2019\s]+)[.\-\u2013]", text)
        if price_match:
            raw = re.sub(r"['''\u2019\s]", '', price_match.group(1))
            price = int(raw) if raw.isdigit() else None
        else:
            price = None

        # ── Adresse ──────────────────────────────
        # Format: "Ziegeleistrasse 3, 8572 Berg TG"
        addr_match = re.search(r'(\d{4}\s+[\w\s\-]+?)(?:\n|$)', text)
        if addr_match:
            addr_full = addr_match.group(1).strip()
            zip_match = re.match(r'(\d{4})\s+(.*)', addr_full)
            zip_code = zip_match.group(1) if zip_match else ''
            city = zip_match.group(2).strip() if zip_match else addr_full
        else:
            zip_code = ''
            city = ''

        # Strassenadresse (vor der PLZ)
        lines = [l.strip() for l in text.split('\n') if l.strip()]
        street = ''
        for line in lines:
            if re.match(r'[A-Za-zÄäÖöÜü].+\d+', line) and ',' in line:
                street = line.split(',')[0].strip()
                break

        # ── Titel ────────────────────────────────
        title_el = card.query_selector('[class*="title"], [class*="Title"], h2, h3')
        title = title_el.inner_text().strip() if title_el else (lines[-1][:80] if lines else '')

        # ── Features ─────────────────────────────
        combined = text.lower()
        has_parking = any(k in combined for k in ['parkplatz', 'garage', 'tiefgarage', 'einstellplatz'])
        has_balcony = any(k in combined for k in ['balkon', 'terrasse', 'loggia'])

        return {
            'source': 'immoscout24',
            'external_id': f'is24_{ext_id}',
            'url': url,
            'title': title or f'{rooms} Zimmer, {city}',
            'address': street,
            'city': city,
            'zip_code': zip_code,
            'rooms': rooms,
            'area_m2': area,
            'price_chf': price,
            'has_parking': has_parking,
            'has_balcony': has_balcony,
            'description': text[:400],
        }
    except Exception as e:
        logger.debug(f'[IS24] Parse-Fehler: {e}')
        return None


def scrape(cfg: dict = None) -> list[dict]:
    if cfg is None:
        cfg = load_config()

    try:
        from patchright.sync_api import sync_playwright
    except ImportError:
        logger.error('[IS24] patchright fehlt')
        return []

    locations = cfg['search']['locations']
    results = []
    seen_ids = set()

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=False,
            args=['--no-sandbox', '--window-position=-9999,-9999', '--window-size=1366,900']
        )
        context = browser.new_context(
            viewport={'width': 1366, 'height': 900},
            locale='de-CH',
            timezone_id='Europe/Zurich',
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        )
        page = context.new_page()

        # Strategie: Erst Kanton Thurgau (alle Treffer), dann einzelne Orte nur wenn nötig
        urls_to_scrape = [('Thurgau-Region', build_region_url(cfg))]

        # Zusätzlich: Orte die nicht im Thurgau sind
        for loc in locations:
            if loc.lower() not in ['bottighofen', 'kreuzlingen'] and loc.lower() != 'konstanz':
                urls_to_scrape.append((loc, build_url(loc, cfg)))

        for i, (label, url) in enumerate(urls_to_scrape):
            if i > 0:
                pause = random.uniform(*RATE_PAUSE)
                logger.info(f'[IS24] Pause {pause:.1f}s...')
                time.sleep(pause)

            logger.info(f"[IS24] Suche '{label}'")

            try:
                page.goto(url, wait_until='domcontentloaded', timeout=30000)

                # Cookie-Banner
                try:
                    btn = page.wait_for_selector(
                        'button:has-text("Akzeptieren"), button:has-text("Alle akzeptieren")',
                        timeout=4000
                    )
                    if btn:
                        btn.click()
                        time.sleep(1)
                except:
                    pass

                # Warten bis HgCardElevated geladen sind
                try:
                    page.wait_for_selector('[class*="HgCardElevated"]', timeout=10000)
                except:
                    logger.warning(f'[IS24] Keine Karten für {label}')

                page.wait_for_timeout(random.randint(2000, 3500))

                # Alle Inserate-Karten holen
                cards = page.query_selector_all('[class*="HgCardElevated"]')
                logger.info(f'[IS24] {len(cards)} HgCardElevated-Karten für {label}')

                for card in cards:
                    listing = parse_card(card)
                    if not listing:
                        continue
                    if listing['external_id'] not in seen_ids:
                        seen_ids.add(listing['external_id'])
                        pts, label_score = score_listing(listing, cfg)
                        listing.update({'score_points': pts, 'score': label_score})
                        results.append(listing)

            except Exception as e:
                logger.error(f"[IS24] Fehler '{label}': {e}")

        context.close()
        browser.close()

    logger.info(f'[IS24] Total: {len(results)} Inserate')
    return results
