"""
WohnungsScout – Homegate Session Manager
=========================================
Öffnet einen sichtbaren Browser bei Homegate.ch.
Du löst das DataDome-Captcha einmalig manuell.
Die Session-Cookies werden gespeichert und vom Scraper wiederverwendet.

VERWENDUNG:
  python session_manager.py

Danach läuft der Homegate-Scraper automatisch mit der gespeicherten Session.
"""
import json
import sys
import logging
import time
from pathlib import Path
from datetime import datetime, timedelta

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

SESSION_FILE = Path(__file__).parent / 'homegate_session.json'
TARGET_URL = 'https://www.homegate.ch/mieten/wohnung/ort-kreuzlingen/trefferliste'


def save_session(context, browser) -> bool:
    """Speichert Cookies + LocalStorage in homegate_session.json."""
    try:
        cookies = context.cookies()
        if not cookies:
            logger.warning('Keine Cookies gefunden.')
            return False

        # Datadome-Cookie prüfen
        dd_cookie = next((c for c in cookies if 'datadome' in c['name'].lower()), None)
        if not dd_cookie:
            logger.warning('⚠️  Kein DataDome-Cookie gefunden – Session ist möglicherweise nicht gültig.')

        session_data = {
            'saved_at': datetime.utcnow().isoformat(),
            'expires_estimate': (datetime.utcnow() + timedelta(hours=24)).isoformat(),
            'cookies': cookies,
            'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        }

        SESSION_FILE.write_text(json.dumps(session_data, indent=2), encoding='utf-8')
        logger.info(f'✅ Session gespeichert: {SESSION_FILE}')
        logger.info(f'   {len(cookies)} Cookies gespeichert')
        if dd_cookie:
            logger.info(f'   DataDome-Cookie: {dd_cookie["name"]} ✅')
        return True

    except Exception as e:
        logger.error(f'Fehler beim Speichern der Session: {e}')
        return False


def load_session() -> dict | None:
    """Lädt eine gespeicherte Session. Gibt None zurück wenn keine/abgelaufen."""
    if not SESSION_FILE.exists():
        return None

    try:
        data = json.loads(SESSION_FILE.read_text(encoding='utf-8'))
        saved_at = datetime.fromisoformat(data['saved_at'])
        age_hours = (datetime.utcnow() - saved_at).total_seconds() / 3600

        if age_hours > 23:
            logger.warning(f'⚠️  Session abgelaufen (Alter: {age_hours:.1f}h) – bitte erneuern.')
            return None

        logger.info(f'Session geladen (Alter: {age_hours:.1f}h, {len(data["cookies"])} Cookies)')
        return data
    except Exception as e:
        logger.warning(f'Session-Datei defekt: {e}')
        return None


def is_session_valid(session_data: dict) -> bool:
    """Schnellprüfung ob Session wahrscheinlich noch gültig ist."""
    if not session_data:
        return False
    cookies = session_data.get('cookies', [])
    return any('datadome' in c['name'].lower() for c in cookies)


def run_interactive_login():
    """
    Interaktiver Browser-Login:
    1. Browser öffnet Homegate
    2. Benutzer löst Captcha manuell
    3. Script wartet auf Bestätigung
    4. Cookies werden gespeichert
    """
    try:
        from patchright.sync_api import sync_playwright
    except ImportError:
        logger.error('patchright fehlt: pip install patchright')
        sys.exit(1)

    logger.info('=' * 55)
    logger.info('  WohnungsScout – Homegate Session einrichten')
    logger.info('=' * 55)
    logger.info('')
    logger.info('Ein Browser wird geöffnet. Bitte:')
    logger.info('  1. Das DataDome-Captcha manuell lösen (Schieberegler)')
    logger.info('  2. Sicherstellen, dass Wohnungsinserate sichtbar sind')
    logger.info('  3. Danach zurückkommen und ENTER drücken')
    logger.info('')

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=False,
            args=[
                '--no-sandbox',
                '--window-size=1366,900',
                # KEIN --window-position=-9999... da der User den Browser sehen muss!
            ],
        )
        context = browser.new_context(
            viewport={'width': 1366, 'height': 900},
            locale='de-CH',
            timezone_id='Europe/Zurich',
            user_agent=(
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                'AppleWebKit/537.36 (KHTML, like Gecko) '
                'Chrome/124.0.0.0 Safari/537.36'
            ),
        )
        context.add_init_script(
            "Object.defineProperty(navigator, 'webdriver', { get: () => undefined });"
        )
        page = context.new_page()

        logger.info(f'Öffne: {TARGET_URL}')
        try:
            page.goto(TARGET_URL, wait_until='domcontentloaded', timeout=30000)
        except Exception as e:
            logger.warning(f'Seite ggf. nicht vollständig geladen: {e}')

        logger.info('')
        logger.info('>>> Browser ist geöffnet. Bitte Captcha lösen...')
        logger.info('>>> Sobald Wohnungen sichtbar sind: ENTER drücken')
        logger.info('')

        try:
            input('Drücke ENTER wenn bereit... ')
        except KeyboardInterrupt:
            logger.info('\nAbgebrochen.')
            context.close()
            browser.close()
            return False

        # Aktuelle URL und Seiteninhalt prüfen
        current_url = page.url
        logger.info(f'Aktuelle URL: {current_url}')

        # Kurz prüfen ob Inserate sichtbar
        try:
            items = page.query_selector_all('[class*="ListItem"]')
            logger.info(f'Sichtbare Listenelemente: {len(items)}')
        except Exception:
            pass

        # Session speichern
        success = save_session(context, browser)

        # Kurz warten dann Browser schliessen
        if success:
            logger.info('')
            logger.info('✅ Session gespeichert! Browser wird in 3 Sekunden geschlossen.')
            time.sleep(3)
        else:
            logger.error('❌ Session konnte nicht gespeichert werden. Bitte erneut versuchen.')
            input('ENTER zum Beenden...')

        context.close()
        browser.close()
        return success


def check_session_status() -> dict:
    """Gibt den aktuellen Status der Session zurück."""
    if not SESSION_FILE.exists():
        return {'status': 'missing', 'message': 'Keine Session vorhanden'}

    session = load_session()
    if session is None:
        return {'status': 'expired', 'message': 'Session abgelaufen – bitte erneuern'}

    saved_at = datetime.fromisoformat(session['saved_at'])
    age_hours = (datetime.utcnow() - saved_at).total_seconds() / 3600
    dd_ok = is_session_valid(session)

    return {
        'status': 'valid' if dd_ok else 'warning',
        'message': f'Session {age_hours:.1f}h alt, DataDome: {"✅" if dd_ok else "❌"}',
        'age_hours': age_hours,
        'has_datadome': dd_ok,
        'cookie_count': len(session.get('cookies', [])),
        'saved_at': session['saved_at'],
    }


if __name__ == '__main__':
    if '--status' in sys.argv:
        status = check_session_status()
        print(f"\nSession-Status: {status['status'].upper()}")
        print(f"  {status['message']}")
    else:
        run_interactive_login()
