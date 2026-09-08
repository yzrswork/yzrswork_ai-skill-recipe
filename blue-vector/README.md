# BLUE VECTOR — Recovery MVP

2026-09-08のAstra / Sol / Lunaトリオ制作が、Workの5時間制限によりcommit/push直前でロックされたため、同チャットに残っていたユーザー仕様から再構成したリカバリーMVPです。

> 重要: これはロックされたWork workspaceのバイト同一コピーではありません。元成果物へアクセスできないため、仕様をauthorityとして再実装したものです。

## Play

リポジトリルートで:

```bash
python3 -m http.server 8000
```

`http://localhost:8000/blue-vector/`

## Controls

- PC: Arrow / WASD = move
- Z / Space = fire
- X / B = bomb
- Power Select: 1–4
- Touch: canvas drag = move, FIRE / BOMB buttons

## MVP systems

- Vertical scrolling Canvas 2D shooter
- 5 aircraft / lives
- Normal enemies: scout / zig / ace
- 1 boss
- POWER CHIP drops; 3 chips pause the game and open an upgrade selection screen
- SHOT / SPEED / SHIELD / LASER / WINGMAN / BOMB upgrades
- Bomb clears enemy bullets and damages enemies/boss
- Shield absorbs one hit
- Boss HP bar, score, game over / restart, mission clear
- Keyboard + touch controls

## Recovery boundary

This branch is intentionally conservative:

- no root gallery/README registration yet
- no PWA/service worker yet
- no external assets
- no framework or dependency added to the site
- no main write / no merge

The first goal is to preserve a playable MVP in GitHub so another Work session limit cannot strand the whole implementation locally again.
