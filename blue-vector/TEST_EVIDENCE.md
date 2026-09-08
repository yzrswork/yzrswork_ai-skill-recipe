# TEST EVIDENCE — BLUE VECTOR MVP

2026-09-08 final recovery validation:

- Inline JavaScript: `node --check` PASS.
- Headless system Chromium smoke test: PASS.
- Verified flow:
  - START MISSION
  - running state
  - LIFE = 5
  - SHOT progression = 1 / 2 / 3 / 5 bullets
  - POWER caps at Lv3
  - POWER Lv3 normal shots reach the expected higher projectile speed and damage
  - SHIELD caps at one active charge
  - third POWER CHIP pauses gameplay and opens POWER SELECT
  - keyboard selection resumes gameplay
  - BOMB consumes one stock
  - boss trigger runs without console error
- Browser console errors during smoke flow: none.

The test loads the standalone HTML directly with Playwright `page.set_content` because this runtime blocks localhost navigation. The JavaScript and browser behavior are otherwise exercised by system Chromium.
