# MORITO FISHING MVP preview

このブランチは `codex/morito-fishing-foundation` のデータ基盤を土台に、iPhone Safari向けMVP UIを追加する。

## Current MVP

- 潮汐日付切替（2026-09-19〜23）
- 気象庁・湘南港を森戸参考基準として表示
- いつもの2本 / ルアーも試す のターゲット切替
- MY FISH seed（GET / BARA-SHI / ENCOUNTERED）
- Fish Masterカード
- 釣れた後の料理候補
- KNOTS（ユニ / 改良クリンチ / 電車結び / FG）
- 危険魚・規制情報
- Wikimedia Commonsのライセンス確認済み写真
- localStorageによる釣果状態更新
- Service Worker / PWA foundation

## Preview

GitHub Pagesへの本番公開前は branch preview service 経由で確認する。最終URLは merge 後に `/morito-fishing/` を想定する。

## Known MVP limitations

- Commons画像は外部参照。最終版では必要画像のrepo内保存を検討する。
- 潮汐は森戸実測値ではなく気象庁・湘南港の天文潮位参考値。
- 2026-09-19〜23以外の潮汐データ自動更新は未実装。
- 結び方はテキスト工程のみ。図解は次段候補。
