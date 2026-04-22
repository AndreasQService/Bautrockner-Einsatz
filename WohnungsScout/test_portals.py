import os
os.environ['PYTHONUTF8'] = '1'
from playwright.sync_api import sync_playwright

portals = [
    ('Immoscout24', 'https://www.immoscout24.ch/de/immobilien/mieten/ort-kreuzlingen?nrf=3&pf=2500'),
    ('Newhome', 'https://www.newhome.ch/de/mieten/wohnungen/suche/ergebnis?place=Kreuzlingen&roomsFrom=3&priceMax=2500'),
    ('Anibis', 'https://www.anibis.ch/de/c/immobilien-wohnungsmiete--37?q=kreuzlingen'),
]

with sync_playwright() as p:
    browser = p.chromium.launch(headless=False)
    for name, url in portals:
        page = browser.new_page(user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
        page.goto(url, timeout=20000)
        page.wait_for_timeout(4000)
        page.screenshot(path=f'test_{name.lower()}.png')
        print(f'{name}: {page.title()[:60]}')
        page.close()
    browser.close()
