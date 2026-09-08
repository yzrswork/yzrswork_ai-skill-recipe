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
    assert s['bulletCount'] > 0
    assert page.locator('#fireBtn').count() == 0

    # Relative touch: pointerdown must NOT teleport the aircraft.
    box = page.locator('#game').bounding_box()
    assert box
    before = page.evaluate('__gameDebug.getState().player')
    down_x = box['x'] + box['width'] * 0.82
    down_y = box['y'] + box['height'] * 0.78
    page.dispatch_event('#game', 'pointerdown', {
        'pointerId': 1, 'pointerType': 'touch', 'clientX': down_x, 'clientY': down_y, 'isPrimary': True,
    })
    page.wait_for_timeout(20)
    after_down = page.evaluate('__gameDebug.getState().player')
    assert abs(after_down['x'] - before['x']) < 1
    assert abs(after_down['y'] - before['y']) < 1

    # Drag delta should translate the aircraft by the same logical delta.
    move_x, move_y = down_x + 32, down_y - 28
    page.dispatch_event('#game', 'pointermove', {
        'pointerId': 1, 'pointerType': 'touch', 'clientX': move_x, 'clientY': move_y, 'isPrimary': True,
    })
    page.wait_for_timeout(20)
    after_move = page.evaluate('__gameDebug.getState().player')
    expected_dx = 32 / box['width'] * 480
    expected_dy = -28 / box['height'] * 800
    assert abs((after_move['x'] - before['x']) - expected_dx) < 3
    assert abs((after_move['y'] - before['y']) - expected_dy) < 3
    page.dispatch_event('#game', 'pointerup', {
        'pointerId': 1, 'pointerType': 'touch', 'clientX': move_x, 'clientY': move_y, 'isPrimary': True,
    })

    # First three non-boss kills are guaranteed POWER CHIP drops.
    initial = page.evaluate('__gameDebug.getState()')
    assert initial['introDropsRemaining'] == 3
    for _ in range(3):
        page.evaluate("__gameDebug.testDropChip('scout')")
    intro = page.evaluate('__gameDebug.getState()')
    assert intro['introDropsRemaining'] == 0
    assert intro['chipCount'] >= 3

    # Normal enemy bullets are slower and capped.
    page.evaluate('__gameDebug.clearEnemyBullets()')
    page.evaluate('__gameDebug.testEnemyShoot(false)')
    normal_bullets = page.evaluate('__gameDebug.getEnemyBullets()')
    assert len(normal_bullets) == 1
    speed = (normal_bullets[0]['vx'] ** 2 + normal_bullets[0]['vy'] ** 2) ** 0.5
    assert 93 <= speed <= 97
    for _ in range(40):
        page.evaluate('__gameDebug.testEnemyShoot(false)')
    assert page.evaluate('__gameDebug.getState().enemyBulletCount') <= 18

    # Boss spread is reduced to 7 bullets at ~145 speed.
    page.evaluate('__gameDebug.clearEnemyBullets()')
    page.evaluate('__gameDebug.testEnemyShoot(true)')
    boss_bullets = page.evaluate('__gameDebug.getEnemyBullets()')
    assert len(boss_bullets) == 7
    boss_speed = (boss_bullets[0]['vx'] ** 2 + boss_bullets[0]['vy'] ** 2) ** 0.5
    assert 143 <= boss_speed <= 147

    # SHOT mapping regression: Lv1=1, Lv2=2, Lv3=3, Lv4=5.
    expected = {1: 1, 2: 2, 3: 3, 4: 5}
    for level, count in expected.items():
        while page.evaluate('__gameDebug.getState().player.shot') < level:
            page.evaluate("__gameDebug.applyUpgrade('shot')")
        page.evaluate('__gameDebug.clearPlayerBullets()')
        page.evaluate('__gameDebug.fire()')
        bullets = page.evaluate('__gameDebug.getBullets()')
        assert len(bullets) == count, (level, len(bullets))

    # POWER Lv3 regression.
    page.evaluate('__gameDebug.clearPlayerBullets()')
    for _ in range(4):
        page.evaluate("__gameDebug.applyUpgrade('power')")
    assert page.evaluate('__gameDebug.getState().player.power') == 3

    # SHIELD caps at one active charge.
    page.evaluate("__gameDebug.applyUpgrade('shield')")
    page.evaluate("__gameDebug.applyUpgrade('shield')")
    assert page.evaluate('__gameDebug.getState().player.shield') == 1

    # POWER SELECT flow.
    page.evaluate('__gameDebug.forceChip()')
    page.wait_for_timeout(80)
    assert page.evaluate('__gameDebug.getState().paused') is True
    page.keyboard.press('Digit1')
    page.wait_for_timeout(50)
    assert page.evaluate('__gameDebug.getState().paused') is False

    # Touch BOMB remains available.
    before_bomb = page.evaluate('__gameDebug.getState().player.bombs')
    page.dispatch_event('#bombBtn', 'pointerdown', {
        'pointerId': 2, 'pointerType': 'touch',
        'clientX': box['x'] + box['width'] - 30, 'clientY': box['y'] + box['height'] - 30,
        'isPrimary': True,
    })
    page.wait_for_timeout(20)
    assert page.evaluate('__gameDebug.getState().player.bombs') == before_bomb - 1

    # Boss trigger regression.
    page.evaluate('__gameDebug.forceBoss()')
    page.wait_for_timeout(1700)
    assert page.evaluate('__gameDebug.getState().bossSpawned') is True
    assert not errors, errors
    browser.close()

print('PASS: BLUE VECTOR difficulty + relative-touch hotfix')
