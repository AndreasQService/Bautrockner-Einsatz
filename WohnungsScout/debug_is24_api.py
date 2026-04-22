import os, time, json
os.environ['PYTHONUTF8'] = '1'
from patchright.sync_api import sync_playwright

captured = []

with sync_playwright() as p:
    browser = p.chromium.launch(
        headless=False,
        args=['--no-sandbox', '--window-position=-9999,-9999', '--window-size=1366,900']
    )
    ctx = browser.new_context(
        viewport={'width': 1366, 'height': 900},
        locale='de-CH',
        user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    )

    # Netzwerk-Requests abfangen
    def handle_response(response):
        url = response.url
        if 'api' in url.lower() and ('listing' in url.lower() or 'search' in url.lower()):
            try:
                body = response.body()
                data = json.loads(body)
                print(f'API: {url[:100]}')
                if isinstance(data, dict):
                    print(f'  Keys: {list(data.keys())[:5]}')
                captured.append({'url': url, 'data': data})
            except:
                pass

    page = ctx.new_page()
    page.on('response', handle_response)

    page.goto('https://www.immoscout24.ch/de/immobilien/mieten/kanton-thurgau?pf=2500&nrf=3', timeout=30000)
    time.sleep(3)

    try:
        btn = page.wait_for_selector('button:has-text("Akzeptieren")', timeout=3000)
        btn.click(); time.sleep(1)
    except: pass

    # Warte laenger auf AJAX
    time.sleep(8)
    page.screenshot(path='debug_is24_loaded.png')

    print(f'\nTotal API calls abgefangen: {len(captured)}')

    # Auch direkte Suche nach Listing-Containers
    print('\n=== Listing Container ===')
    candidates = [
        '[data-cy="result-item"]',
        '[class*="ResultList"]',
        '[class*="Listing_container"]',
        '[class*="HgCardElevated"]',
        '[class*="HgCard"]',
        'li[id^="result-"]',
    ]
    for sel in candidates:
        els = page.query_selector_all(sel)
        if els:
            print(f'  {sel}: {len(els)} gefunden')
            first = els[0]
            print(f'   Text: {first.inner_text()[:150]!r}')

    # Kompletter Seiten-Text (erste 1000 Zeichen nach Cookie)
    body_text = page.inner_text('body')
    # Suche nach Muster: Preis CHF X,XXX
    import re
    prices = re.findall(r"CHF\s*[\d',]+", body_text)
    print(f'\nPreise auf Seite: {prices[:10]}')

    rooms = re.findall(r'\d+[.,]?\d*\s*Zimmer', body_text)
    print(f'Zimmer auf Seite: {rooms[:10]}')

    ctx.close()
    browser.close()
    print('\nDONE')
