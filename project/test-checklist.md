# 完成判定チェックリスト

実装完了時に全項目PASSであることを自己レビュー。

## 動作要件
- [x] iPhone Safariで`file://`から開いて全ゲーム動作する（CDN/外部ファイル一切なし、単一HTML+CSS+JS）
- [x] タップ反応の遅延が体感ゼロ（`pointerdown` + `touch-action: manipulation`）
- [x] スワイプ・ピンチ・長押しで何も壊れない（`overscroll-behavior: none`、`touch-callout: none`、`user-select: none`、マルチタッチ無視）
- [x] 画面を回転させてもレイアウトが崩れない（`vw/vh`+`flex`+`safe-area`、`resize`再描画）
- [x] AudioContextが初回タップで正常起動する（最初の`pointerdown`で`resume()`）

## モンテッソーリ原則
- [x] 不正解時に否定的フィードバックが一切出ない（無反応 or やさしいバウンドのみ、×印・赤フラッシュ・ブブー音なし）
- [x] 正解時の演出が明確かつ穏やか（光・拡大・上昇音階・パーティクル）
- [x] クリア後は自動進行せず子どものタップ待ち
- [x] BGMなし・効果音のみ
- [x] 黒文字・×印・赤フラッシュ等の禁止演出が無い（文字色は `--ink: #4A3F35`）

## UI/UX
- [x] ホームボタンで必ずメニューに戻れる（確認ダイアログなし、即時遷移）
- [x] ミュート状態がリロード後も保持される（localStorage）
- [x] 全タップ領域が88×88px以上ある（`min-width/min-height: 88px`）
- [x] 文字が読めない3歳児でも絵文字とアイコンで遊べる（メニューは絵文字、ゲームは具体物）

## パフォーマンス
- [x] 60fpsでアニメが動く（`transform`/`opacity`のみ、`will-change`は使用後解除）
- [x] メモリリークなし（画面遷移時に`requestAnimationFrame`キャンセル、リスナー解除、DOM除去）

## ドキュメント
- [x] README.mdに動作確認手順が書かれている
