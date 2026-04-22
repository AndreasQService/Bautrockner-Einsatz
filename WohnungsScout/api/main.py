"""
WohnungsScout – FastAPI Backend
REST API für das Dashboard
"""
from fastapi import FastAPI, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy import desc, and_
from db.models import Listing, Favorite, ScrapeLog, Session, init_db
from scraper.runner import run_all
import os, threading

app = FastAPI(title="WohnungsScout API", version="1.0.0")

UI_DIR = os.path.join(os.path.dirname(__file__), '..', 'ui')
app.mount("/ui", StaticFiles(directory=UI_DIR), name="ui")


@app.on_event("startup")
def startup():
    init_db()


@app.get("/")
def root():
    return FileResponse(os.path.join(UI_DIR, 'index.html'))


# ── Listings ─────────────────────────────────────────────────────

@app.get("/api/listings")
def get_listings(
    score: str = Query(None, description="top|gut|mittel|schwach"),
    source: str = Query(None),
    min_rooms: float = Query(None),
    max_price: int = Query(None),
    city: str = Query(None),
    parking: bool = Query(None),
    balcony: bool = Query(None),
    limit: int = Query(100),
    offset: int = Query(0),
):
    session = Session()
    try:
        q = session.query(Listing).filter(Listing.status == 'active')

        if score:
            q = q.filter(Listing.score == score)
        if source:
            q = q.filter(Listing.source == source)
        if min_rooms:
            q = q.filter(Listing.rooms >= min_rooms)
        if max_price:
            q = q.filter(Listing.price_chf <= max_price)
        if city:
            q = q.filter(Listing.city.ilike(f'%{city}%'))
        if parking is True:
            q = q.filter(Listing.has_parking == True)
        if balcony is True:
            q = q.filter(Listing.has_balcony == True)

        total = q.count()
        listings = q.order_by(desc(Listing.score_points), desc(Listing.first_seen)) \
                    .offset(offset).limit(limit).all()

        return {
            'total': total,
            'listings': [l.to_dict() for l in listings]
        }
    finally:
        session.close()


@app.get("/api/listings/{listing_id}")
def get_listing(listing_id: int):
    session = Session()
    try:
        l = session.query(Listing).get(listing_id)
        if not l:
            return JSONResponse(status_code=404, content={'error': 'Nicht gefunden'})
        return l.to_dict()
    finally:
        session.close()


# ── Favorites ─────────────────────────────────────────────────────

@app.get("/api/favorites")
def get_favorites():
    session = Session()
    try:
        favs = session.query(Favorite).all()
        result = []
        for f in favs:
            l = session.query(Listing).get(f.listing_id)
            result.append({
                'fav_id': f.id,
                'notes': f.notes,
                'added_at': f.added_at.isoformat() if f.added_at else None,
                'listing': l.to_dict() if l else None,
            })
        return result
    finally:
        session.close()


@app.post("/api/favorites/{listing_id}")
def add_favorite(listing_id: int, notes: str = ''):
    session = Session()
    try:
        existing = session.query(Favorite).filter_by(listing_id=listing_id).first()
        if existing:
            return {'status': 'already_exists'}
        fav = Favorite(listing_id=listing_id, notes=notes)
        session.add(fav)
        session.commit()
        return {'status': 'added', 'id': fav.id}
    finally:
        session.close()


@app.delete("/api/favorites/{listing_id}")
def remove_favorite(listing_id: int):
    session = Session()
    try:
        session.query(Favorite).filter_by(listing_id=listing_id).delete()
        session.commit()
        return {'status': 'removed'}
    finally:
        session.close()


# ── Stats & Control ───────────────────────────────────────────────

@app.get("/api/stats")
def get_stats():
    session = Session()
    try:
        total = session.query(Listing).filter_by(status='active').count()
        new_today = session.query(Listing).filter(
            Listing.first_seen >= __import__('datetime').datetime.utcnow().replace(hour=0, minute=0, second=0)
        ).count()
        by_score = {}
        for score in ['top', 'gut', 'mittel', 'schwach']:
            by_score[score] = session.query(Listing).filter_by(score=score, status='active').count()

        last_log = session.query(ScrapeLog).order_by(desc(ScrapeLog.finished_at)).first()
        return {
            'total': total,
            'new_today': new_today,
            'by_score': by_score,
            'last_run': last_log.finished_at.isoformat() if last_log and last_log.finished_at else None,
            'last_new': last_log.new_count if last_log else 0,
        }
    finally:
        session.close()


@app.post("/api/scrape/now")
def scrape_now():
    """Startet sofortigen Scraper-Lauf (async)."""
    def run():
        run_all()
    threading.Thread(target=run, daemon=True).start()
    return {'status': 'started', 'message': 'Scraper läuft im Hintergrund...'}


# ── Session Management ─────────────────────────────────────────────

@app.get("/api/session/homegate")
def homegate_session_status():
    """Zeigt Status der Homegate-Session (für Dashboard-Anzeige)."""
    import sys, os
    sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
    from session_manager import check_session_status
    return check_session_status()


@app.post("/api/session/homegate/renew")
def homegate_session_renew():
    """Öffnet den interaktiven Session-Manager in einem neuen Prozess."""
    import subprocess, sys, os
    script = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'session_manager.py')
    python = sys.executable
    # Nicht-blockierend starten – User interagiert mit Browser
    subprocess.Popen([python, script], creationflags=getattr(subprocess, 'CREATE_NEW_CONSOLE', 0))
    return {
        'status': 'started',
        'message': 'Session-Manager geöffnet – bitte Captcha im Browser lösen, dann ENTER drücken.'
    }
