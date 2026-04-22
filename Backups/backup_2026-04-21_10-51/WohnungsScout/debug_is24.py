import os, time, json
os.environ['PYTHONUTF8'] = '1'
from patchright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(
        viewport={'width': 1366, 'height': 900},
        locale='de-CH',
        user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    )
    page = context.new_page()
    page.goto('https://www.immoscout24.ch/de/immobilien/mieten/ort-kreuzlingen?pf=2500&nrf=3&slf=60', timeout=30000)
    time.sleep(5)
    page.screenshot(path='debug_is24.png')

    # Was ist auf der Seite?
    print('Titel:', page.title())

    # Alle article-Tags
    articles = page.query_selector_all('article')
    print('Articles:', len(articles))

    # Alle Links mit /de/d/ (Inserat-Links)
    links = page.query_selector_all('a[href*="/de/d/"]')
    print('Inserat-Links:', len(links))
    for l in links[:3]:
        print(' -', l.get_attribute('href'))

    # __NEXT_DATA__?
    nd = page.query_selector('#__NEXT_DATA__')
    print('__NEXT_DATA__:', nd is not None)
    if nd:
        raw = nd.inner_text()
        data = json.loads(raw)
        # Suche nach listings tief im Baum
        def find_listings(d, depth=0):
            if depth > 6: return
            if isinstance(d, dict):
                for k, v in d.items():
                    if 'listing' in k.lower() and isinstance(v, list) and len(v) > 0:
                        print(f'  Gefunden: {k} = {len(v)} Eintraege')
                        if len(v) > 0: print('  Erstes Item keys:', list(v[0].keys())[:5])
                    find_listings(v, depth+1)
            elif isinstance(d, list):
                for item in d[:2]:
                    find_listings(item, depth+1)
        find_listings(data)

    browser.close()
    print('DONE')
