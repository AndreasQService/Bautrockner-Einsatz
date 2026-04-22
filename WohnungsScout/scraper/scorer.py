"""
WohnungsScout – Score-Engine
Bewertet Inserate nach konfigurierbaren Kriterien
"""
import yaml, os

def load_config():
    path = os.path.join(os.path.dirname(__file__), '..', 'config.yaml')
    with open(path, 'r', encoding='utf-8') as f:
        return yaml.safe_load(f)


def score_listing(listing_dict: dict, cfg: dict = None) -> tuple[int, str]:
    """
    Gibt (punkte, label) zurück.
    label: 'top' | 'gut' | 'mittel' | 'schwach'
    """
    if cfg is None:
        cfg = load_config()

    sc = cfg.get('scoring', {})
    flt = cfg.get('filter', {})
    prefs = cfg.get('preferences', {})

    points = 0

    # Parkplatz
    if listing_dict.get('has_parking') and prefs.get('prefer_parking'):
        points += sc.get('parking', 20)

    # Balkon
    if listing_dict.get('has_balcony') and prefs.get('prefer_balcony'):
        points += sc.get('balcony', 15)

    # Preis deutlich unter Maximum
    price = listing_dict.get('price_chf') or 0
    max_price = flt.get('max_price_chf', 9999)
    if price > 0 and price <= max_price - 200:
        points += sc.get('price_below_max', 25)

    # Fläche grosszügig
    area = listing_dict.get('area_m2') or 0
    min_area = flt.get('min_area_m2', 0)
    if area > 0 and area >= min_area + 20:
        points += sc.get('large_area', 10)

    # Modernes Gebäude (Keyword in Beschreibung)
    desc = (listing_dict.get('description') or '').lower()
    title = (listing_dict.get('title') or '').lower()
    modern_keywords = ['neubau', 'neu erbaut', '2020', '2021', '2022', '2023', '2024', 'minergie', 'renoviert']
    if prefs.get('prefer_modern') and any(k in desc or k in title for k in modern_keywords):
        points += sc.get('modern', 10)

    # Label
    if points >= 60:
        label = 'top'
    elif points >= 40:
        label = 'gut'
    elif points >= 20:
        label = 'mittel'
    else:
        label = 'schwach'

    return points, label
