"""
WohnungsScout – Scraper-Orchestrator
Führt alle Scraper aus, speichert Resultate, erkennt Duplikate & Änderungen
"""
import logging
import json
from datetime import datetime
from sqlalchemy.orm import Session as SaSession
from db.models import Listing, ScrapeLog, Session, init_db
from scraper import newhome
from scraper import immoscout24
from scraper import homegate_playwright
from scraper import tutti
from scraper import anibis
from scraper.scorer import load_config

logger = logging.getLogger(__name__)


def upsert_listing(session: SaSession, data: dict) -> tuple[str, bool]:
    """
    Einfügen oder Aktualisieren eines Inserats.
    Gibt ('new'|'updated'|'unchanged', is_new) zurück.
    """
    existing = session.query(Listing).filter_by(
        source=data['source'],
        external_id=data['external_id']
    ).first()

    if existing is None:
        # Neues Inserat
        listing = Listing(**{k: v for k, v in data.items() if hasattr(Listing, k)})
        listing.first_seen = datetime.utcnow()
        listing.last_seen = datetime.utcnow()
        listing.price_history = json.dumps([{
            'price': data.get('price_chf'),
            'date': datetime.utcnow().isoformat()
        }])
        session.add(listing)
        return 'new', True

    else:
        # Bestehendes Inserat aktualisieren
        changed = False

        # Preisänderung erkennen
        if data.get('price_chf') and existing.price_chf != data['price_chf']:
            history = existing.price_history_list()
            history.append({
                'price': data['price_chf'],
                'date': datetime.utcnow().isoformat(),
                'change': data['price_chf'] - (existing.price_chf or 0)
            })
            existing.price_history = json.dumps(history)
            existing.price_chf = data['price_chf']
            changed = True
            logger.info(f"[Upsert] Preisänderung: {existing.external_id}: "
                       f"{existing.price_chf} → {data['price_chf']}")

        # Score aktualisieren
        existing.score = data.get('score', existing.score)
        existing.score_points = data.get('score_points', existing.score_points)
        existing.last_seen = datetime.utcnow()
        existing.status = 'active'

        return 'updated' if changed else 'unchanged', False


def run_all() -> dict:
    """Führt alle Scraper aus und speichert Ergebnisse."""
    init_db()
    cfg = load_config()
    session = Session()
    stats = {'new': 0, 'updated': 0, 'unchanged': 0, 'errors': 0}

    scrapers = [
        ('newhome',     newhome.scrape),
        ('immoscout24', immoscout24.scrape),
        ('homegate',    homegate_playwright.scrape),   # Session via: python session_manager.py
        ('tutti',       tutti.scrape),
        ('anibis',      anibis.scrape),
    ]

    for source_name, scrape_fn in scrapers:
        log = ScrapeLog(source=source_name, started_at=datetime.utcnow())
        session.add(log)
        new_c = upd_c = 0

        try:
            listings = scrape_fn(cfg)
            for data in listings:
                try:
                    result, is_new = upsert_listing(session, data)
                    stats[result] += 1
                    if result == 'new': new_c += 1
                    elif result == 'updated': upd_c += 1
                except Exception as e:
                    logger.error(f"[Upsert] Fehler: {e}")
                    stats['errors'] += 1

            session.commit()
            log.finished_at = datetime.utcnow()
            log.new_count = new_c
            log.updated_count = upd_c
            session.commit()
            logger.info(f"[{source_name}] ✅ {new_c} neu, {upd_c} aktualisiert")

        except Exception as e:
            logger.error(f"[{source_name}] ❌ Fehler: {e}")
            log.error = str(e)
            log.finished_at = datetime.utcnow()
            session.commit()
            stats['errors'] += 1

    session.close()
    logger.info(f"[Scraper] Fertig: {stats}")
    return stats
