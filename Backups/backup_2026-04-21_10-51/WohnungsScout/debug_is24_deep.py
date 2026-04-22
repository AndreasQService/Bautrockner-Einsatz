import os, time, json
os.environ['PYTHONUTF8'] = '1'
from patchright.sync_api import sync_playwright

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
    page = ctx.new_page()
    page.goto('https://www.immoscout24.ch/de/immobilien/mieten/kanton-thurgau?pf=2500&nrf=3', timeout=30000)
    time.sleep(5)
    try:
        btn = page.wait_for_selector('button:has-text("Akzeptieren")', timeout=3000)
        btn.click(); time.sleep(1)
    except: pass
    time.sleep(4)

    # __NEXT_DATA__ - das ist die Goldmine
    nd = page.query_selector('#__NEXT_DATA__')
    print('__NEXT_DATA__:', nd is not None)
    if nd:
        raw = nd.inner_text()
        data = json.loads(raw)
        pp = data.get('props', {}).get('pageProps', {})
        print('pageProps keys:', list(pp.keys())[:10])

        # Suche rekursiv nach Arrays mit Listing-Daten
        def find_arrays(obj, path='', depth=0):
            if depth > 5: return
            if isinstance(obj, dict):
                for k, v in obj.items():
                    new_path = f'{path}.{k}'
                    if isinstance(v, list) and len(v) > 0:
                        first = v[0]
                        if isinstance(first, dict) and ('id' in first or 'listing' in first):
                            print(f'[LISTING ARRAY] {new_path}: {len(v)} items')
                            print(f'  Keys: {list(first.keys())[:8]}')
                            if 'listing' in first:
                                lk = list(first['listing'].keys())[:10]
                                print(f'  listing keys: {lk}')
                    find_arrays(v, new_path, depth+1)
            elif isinstance(obj, list) and len(obj) > 0:
                find_arrays(obj[0], path+'[0]', depth+1)

        find_arrays(pp)
    else:
        print('KEIN __NEXT_DATA__ - schaue andere Quellen...')

    # Alle List-Items mit Preis-Info
    print('\n=== Elemente mit Preis (CHF) ===')
    all_els = page.query_selector_all('*')
    count = 0
    for el in all_els:
        try:
            txt = el.inner_text()
            if 'CHF' in txt and len(txt) < 50 and txt.count('\n') == 0:
                cls = el.get_attribute('class') or ''
                tag = el.evaluate('e => e.tagName')
                print(f'  <{tag}> .{cls[:30]}: {txt.strip()!r}')
                count += 1
                if count > 8: break
        except: pass

    ctx.close()
    browser.close()
    print('\nDONE')
