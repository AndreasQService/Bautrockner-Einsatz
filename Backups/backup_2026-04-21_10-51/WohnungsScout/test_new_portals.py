import os, time
os.environ['PYTHONUTF8'] = '1'
from patchright.sync_api import sync_playwright

portals = [
    ('tutti', 'https://www.tutti.ch/de/q/wohnungen-zu-vermieten/kreuzlingen?sorting=newest'),
    ('anibis', 'https://www.anibis.ch/de/c/immobilien-wohnungsmiete--37?q=kreuzlingen&sort=1'),
    ('homegate2', 'https://www.homegate.ch/mieten/immobilien/ort-kreuzlingen/treffer?ep=2500&rof=3'),
]

with sync_playwright() as p:
    browser = p.chromium.launch(
        headless=False,
        args=['--window-position=-9999,-9999', '--window-size=1366,900', '--no-sandbox']
    )
    context = browser.new_context(
        viewport={'width': 1366, 'height': 900},
        locale='de-CH',
        user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    )
    page = context.new_page()

    for name, url in portals:
        try:
            page.goto(url, timeout=20000, wait_until='domcontentloaded')
            time.sleep(4)
            page.screenshot(path=f'debug_{name}.png')
            print(f'[{name}] Titel: {page.title()[:70]}')
            links = page.query_selector_all('a[href]')
            print(f'[{name}] Links: {len(links)}')
        except Exception as e:
            print(f'[{name}] FEHLER: {e}')

    browser.close()
    print('DONE')
