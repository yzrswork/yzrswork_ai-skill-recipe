from pathlib import Path
import shutil
from playwright.sync_api import Error, sync_playwright

html = (Path(__file__).resolve().parents[1] / 'index.html').read_text()

with sync_playwright() as p:
    try:
        browser = p.chromium.launch(headless=True)
    except Error:
        system_chromium = shutil.which('chromium') or shutil.which('chromium-browser') or shutil.which('google-chrome')
        if not system_chromium:
            raise
        browser = p.chromium.launch(headless=True, executable_path=system_chromium)

    page = browser.new_page(viewport={'width': 390, 'height': 844})
    errors = []
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.set_content(html, wait_until='load')
    page.click('#startBtn')
    page.wait_for_timeout(450)
    s = page.evaluate('__gameDebug.getState()')
    assert s['running'] is True
    assert s['player']['lives'] == 5
    assert s['player']['shot'] == 1
    assert s['player']['power'] == 0

    # Auto-fire: bullets must appear without any fire key/button input.
    assert s['bulletCount'] > 0
    assert page.locator('#fireBtn').count() == 0

    # Touch control keeps the aircraft above the finger by 85 logical px.
    box = page.locator('#game').bounding_box()
    assert box
    client_x = box['x'] + box['width'] * 0.5
    client_y = box['y'] + box['height'] * 0.75
    page.dispatch_event('#game', 'pointerdown', {
        'pointerId': 1,
        'pointerType': 'touch',
        'clientX': client_x,
        'clientY': client_y,
        'isPrimary': True,
    })
    page.wait_for_timeout(30)
    touched = page.evaluate('__gameDebug.getState()')
    expected_y = (client_y - box['y']) / box['height'] * 800 - 85
    assert abs(touched['player']['y'] - expected_y) < 4

    # SHOT mapping: Lv1=1 bullet, Lv2=2, Lv3=3, Lv4=5.
    expected = {1: 1, 2: 2, 3: 3, 4: 5}
    for level, count in expected.items():
        while page.evaluate('__gameDebug.getState().player.shot') < level:
            page.evaluate("__gameDebug.applyUpgrade('shot')")
        page.evaluate('__gameDebug.clearPlayerBullets()')
        page.evaluate('__gameDebug.fire()')
        bullets = page.evaluate('__gameDebug.getBullets()')
        assert len(bullets) == count, (level, len(bullets))

    # POWER changes speed/damage and is capped at Lv3.
    page.evaluate('__gameDebug.clearPlayerBullets()')
    for _ in range(4):
        page.evaluate("__gameDebug.applyUpgrade('power')")
    s = page.evaluate('__gameDebug.getState()')
    assert s['player']['power'] == 3
    page.evaluate('__gameDebug.fire()')
    bullets = page.evaluate('__gameDebug.getBullets()')
    normals = [b for b in bullets if not b.get('laser') and not b.get('support')]
    assert normals and all(abs(b['vy']) >= 730 for b in normals)
    assert all(b['d'] == 3 for b in normals)

    # SHIELD caps at one active charge.
    page.evaluate("__gameDebug.applyUpgrade('shield')")
    page.evaluate("__gameDebug.applyUpgrade('shield')")
    assert page.evaluate('__gameDebug.getState().player.shield') == 1

    # POWER CHIP -> paused selection -> resume.
    page.evaluate('__gameDebug.forceChip()')
    page.wait_for_timeout(80)
    assert page.evaluate('__gameDebug.getState().paused') is True
    page.keyboard.press('Digit1')
    page.wait_for_timeout(50)
    assert page.evaluate('__gameDebug.getState().paused') is False

    # Touch BOMB remains available and consumes one stock.
    before = page.evaluate('__gameDebug.getState().player.bombs')
    page.dispatch_event('#bombBtn', 'pointerdown', {
        'pointerId': 2,
        'pointerType': 'touch',
        'clientX': box['x'] + box['width'] - 30,
        'clientY': box['y'] + box['height'] - 30,
        'isPrimary': True,
    })
    page.wait_for_timeout(20)
    after = page.evaluate('__gameDebug.getState().player.bombs')
    assert after == before - 1

    # Boss trigger.
    page.evaluate('__gameDebug.forceBoss()')
    page.wait_for_timeout(1700)
    assert page.evaluate('__gameDebug.getState().bossSpawned') is True
    assert not errors, errors
    browser.close()

print('PASS: BLUE VECTOR iPhone UX smoke test')
