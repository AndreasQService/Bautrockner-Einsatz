import os
os.environ['PYTHONUTF8'] = '1'
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=False)
    page = browser.new_page(user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36')
    page.goto('https://www.homegate.ch/mieten/immobilien/ort-kreuzlingen/treffer?ep=2500&rof=3', timeout=30000)
    page.wait_for_timeout(6000)
    page.screenshot(path='test_homegate.png')
    print('Titel:', page.title())
    el = page.query_selector('#__NEXT_DATA__')
    print('NextData element:', el is not None)
    cards = page.query_selector_all('[data-test="result-list-item"]')
    print('Karten:', len(cards))
    # Auch andere Selektoren probieren
    cards2 = page.query_selector_all('article')
    print('Articles:', len(cards2))
    cards3 = page.query_selector_all('[class*="ResultList"]')
    print('ResultList:', len(cards3))
    browser.close()
    print('DONE')
