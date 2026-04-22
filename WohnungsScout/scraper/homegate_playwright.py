"""
WohnungsScout – Homegate.ch Scraper (Patchright + Session-Recycling)
=====================================================================
Nutzt eine gespeicherte Browser-Session um DataDome zu umgehen.
Session wird einmalig manuell erstellt via: python session_manager.py

Strategien für Daten-Extraktion:
  1. window.__INITIAL_STATE__ JSON (vollständige Daten)
  2. HTML-Karten [class*="ListItem"] als Fallback
"""
import re
import logging
import time
import random
import json
from pathlib import Path
from scraper.scorer import score_listing, load_config

logger = logging.getLogger(__name__)
RATE_PAUSE   = (10, 22)
SESSION_FILE = Path(__file__).parent.parent / 'homegate_session.json'


# ─────────────────────────────────────────────
# URL-Builder
# ─────────────────────────────────────────────

def _to_slug(location: str) -> str:
    """Ortsnamen → Homegate-konformer Slug."""
    return (
        location.lower()
        .replace('ä', 'a').replace('ö', 'o').replace('ü', 'u')
        .replace(' ', '-')
    )


def build_url(location: str, cfg: dict) -> str:
    """Baut die korrekte Homegate Suchergebnis-URL.
    Format: /mieten/wohnung/ort-{slug}/trefferliste
    """
    flt = cfg['filter']
    slug = _to_slug(location)
    params = []
    if flt.get('max_price_chf'):
        params.append(f"ep={flt['max_price_chf']}")
    if flt.get('min_rooms'):
        params.append(f"rof={int(flt['min_rooms'])}")
    if flt.get('min_area_m2'):
        params.append(f"af={flt['min_area_m2']}")
    qs = ('?' + '&'.join(params)) if params else ''
    return f"https://www.homegate.ch/mieten/wohnung/ort-{slug}/trefferliste{qs}"


# ─────────────────────────────────────────────
# Session-Management
# ─────────────────────────────────────────────

def _load_session() -> dict | None:
    """Lädt gespeicherte Cookies. Gibt None zurück wenn fehlend/abgelaufen."""
    if not SESSION_FILE.exists():
        logger.warning(
            '[Homegate] Keine Session gefunden – bitte einmalig ausführen:\n'
            '           python session_manager.py'
        )
        return None

    try:
        from datetime import datetime
        data = json.loads(SESSION_FILE.read_text(encoding='utf-8'))
        saved_at  = datetime.fromisoformat(data['saved_at'])
        age_hours = (datetime.utcnow() - saved_at).total_seconds() / 3600

        if age_hours > 23:
            logger.warning(
                f'[Homegate] Session abgelaufen ({age_hours:.1f}h alt) – bitte erneuern:\n'
                '           python session_manager.py'
            )
            return None

        logger.info(f'[Homegate] Session geladen ({age_hours:.1f}h alt, {len(data["cookies"])} Cookies)')
        return data

    except Exception as e:
        logger.warning(f'[Homegate] Session-Datei defekt: {e}')
        return None


def _inject_cookies(context, session: dict) -> None:
    """Injiziert Cookies in den Browser-Kontext."""
    cookies = session.get('cookies', [])
    if cookies:
        context.add_cookies(cookies)
        logger.debug(f'[Homegate] {len(cookies)} Cookies injiziert')


def _is_captcha_page(page) -> bool:
    """Prüft ob DataDome-Captcha aktiv ist."""
    try:
        return bool(page.query_selector(
            'text=Nach rechts schieben, '
            'text=Wir vergewissern uns, '
            '[id*="datadome"], '
            '[class*="datadome"]'
        ))
    except Exception:
        return False


# ─────────────────────────────────────────────
# Daten-Extraktion
# ─────────────────────────────────────────────

def _extract_initial_state(page) -> list:
    """
    Liest window.__INITIAL_STATE__ aus dem Script-Tag.
    JSON-Pfad: resultList.search.fullSearch.result.listings
    """
    try:
        raw = page.evaluate(r"""() => {
            const scripts = Array.from(document.querySelectorAll('script'));
            for (const s of scripts) {
                const t = s.textContent || '';
                if (t.includes('__INITIAL_STATE__')) {
                    const match = t.match(/window\.__INITIAL_STATE__\s*=\s*(\{.+\})/s);
                    if (match) return match[1];
                }
            }
            try { return JSON.stringify(window.__INITIAL_STATE__); } catch(e) {}
            return null;
        }""")

        if not raw:
            return []

        data     = json.loads(raw)
        listings = (
            data
            .get('resultList', {})
            .get('search', {})
            .get('fullSearch', {})
            .get('result', {})
            .get('listings', [])
        )
        if listings:
            logger.info(f'[Homegate] __INITIAL_STATE__: {len(listings)} Listings')
        return listings

    except Exception as e:
        logger.debug(f'[Homegate] __INITIAL_STATE__ Fehler: {e}')
        return []


