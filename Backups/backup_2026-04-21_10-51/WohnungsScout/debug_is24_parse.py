import os, sys, time, re
os.environ['PYTHONUTF8'] = '1'
sys.path.insert(0, '.')
from patchright.sync_api import sync_playwright
from scraper.immoscout24 import build_region_url
from scraper.scorer import load_config

cfg = load_config()
url = build_region_url(cfg)
print('URL:', url)

with sync_playwright() as p:
    b = p.chromium.launch(headless=False, args=['--no-sandbox', '--window-position=-9999,-9999', '--window-size=1366,900'])
    ctx = b.new_context(viewport={'width': 1366, 'height': 900}, locale='de-CH',
                        user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36')
    page = ctx.new_page()
    page.goto(url, timeout=30000)
    time.sleep(4)
    try:
        btn = page.wait_for_selector('button:has-text("Akzeptieren")', timeout=3000)
        btn.click()
        time.sleep(1)
    except:
        pass

    try:
        page.wait_for_selector('[class*="HgCardElevated"]', timeout=8000)
    except:
        pass
    time.sleep(2)

    cards = page.query_selector_all('[class*="HgCardElevated"]')
    print(f'Karten: {len(cards)}')
    for i, c in enumerate(cards[:5]):
        t = c.inner_text()
        print(f'\n--- Karte {i+1} ---')
        print(repr(t[:250]))

        # Preis-Extraktion testen
        price_match = re.search(r"CHF\s*([\d'''\u2019\s]+)[.\-\u2013]", t)
        if price_match:
            raw = re.sub(r"['''\u2019\s]", '', price_match.group(1))
            print(f'  => Preis: {raw}')

        rooms_match = re.search(r'(\d+[.,]\d*|\d+)\s*Zimmer', t)
        if rooms_match:
            print(f'  => Zimmer: {rooms_match.group(1)}')

        area_match = re.search(r'(\d+)\s*m\u00b2', t)
        if area_match:
            print(f'  => Flaeche: {area_match.group(1)}')

        zip_match = re.search(r'(\d{4})\s+([\w\s]+)', t)
        if zip_match:
            print(f'  => PLZ: {zip_match.group(1)}, Ort: {zip_match.group(2)[:20]}')

    b.close()
    print('\nDONE')
