# TECH SPEC — BLUE VECTOR MVP

## Platform
Static HTML + CSS + JavaScript, Canvas 2D. No framework, package manager, external asset, or build step.

## Logical resolution
480 × 800 portrait canvas, scaled to the viewport.

## Runtime
- requestAnimationFrame loop
- dt clamped to 33 ms
- simple circle collision tests
- arrays for enemies, bullets, enemy bullets, chips, particles

## Input
- Keyboard: WASD / arrows, Z/Space, X/B
- Touch: direct-drag aircraft movement plus FIRE/BOMB controls

## Game states
- title
- playing
- upgrade pause
- mission failed
- mission clear

## Upgrade implementation
- SHOT levels: 1 / 2 / 3 / 5 simultaneous shots
- POWER levels 0–3: bullet speed and fire rate scale each tier; damage rises at Lv2 and Lv3
- SPEED levels 0–3
- SHIELD: max one active charge
- LASER: max Lv2
- WINGMAN: max 2
- BOMB: stock capped at 6

## Test hook
`window.__gameDebug` exposes state inspection and deterministic helper actions for smoke testing. It is not required for normal play.