def _parse_listing_json(item: dict) -> dict | None:
    """Normalisiert einen Homegate Listing-Eintrag aus JSON."""
    try:
        listing = item.get('listing', item)
        id_     = listing.get('id', '')
        if not id_:
            return None

        props   = listing.get('characteristics', {})
        address = listing.get('address', {})

        title      = listing.get('title', {})
        title_text = title.get('de', '') if isinstance(title, dict) else str(title or '')

        desc      = listing.get('description', {})
        desc_text = desc.get('de', '') if isinstance(desc, dict) else str(desc or '')
        combined  = (title_text + ' ' + desc_text).lower()

        price = None
        rent  = listing.get('prices', {}).get('rent', {})
        if isinstance(rent, dict):
            price = rent.get('gross') or rent.get('net')
        elif isinstance(rent, (int, float)):
            price = int(rent)

        return {
            'source':      'homegate',
            'external_id': f'homegate_{id_}',
            'url':         f'https://www.homegate.ch/mieten/{id_}',
            'title':       title_text[:200],
            'address':     f"{address.get('street','')} {address.get('houseNumber','')}".strip(),
            'city':        address.get('locality', ''),
            'zip_code':    str(address.get('postalCode', '')),
            'rooms':       float(props['numberOfRooms']) if props.get('numberOfRooms') else None,
            'area_m2':     int(props['livingSpace'])     if props.get('livingSpace')    else None,
            'price_chf':   int(price)                    if price                       else None,
            'has_parking': any(k in combined for k in ['parkplatz', 'garage', 'tiefgarage']),
            'has_balcony': any(k in combined for k in ['balkon', 'terrasse', 'loggia']),
            'description': desc_text[:500],
        }
    except Exception as e:
        logger.debug(f'[Homegate] JSON-Parse Fehler: {e}')
        return None


def _parse_html_fallback(page, location: str) -> list:
    """
    Fallback: HTML-Karten parsen via [class*="ListItem"].
    Filtert Footer-Links heraus (nur Karten mit /mieten/{ID} Links).
    """
    results = []
    try:
        all_items = page.query_selector_all('[class*="ListItem"]')
        seen_ids  = set()

        for item in all_items:
            try:
                link_el = item.query_selector('a[href*="/mieten/"]')
                if not link_el:
                    continue
                href = link_el.get_attribute('href') or ''
                # Nur echte Inserat-Links (numerische ID am Ende)
                id_ = href.rstrip('/').split('?')[0].split('/')[-1]
                if not id_ or not id_.isdigit() or id_ in seen_ids:
                    continue
                seen_ids.add(id_)

                url  = f'https://www.homegate.ch{href}' if href.startswith('/') else href
                text = item.inner_text()

                price_m = re.search(r"CHF\s*([\d'''\u2019\s]+)[.–\-]", text)
                if not price_m:
                    price_m = re.search(r"([\d'''\u2019]{4,})[.–\-]", text)
                price = None
                if price_m:
                    raw = re.sub(r"['''\u2019\s]", '', price_m.group(1))
                    if raw.isdigit() and 500 <= int(raw) <= 20000:
                        price = int(raw)

                rooms_m = re.search(r'(\d+[.,]\d*|\d+)\s*[Zz]immer', text)
                rooms   = float(rooms_m.group(1).replace(',', '.')) if rooms_m else None

                area_m = re.search(r'(\d+)\s*m[²2]', text)
                area   = int(area_m.group(1)) if area_m else None

                city     = location
                zip_code = ''
                zip_m    = re.search(r'(\d{4})\s+([A-Za-zÄäÖöÜü][^\n,]+)', text)
                if zip_m:
                    zip_code = zip_m.group(1)
                    city     = zip_m.group(2).strip()

                lines = [l.strip() for l in text.split('\n') if l.strip()]
                results.append({
                    'source':      'homegate',
                    'external_id': f'homegate_{id_}',
                    'url':         url,
                    'title':       lines[0][:200] if lines else '',
                    'address':     '',
                    'city':        city,
                    'zip_code':    zip_code,
                    'rooms':       rooms,
                    'area_m2':     area,
                    'price_chf':   price,
                    'has_parking': any(k in text.lower() for k in ['parkplatz', 'garage', 'tiefgarage']),
                    'has_balcony': any(k in text.lower() for k in ['balkon', 'terrasse', 'loggia']),
                    'description': text[:400],
                })
            except Exception as e:
                logger.debug(f'[Homegate] HTML-Card Fehler: {e}')

        if results:
            logger.info(f'[Homegate] HTML-Fallback: {len(results)} Inserate')
        else:
            logger.warning('[Homegate] HTML-Fallback: 0 Inserate – Selektoren ggf. veraltet')

    except Exception as e:
        logger.error(f'[Homegate] HTML-Fallback Fehler: {e}')
    return results


