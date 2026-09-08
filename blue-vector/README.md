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

- SHOT: 常時オートファイア
- PC: Arrow / WASD = move
- PC: X / B = bomb
- Power Select: 1–4
- Touch: canvas drag = move
- Touch: aircraft is rendered 85 logical px above the finger so it remains visible
- Touch: BOMB button only

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

## iPhone UX hotfix

実機プレイで、手動射撃とドラッグ移動の同時操作が厳しく、指で自機が隠れる問題が確認されたため、SHOTを常時オート化し、自機をタッチ位置より上へオフセットした。

## Deferred after MVP

- WIDE / FOCUS / GUARD formation switching
- Formation gauge / large allied squadron super
- Multiple stages and terrain themes
- Audio / music polish
- PWA packaging

## Verification

See `TEST_EVIDENCE.md`, `UX_HOTFIX_NOTE.md` and `FINAL_REVIEW.md`.
