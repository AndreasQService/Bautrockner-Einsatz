import os, time, sys
os.environ['PYTHONUTF8'] = '1'
sys.path.insert(0, '.')
from patchright.sync_api import sync_playwright

with sync_playwright() as p:
    b = p.chromium.launch(headless=False, args=['--no-sandbox', '--window-position=-9999,-9999', '--window-size=1366,900'])
    ctx = b.new_context(viewport={'width': 1366, 'height': 900}, locale='de-CH',
                        user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
    page = ctx.new_page()
    page.goto('https://www.tutti.ch/de/q/immobilien/wohnungen?r=kreuzlingen&sorting=newest', timeout=25000)
    time.sleep(3)
    try:
        btn = page.wait_for_selector('button:has-text("Akzeptieren")', timeout=3000)
        btn.click()
        time.sleep(1)
    except:
        pass
    time.sleep(3)
    page.screenshot(path='debug_tutti_immo.png')
    print('Titel:', page.title()[:60])

    for sel in ['[data-testid]', '[class*="AdCard"]', '[class*="listing"]']:
        els = page.query_selector_all(sel)
        if els:
            print(f'{sel}: {len(els)}')

    links = page.query_selector_all('a[href*="/vi/"]')
    print(f'vi-links: {len(links)}')
    if links:
        for link in links[:3]:
            href = link.get_attribute('href')
            if href and 'immobilien' in href:
                parent = link.evaluate_handle('el => el.closest("li,article,div[class]")')
                el = parent.as_element()
                if el:
                    print('Parent text:', repr(el.inner_text()[:200]))
                    break
    b.close()
    print('DONE')