# ─────────────────────────────────────────────
# Haupt-Scrape-Funktion
# ─────────────────────────────────────────────

def scrape(cfg: dict = None) -> list[dict]:
    """Scrapt Homegate.ch für alle konfigurierten Orte mit Session-Recycling."""
    if cfg is None:
        cfg = load_config()

    try:
        from patchright.sync_api import sync_playwright
    except ImportError:
        logger.error('[Homegate] patchright fehlt – pip install patchright')
        return []

    # Session laden
    session = _load_session()
    if not session:
        logger.warning('[Homegate] Überspringe – keine gültige Session vorhanden.')
        return []

    # Konstanz überspringen (DE-Ort, nicht auf homegate.ch)
    locations = [loc for loc in cfg['search']['locations'] if loc.lower() != 'konstanz']
    results   = []
    seen_ids  = set()

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=False,
            args=[
                '--no-sandbox',
                '--window-position=-9999,-9999',
                '--window-size=1366,900',
                '--disable-blink-features=AutomationControlled',
            ],
        )
        context = browser.new_context(
            viewport     = {'width': 1366, 'height': 900},
            locale       = 'de-CH',
            timezone_id  = 'Europe/Zurich',
            user_agent   = session.get(
                'user_agent',
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
            ),
        )
        context.add_init_script(
            "Object.defineProperty(navigator, 'webdriver', { get: () => undefined });"
        )

        # Cookies vor dem ersten Request injizieren
        _inject_cookies(context, session)

        page = context.new_page()

        for i, location in enumerate(locations):
            if i > 0:
                pause = random.uniform(*RATE_PAUSE)
                logger.info(f'[Homegate] Pause {pause:.1f}s...')
                time.sleep(pause)

            url = build_url(location, cfg)
            logger.info(f"[Homegate] Suche '{location}': {url}")

            try:
                page.goto(url, wait_until='domcontentloaded', timeout=35000)
                page.wait_for_timeout(random.randint(2000, 3500))

                # Session-Check: Captcha trotzdem aktiv?
                if _is_captcha_page(page):
                    logger.error(
                        '[Homegate] Session abgelaufen – DataDome-Captcha aktiv!\n'
                        '           Bitte erneuern: python session_manager.py'
                    )
                    break  # Alle weiteren Orte überspringen

                # Cookie-Banner (seltener nach Login)
                try:
                    btn = page.wait_for_selector(
                        'button:has-text("Akzeptieren"), button:has-text("Alle akzeptieren")',
                        timeout=3000
                    )
                    if btn:
                        btn.click()
                        time.sleep(0.5)
                except Exception:
                    pass

                batch = []

                # Strategie 1: __INITIAL_STATE__
                raw_items = _extract_initial_state(page)
                if raw_items:
                    for item in raw_items:
                        listing = _parse_listing_json(item)
                        if listing and listing['external_id'] not in seen_ids:
                            seen_ids.add(listing['external_id'])
                            pts, lbl = score_listing(listing, cfg)
                            listing.update({'score_points': pts, 'score': lbl})
                            batch.append(listing)
                else:
                    # Strategie 2: HTML-Karten
                    logger.info('[Homegate] Kein __INITIAL_STATE__ → HTML-Fallback')
                    html_items = _parse_html_fallback(page, location)
                    for listing in html_items:
                        if listing['external_id'] not in seen_ids:
                            seen_ids.add(listing['external_id'])
                            pts, lbl = score_listing(listing, cfg)
                            listing.update({'score_points': pts, 'score': lbl})
                            batch.append(listing)

                results.extend(batch)
                logger.info(f"[Homegate] '{location}': {len(batch)} Inserate")

            except Exception as e:
                logger.error(f"[Homegate] Fehler bei '{location}': {e}")

        context.close()
        browser.close()

    logger.info(f'[Homegate] Total: {len(results)} Inserate')
    return results
