import os, time, random
os.environ['PYTHONUTF8'] = '1'

from patchright.sync_api import sync_playwright

def human_delay(min_ms=800, max_ms=2500):
    time.sleep(random.uniform(min_ms/1000, max_ms/1000))

with sync_playwright() as p:
    browser = p.chromium.launch(
        headless=False,
        args=['--no-sandbox', '--disable-dev-shm-usage']
    )
    context = browser.new_context(
        viewport={'width': 1366, 'height': 768},
        locale='de-CH',
        timezone_id='Europe/Zurich',
        user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    )
    page = context.new_page()

    # Test 1: Homegate
    print('[Homegate] Oeffne Seite...')
    page.goto('https://www.homegate.ch/mieten/immobilien/ort-kreuzlingen/treffer?ep=2500&rof=3', timeout=30000)
    human_delay(4000, 7000)
    page.screenshot(path='test_patchright_homegate.png')
    title = page.title()
    print(f'[Homegate] Titel: {title}')
    has_next = page.query_selector('#__NEXT_DATA__') is not None
    print(f'[Homegate] __NEXT_DATA__: {has_next}')
    cards = page.query_selector_all('[data-test="result-list-item"]')
    print(f'[Homegate] Karten: {len(cards)}')

    human_delay(2000, 4000)

    # Test 2: ImmoScout24
    print('[ImmoScout] Oeffne Seite...')
    page.goto('https://www.immoscout24.ch/de/immobilien/mieten/ort-kreuzlingen?nrf=3&pf=2500', timeout=30000)
    human_delay(4000, 7000)
    page.screenshot(path='test_patchright_immoscout.png')
    print(f'[ImmoScout] Titel: {page.title()}')

    browser.close()
    print('DONE')
