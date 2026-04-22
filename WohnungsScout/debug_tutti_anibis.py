import os, time
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

    # Tutti - korrekte URL mit Wohnungs-Kategorie
    page.goto('https://www.tutti.ch/de/q/wohnungen-zu-vermieten/kreuzlingen', timeout=25000)
    time.sleep(3)
    try:
        btn = page.wait_for_selector('button:has-text("Akzeptieren"), button:has-text("Alle")', timeout=3000)
        btn.click(); time.sleep(1)
    except: pass
    page.wait_for_timeout(3000)
    page.screenshot(path='debug_tutti2.png')
    print('Tutti Titel:', page.title()[:60])

    # Alle klickbaren Elemente pruefen
    for sel in ['[data-testid]', 'article', 'li', '[class*="Ad"]', '[class*="listing"]']:
        els = page.query_selector_all(sel)
        if els:
            print(f'  {sel}: {len(els)} Elemente')

    # Inserat-Links
    ins_links = page.query_selector_all('a[href*="/vi/"]')
    print(f'  /vi/ Links: {len(ins_links)}')
    for l in ins_links[:3]:
        print('   ', l.get_attribute('href'))

    time.sleep(2)

    # Anibis korrekte URL
    page.goto('https://www.anibis.ch/de/c/immobilien-wohnungsmiete--37?q=kreuzlingen', timeout=25000)
    time.sleep(3)
    try:
        btn = page.wait_for_selector("button:has-text('J')", timeout=3000)
        btn.click(); time.sleep(1)
    except: pass
    page.wait_for_timeout(3000)
    page.screenshot(path='debug_anibis2.png')
    print('\nAnibis Titel:', page.title()[:60])
    for sel in ['[data-testid]', 'article', 'li', '[class*="ad"]', '[class*="Ad"]']:
        els = page.query_selector_all(sel)
        if els:
            print(f'  {sel}: {len(els)} Elemente')
    ad_links = page.query_selector_all('a[href*="/de/ad/"]')
    print(f'  /de/ad/ Links: {len(ad_links)}')
    for l in ad_links[:3]:
        print('   ', l.get_attribute('href'))

    ctx.close()
    browser.close()
    print('\nDONE')
