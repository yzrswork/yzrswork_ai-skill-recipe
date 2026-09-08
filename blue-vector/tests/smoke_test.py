from pathlib import Path
from playwright.sync_api import sync_playwright

html = Path(__file__).resolve().parents[1].joinpath('index.html').read_text()

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 390, 'height': 844})
    errors = []
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.set_content(html, wait_until='load')
    page.click('#startBtn')
    page.wait_for_timeout(150)
    s = page.evaluate('__gameDebug.getState()')
    assert s['running'] is True
    assert s['player']['lives'] == 5
    page.keyboard.down('Space')
    page.wait_for_timeout(180)
    page.keyboard.up('Space')
    assert page.evaluate('__gameDebug.getState().bulletCount') > 0
    page.evaluate('__gameDebug.forceChip()')
    page.wait_for_timeout(80)
    assert page.evaluate('__gameDebug.getState().paused') is True
    page.keyboard.press('Digit1')
    page.wait_for_timeout(50)
    assert page.evaluate('__gameDebug.getState().paused') is False
    before = page.evaluate('__gameDebug.getState().player.bombs')
    page.evaluate('__gameDebug.bomb()')
    after = page.evaluate('__gameDebug.getState().player.bombs')
    assert after == before - 1
    page.evaluate('__gameDebug.forceBoss()')
    page.wait_for_timeout(1700)
    assert page.evaluate('__gameDebug.getState().bossSpawned') is True
    assert not errors, errors
    browser.close()

print('PASS: BLUE VECTOR recovery smoke test')
