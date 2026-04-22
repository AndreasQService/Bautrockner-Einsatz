"""
WohnungsScout – Anibis.ch Scraper (Patchright Stealth)
Anibis ist eine Schweizer Kleinanzeigen-Plattform.
Kategorie 37 = Wohnungsmiete
"""
import re, time, random, logging
from scraper.scorer import score_listing, load_config

logger = logging.getLogger(__name__)
RATE_PAUSE = (6, 14)


def build_url(location: str, cfg: dict) -> str:
    flt = cfg['filter']
    # Anibis Kategorie 37 = Wohnungsmiete
    # Ort wird als Suchbegriff uebergeben
    import urllib.parse
    loc_enc = urllib.parse.quote(location)
    params = ['sort=1']  # sort=1 = neueste zuerst
    if flt.get('max_price_chf'):
        params.append(f'pmax={flt["max_price_chf"]}')
    if flt.get('min_rooms'):
        params.append(f'rmin={int(flt["min_rooms"])}')
    return f"https://www.anibis.ch/de/c/immobilien-wohnungsmiete--37/{loc_enc}?{'&'.join(params)}"


def parse_card(card, location: str, cfg: dict) -> dict | None:
    try:
        link_el = card.query_selector('a[href]')
        href = link_el.get_attribute('href') if link_el else ''
        url = ('https://www.anibis.ch' + href) if href and href.startswith('/') else href
        ext_id = href.split('/')[-1].split('?')[0] if href else ''
        if not ext_id or not href:
            return None

        text = card.inner_text()

        # Preis
        price_match = re.search(r"([\d']+)\s*(?:CHF|Fr\.?|.-)?", text.replace('\u2019', ''))
        price = int(re.sub(r"'", '', price_match.group(1))) if price_match else None

        # Zimmer
        rooms_match = re.search(r'(\d+[.,]?\d*)\s*[Zz]i(?:mmer)?', text)
        if not rooms_match:
            rooms_match = re.search(r'(\d+[.,]?\d*)\s*[Zz]', text)
        rooms = float(rooms_match.group(1).replace(',', '.')) if rooms_match else None

        # Flaeche
        area_match = re.search(r'(\d+)\s*m[²2]', text)
        area = int(area_match.group(1)) if area_match else None

        # Ort / PLZ
        plz_match = re.search(r'(\d{4})\s+([\w\s]+)', text)
        city = plz_match.group(2).strip()[:30] if plz_match else location
        zip_code = plz_match.group(1) if plz_match else ''

        # Titel
        title_el = card.query_selector('h2, h3, [class*="title"], [class*="Title"], strong')
        title = title_el.inner_text().strip()[:100] if title_el else text[:60]

        combined = text.lower()
        has_parking = any(k in combined for k in ['parkplatz', 'garage', 'tiefgarage', 'parking'])
        has_balcony = any(k in combined for k in ['balkon', 'terrasse', 'loggia'])

        flt = cfg.get('filter', {})
        max_p = flt.get('max_price_chf')
        if price and max_p and price > max_p * 1.1:  # 10% Toleranz
            return None

        return {
            'source': 'anibis',
            'external_id': f'anibis_{ext_id}',
            'url': url,
            'title': title,
            'city': city,
            'zip_code': zip_code,
            'price_chf': price,
            'rooms': rooms,
            'area_m2': area,
            'has_parking': has_parking,
            'has_balcony': has_balcony,
            'description': text[:300],
        }
    except Exception as e:
        logger.debug(f'[Anibis] Card-Fehler: {e}')
        return None


def scrape(cfg: dict = None) -> list[dict]:
    if cfg is None:
        cfg = load_config()

    try:
        from patchright.sync_api import sync_playwright
    except ImportError:
        logger.error('[Anibis] patchright fehlt: pip install patchright')
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
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        )
        page = context.new_page()

        for i, location in enumerate(locations):
            if location.lower() in ['konstanz']:
                continue

            if i > 0:
                pause = random.uniform(*RATE_PAUSE)
                logger.info(f'[Anibis] Pause {pause:.1f}s...')
                time.sleep(pause)

            url = build_url(location, cfg)
            logger.info(f"[Anibis] Suche '{location}'")

            try:
                page.goto(url, wait_until='domcontentloaded', timeout=25000)

                # Cookie-Banner
                try:
                    btn = page.wait_for_selector(
                        "button:has-text(\"J'accepte\"), button:has-text('Akzeptieren'), button:has-text('Alle')",
                        timeout=3000
                    )
                    if btn:
                        btn.click()
                        time.sleep(1)
                except:
                    pass

                page.wait_for_timeout(random.randint(2500, 4000))

                selectors = [
                    '[data-testid="ad-card"]',
                    '[class*="AdItem"]',
                    '[class*="adList"] li',
                    'article',
                    '.ad-list li',
                    '[class*="listing-item"]',
                ]
                cards = []
                for sel in selectors:
                    cards = page.query_selector_all(sel)
                    if len(cards) > 0:
                        logger.info(f"[Anibis] {len(cards)} Karten mit '{sel}'")
                        break

                if not cards:
                    # Fallback: alle Links mit /de/ad/ suchen
                    links = page.query_selector_all('a[href*="/de/ad/"]')
                    logger.info(f'[Anibis] {len(links)} Inserat-Links als Fallback')
                    for link in links:
                        try:
                            parent = link.evaluate_handle('el => el.closest("li, article, div[class]")')
                            if parent:
                                cards.append(parent.as_element())
                        except:
                            pass

                for card in cards:
                    listing = parse_card(card, location, cfg)
                    if listing and listing['external_id'] not in seen_ids:
                        seen_ids.add(listing['external_id'])
                        pts, label = score_listing(listing, cfg)
                        listing.update({'score_points': pts, 'score': label})
                        results.append(listing)

            except Exception as e:
                logger.error(f"[Anibis] Fehler '{location}': {e}")

        context.close()
        browser.close()

    logger.info(f'[Anibis] Total: {len(results)} Inserate')
    return results
