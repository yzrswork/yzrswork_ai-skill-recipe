# TECH SPEC — Recovery MVP

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

## Test hook
`window.__gameDebug` exposes state inspection and deterministic helper actions for smoke testing. It is not required for normal play.
