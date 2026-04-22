import os, time, sys, re
os.environ['PYTHONUTF8'] = '1'
sys.path.insert(0, '.')
from patchright.sync_api import sync_playwright

with sync_playwright() as p:
    b = p.chromium.launch(headless=False, args=['--no-sandbox', '--window-position=-9999,-9999', '--window-size=1366,900'])
    ctx = b.new_context(viewport={'width': 1366, 'height': 900}, locale='de-CH',
                        user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36')
    page = ctx.new_page()

    # Schritt 1: Startseite laden
    page.goto('https://www.tutti.ch/de', timeout=20000)
    time.sleep(3)
    try:
        btn = page.wait_for_selector('button:has-text("Akzeptieren")', timeout=3000)
        btn.click(); time.sleep(1)
    except: pass

    # Schritt 2: Suchbegriff eingeben
    search = page.wait_for_selector('input[type="search"], input[placeholder*="such"]', timeout=5000)
    search.click()
    search.fill('Wohnung mieten Kreuzlingen')
    time.sleep(1)
    page.keyboard.press('Enter')
    time.sleep(4)

    page.screenshot(path='debug_tutti_search.png')
    print('Titel:', page.title()[:80])
    print('URL:', page.url[:120])

    links = page.query_selector_all('a[href*="/vi/"]')
    immo = [l for l in links if 'wohnung' in (l.get_attribute('href') or '').lower()
            or 'immobilien' in (l.get_attribute('href') or '').lower()]
    print(f'Immo-Links: {len(immo)}')
    for l in immo[:5]:
        print(' ', l.get_attribute('href'))
        parent = l.evaluate_handle('el => el.closest("li,article,div[class]")')
        el = parent.as_element()
        if el:
            print('  Text:', repr(el.inner_text()[:100]))

    b.close()
    print('DONE')
