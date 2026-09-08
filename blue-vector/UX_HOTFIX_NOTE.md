# iPhone UX hotfix — 2026-09-08

実機プレイで以下を確認した。

- 手動射撃とドラッグ移動の同時操作が厳しい
- 指で自機が隠れ、回避時に現在位置を把握しづらい

## Hotfix

- SHOTを常時オートファイア化
- touch UIからFIREボタンを廃止しBOMBのみ残す
- touch位置より自機を85 logical px上に表示する
- keyboard移動は維持し、PCでもSHOTは自動化

## Validation

- JavaScript syntax: PASS
- system Chromium smoke: PASS
- START後、射撃入力なしでplayer bullet生成を確認
- FIREボタンがDOMから除去されていることを確認
- touch pointer位置から自機Yが85 logical px上へオフセットされることを確認
- touch BOMB操作を確認

実装済みのSHOT / POWER / SPEED / SHIELD / LASER / WINGMAN / boss flowは維持する。
