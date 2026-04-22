import os, time, sys, re
os.environ['PYTHONUTF8'] = '1'
sys.path.insert(0, '.')
from patchright.sync_api import sync_playwright

with sync_playwright() as p:
    b = p.chromium.launch(headless=False, args=['--no-sandbox', '--window-position=-9999,-9999', '--window-size=1366,900'])
    ctx = b.new_context(viewport={'width': 1366, 'height': 900}, locale='de-CH',
                        user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36')
    page = ctx.new_page()

    # Korrekte Tutti-URL: Kategorie 20006 = Wohnungen zur Miete
    # Region via Breadcrumb: /thurgau/
    urls = [
        'https://www.tutti.ch/de/q/wohnungen-zu-vermieten?sorting=newest',
        'https://www.tutti.ch/de/q/immobilien?cat=20006&sorting=newest',
        'https://www.tutti.ch/de/q/wohnungen-zu-vermieten/thurgau?sorting=newest',
    ]

    for url in urls:
        page.goto(url, timeout=20000, wait_until='domcontentloaded')
        time.sleep(2)
        try:
            btn = page.wait_for_selector('button:has-text("Akzeptieren")', timeout=2000)
            btn.click(); time.sleep(1)
        except: pass
        time.sleep(2)
        print(f'\nURL: {url}')
        print('Titel:', page.title()[:60])
        links = page.query_selector_all('a[href*="/vi/"]')
        immo = [l for l in links if 'wohnung' in (l.get_attribute('href') or '').lower() or 'immobilien' in (l.get_attribute('href') or '').lower()]
        print(f'Total vi-links: {len(links)}, Immo: {len(immo)}')
        if immo:
            print('Beispiel:', immo[0].get_attribute('href'))

    b.close()
    print('\nDONE')
