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
    page.goto('https://www.immoscout24.ch/de/immobilien/mieten/ort-kreuzlingen?pf=2500&nrf=3', timeout=30000)
    time.sleep(5)

    # Cookie banner
    try:
        btn = page.wait_for_selector('button:has-text("Akzeptieren")', timeout=3000)
        btn.click(); time.sleep(1)
    except: pass
    time.sleep(3)

    # Ersten article finden und HTML dumpen
    article = page.query_selector('article')
    if article:
        # Alle data-test Attribute
        els_with_test = article.query_selector_all('[data-test]')
        print('=== data-test Elemente ===')
        for el in els_with_test:
            attr = el.get_attribute('data-test')
            txt = el.inner_text().strip()[:60]
            print(f'  [{attr}]: {txt!r}')

        # Alle spans mit Zahlen
        print('\n=== Spans mit Zahlen ===')
        spans = article.query_selector_all('span, p, div[class]')
        for s in spans[:30]:
            txt = s.inner_text().strip()
            if txt and any(c.isdigit() for c in txt) and len(txt) < 30:
                cls = s.get_attribute('class') or ''
                print(f'  .{cls[:40]}: {txt!r}')

        # Kompletter Text der Karte
        print('\n=== Karten-Text ===')
        print(repr(article.inner_text()[:500]))
    else:
        print('KEIN ARTICLE gefunden')
        # Was ist auf der Seite?
        print('Titel:', page.title())
        # NEXT_DATA?
        nd = page.query_selector('#__NEXT_DATA__')
        print('NEXT_DATA:', nd is not None)

    ctx.close()
    browser.close()
    print('\nDONE')
