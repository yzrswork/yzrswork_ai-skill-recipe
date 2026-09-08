# BLUE VECTOR — MVP

青白の架空アクロバットジェットを操る、レトロ縦スクロール型2Dシューティングです。

このMVPは、2026-09-08のAstra Light / GPT-5.6 Sol High / GPT-5.6 Luna MaxによるWorkセッションが5時間制限でcommit/push直前にロックされたため、ユーザー可視仕様をauthorityとしてChatGPT側で再構成・監査・仕上げしたものです。

> 元Work workspaceのbyte-identical copyではありません。復旧境界は `RECOVERY_NOTE.md` を参照してください。

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

- 480 × 800 Canvas 2D vertical shooter
- 5 aircraft / lives
- Normal enemies: scout / zig / ace
- 1 boss
- POWER CHIP drops; 3 chips pause the game and open POWER SELECT
- SHOT: Single → Twin → 3-Way → 5-Way
- POWER: projectile speed / damage / fire-rate upgrade
- SPEED: movement speed upgrade
- SHIELD: one-hit protection
- LASER: periodic piercing shot
- WINGMAN: up to two support aircraft
- BOMB: clears enemy bullets and damages enemies/boss
- Boss HP bar, score, game over / restart, mission clear
- Keyboard + touch controls

## Deferred after MVP

- WIDE / FOCUS / GUARD formation switching
- Formation gauge / large allied squadron super
- Multiple stages and terrain themes
- Audio / music polish
- PWA packaging

## Verification

See `TEST_EVIDENCE.md` and `FINAL_REVIEW.md`.
