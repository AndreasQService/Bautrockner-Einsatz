import os, time, json
os.environ['PYTHONUTF8'] = '1'
from patchright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(
        headless=False,
        args=['--no-sandbox', '--window-position=-9999,-9999', '--window-size=1366,900']
    )
    ctx = browser.new_context(
        viewport={'width': 1366, 'height': 900}, locale='de-CH',
        user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    )
    page = ctx.new_page()

    # Groessere Region mit mehr Resultaten - Thurgau Radius
    page.goto('https://www.immoscout24.ch/de/immobilien/mieten/kanton-thurgau?pf=2500&nrf=3&r=20', timeout=30000)
    time.sleep(5)
    try:
        btn = page.wait_for_selector('button:has-text("Akzeptieren")', timeout=3000)
        btn.click(); time.sleep(1)
    except: pass
    time.sleep(3)

    page.screenshot(path='debug_is24_thurgau.png')
    print('Titel:', page.title()[:80])

    articles = page.query_selector_all('article')
    print(f'Articles: {len(articles)}')

    if articles:
        a = articles[0]
        print('\n=== Erster Article data-test ===')
        els = a.query_selector_all('[data-test]')
        for el in els:
            print(f'  [{el.get_attribute("data-test")}]: {el.inner_text().strip()[:50]!r}')
        print('\n=== Karten-Text (roh) ===')
        print(repr(a.inner_text()[:400]))
        print('\n=== HTML snippet ===')
        html = page.evaluate('el => el.outerHTML', a)
        print(html[:800])

    # __NEXT_DATA__ pruefen
    nd = page.query_selector('#__NEXT_DATA__')
    if nd:
        data = json.loads(nd.inner_text())
        pp = data.get('props', {}).get('pageProps', {})
        print('\n=== pageProps keys ===', list(pp.keys()))
        sr = pp.get('searchResult', {})
        print('searchResult keys:', list(sr.keys()) if sr else 'NICHT GEFUNDEN')
        listings = sr.get('listingResultList', [])
        print(f'listingResultList: {len(listings)} Eintraege')
        if listings:
            print('Erstes Listing keys:', list(listings[0].keys()))
            listing = listings[0].get('listing', listings[0])
            print('listing keys:', list(listing.keys()))

    ctx.close()
    browser.close()
    print('\nDONE')
