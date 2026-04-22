"""
WohnungsScout – Tutti.ch Scraper (Patchright Stealth)
Nutzt interaktive Suche (Suchfeld) weil Tutti URL-Parameter ignoriert.
"""
import re, time, random, logging
from scraper.scorer import score_listing, load_config

logger = logging.getLogger(__name__)
RATE_PAUSE = (8, 16)


def parse_card(card, cfg: dict) -> dict | None:
    """
    Parst eine Tutti-Karte.
    Text-Format: 'Kreuzlingen, 8280, 14.04.2026, auf homegate.ch\nTitel\nBeschreibung\n1'200.-'
    """
    try:
        # Link – Tutti nutzt /de/vi/kanton/kategorie/.../ID
        link_el = card.query_selector('a[href*="/vi/"]')
        if not link_el:
            return None
        href = link_el.get_attribute('href') or ''
        if not href or '/vi/' not in href:
            return None
        url = 'https://www.tutti.ch' + href if href.startswith('/') else href
        ext_id = href.split('/')[-1]
        if not ext_id:
            return None

        text = card.inner_text().strip()
        lines = [l.strip() for l in text.split('\n') if l.strip()]

        # ── Ort & PLZ ──────────────────────────────
        # Erste Zeile: "Kreuzlingen, 8280, 14.04.2026, auf homegate.ch"
        city = ''
        zip_code = ''
        if lines:
            first = lines[0]
            city_match = re.match(r'^([\w\s\-]+),\s*(\d{4})', first)
            if city_match:
                city = city_match.group(1).strip()
                zip_code = city_match.group(2)

        # ── Titel ─────────────────────────────────
        # Zweite Zeile ist meist der Titel
        title = lines[1] if len(lines) > 1 else ''

        # ── Preis ─────────────────────────────────
        # Format: "1'200.-" oder "CHF 1'200" oder "1200.-"
        combined = text
        price_match = re.search(r"([\d']{4,})\s*[.\-\u2013]", combined.replace('\u2019', "'"))
        if not price_match:
            price_match = re.search(r'CHF\s*([\d\']+)', combined)
        price = None
        if price_match:
            raw = re.sub(r"['\s]", '', price_match.group(1))
            if raw.isdigit() and 500 <= int(raw) <= 20000:
                price = int(raw)

        # ── Zimmer ────────────────────────────────
        rooms_match = re.search(r'(\d+[.,]\d*|\d+)\s*[Zz]immer', combined)
        rooms = float(rooms_match.group(1).replace(',', '.')) if rooms_match else None

        # ── Fläche ────────────────────────────────
        area_match = re.search(r'(\d+)\s*m[²2]', combined)
        area = int(area_match.group(1)) if area_match else None

        combined_lower = combined.lower()
        has_parking = any(k in combined_lower for k in ['parkplatz', 'garage', 'tiefgarage', 'einstellplatz'])
        has_balcony = any(k in combined_lower for k in ['balkon', 'terrasse', 'loggia'])

        # Preisfilter
        flt = cfg.get('filter', {})
        max_p = flt.get('max_price_chf')
        if price and max_p and price > max_p * 1.05:
            return None

        return {
            'source': 'tutti',
            'external_id': f'tutti_{ext_id}',
            'url': url,
            'title': title[:100],
            'city': city,
            'zip_code': zip_code,
            'price_chf': price,
            'rooms': rooms,
            'area_m2': area,
            'has_parking': has_parking,
            'has_balcony': has_balcony,
            'description': text[:400],
        }
    except Exception as e:
        logger.debug(f'[Tutti] Card-Fehler: {e}')
        return None


def scrape_location(page, location: str, cfg: dict, seen_ids: set) -> list:
    """Sucht via Suchfeld und parst Resultate."""
    results = []
    query = f'Wohnung mieten {location}'

    try:
        # Zurück zur Startseite für saubere Suche
        page.goto('https://www.tutti.ch/de', timeout=20000, wait_until='domcontentloaded')
        time.sleep(2)

        # Cookie Banner einmalig
        try:
            btn = page.wait_for_selector('button:has-text("Akzeptieren")', timeout=2000)
            if btn:
                btn.click()
                time.sleep(1)
        except:
            pass

        # Suchfeld – ElementHandle.fill() löscht erst den Inhalt, dann schreiben
        search_inp = page.wait_for_selector('input[type="search"], input[placeholder*="such"], input[name="q"]', timeout=5000)
        search_inp.click()
        time.sleep(0.2)
        # Alles markieren & ersetzen
        page.keyboard.press('Control+a')
        search_inp.fill(query)
        time.sleep(0.5)
        page.keyboard.press('Enter')
        time.sleep(4)

        logger.info(f"[Tutti] Suche '{query}' → {page.title()[:60]}")

        # Alle /vi/ Links holen
        all_links = page.query_selector_all('a[href*="/vi/"]')
        immo_links = [l for l in all_links
                      if '/immobilien/wohnungen/' in (l.get_attribute('href') or '')]
        logger.info(f'[Tutti] {len(immo_links)} Wohnungs-Links')

        seen_hrefs = set()
        for link in immo_links:
            href = link.get_attribute('href') or ''
            if href in seen_hrefs:
                continue
            seen_hrefs.add(href)

            try:
                parent = link.evaluate_handle('el => el.closest("li, article, div[class*=\\"Ad\\"]")')
                el = parent.as_element()
                if not el:
                    el = link  # Fallback: Link selbst
            except:
                el = link

            listing = parse_card(el, cfg)
            if listing and listing['external_id'] not in seen_ids:
                seen_ids.add(listing['external_id'])
                pts, label = score_listing(listing, cfg)
                listing.update({'score_points': pts, 'score': label})
                results.append(listing)

    except Exception as e:
        logger.error(f"[Tutti] Fehler bei '{location}': {e}")

    return results


def scrape(cfg: dict = None) -> list[dict]:
    if cfg is None:
        cfg = load_config()

    try:
        from patchright.sync_api import sync_playwright
    except ImportError:
        logger.error('[Tutti] patchright fehlt')
        return []

    locations = [l for l in cfg['search']['locations'] if l.lower() not in ['konstanz']]
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
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        )
        page = context.new_page()

        for i, location in enumerate(locations):
            if i > 0:
                pause = random.uniform(*RATE_PAUSE)
                logger.info(f'[Tutti] Pause {pause:.1f}s...')
                time.sleep(pause)

            batch = scrape_location(page, location, cfg, seen_ids)
            results.extend(batch)
            logger.info(f"[Tutti] '{location}': {len(batch)} neu")

        context.close()
        browser.close()

    logger.info(f'[Tutti] Total: {len(results)} Inserate')
    return results
