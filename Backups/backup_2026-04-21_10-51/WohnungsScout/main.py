"""
WohnungsScout – Hauptprogramm
Startet: FastAPI Server + APScheduler
"""
import os, sys
# Windows UTF-8 Fix
os.environ['PYTHONUTF8'] = '1'
os.environ['PYTHONIOENCODING'] = 'utf-8'

import uvicorn
import logging
import yaml
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.triggers.cron import CronTrigger

# Logging konfigurieren
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
    handlers=[
        logging.StreamHandler(open(sys.stdout.fileno(), mode='w', encoding='utf-8', closefd=False)),
        logging.FileHandler('wohnungsscout.log', encoding='utf-8'),
    ]
)
logger = logging.getLogger(__name__)

# Pfad für Imports
sys.path.insert(0, os.path.dirname(__file__))

from db.models import init_db
from scraper.runner import run_all


def load_config():
    with open('config.yaml', 'r', encoding='utf-8') as f:
        return yaml.safe_load(f)


def start():
    # DB initialisieren
    init_db()
    cfg = load_config()

    # Scheduler starten
    scheduler = BackgroundScheduler()
    interval = cfg['schedule'].get('interval_minutes', 30)
    summary_time = cfg['schedule'].get('daily_summary_time', '08:00')
    hour, minute = summary_time.split(':')

    # Regelmässiger Scraper-Lauf
    scheduler.add_job(
        run_all,
        trigger=IntervalTrigger(minutes=interval),
        id='scraper',
        name=f'Scraper alle {interval} Minuten',
        replace_existing=True,
    )

    # Tägliche Zusammenfassung (TODO: E-Mail)
    scheduler.add_job(
        lambda: logger.info("=== Tägliche Zusammenfassung (E-Mail TODO) ==="),
        trigger=CronTrigger(hour=int(hour), minute=int(minute)),
        id='daily_summary',
        name='Tägliche Zusammenfassung',
        replace_existing=True,
    )

    scheduler.start()
    logger.info(f"✅ Scheduler gestartet – Scraper alle {interval} Min")

    # Sofort ersten Lauf starten
    logger.info("🚀 Erster Scraper-Lauf...")
    run_all()

    # API starten
    logger.info("🌐 Dashboard: http://localhost:8000")
    from api.main import app
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="warning")


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'scrape':
        # Nur scrapen, kein Server
        init_db()
        stats = run_all()
        print(f"\n✅ Fertig: {stats}")
    else:
        start()
