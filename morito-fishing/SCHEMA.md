# MORITO FISHING — data contract v1

森戸神社横の導流堤をホームポイントにした、個人用・静的HTML釣りツールのデータ契約。

## 方針

- GitHub Pages上の静的サイトとして完結する。
- 新規フレームワークやビルド工程は導入しない。
- iPhone Safariを第一対象とする。
- 海辺で通信が弱くても使えるよう、最終MVPはPWA/オフライン対応を前提とする。
- 魚種情報、個人釣果、結び方、規制・安全情報、潮汐を分離する。
- 魚の存在実績と「岸から現実的に狙えるか」は別フィールドで扱う。
- ルールは `law` / `fishery_right` / `local_agreement` / `recommendation` / `safety` を混同しない。
- 未確認情報を禁止事項として断定しない。
- 潮汐は出典が確定したデータのみ格納する。推測値や不安定な転載値をSSOTにしない。
- 魚画像はローカル保存を基本とし、作者・出典・ライセンスを必ずデータに保持する。

## Files

```text
morito-fishing/
├─ SCHEMA.md
└─ data/
   ├─ fish.json          # 森戸ホームポイント向け魚マスター
   ├─ catches.json       # 自分の釣果状態
   ├─ knots.json         # 現場用ノット手順
   ├─ rules.json         # 規制・安全情報
   └─ tides.json         # 気象庁の潮汐参考データ
```

UI/PWAファイル、画像、画像クレジットは次段で追加する。

## fish.json

魚そのものの情報。個人のGET状態はここに持たせない。

主フィールド:

- `id`: 永続ID。表示名変更でも変えない。
- `nameJa`: 日本語表示名。
- `scientificName`: 種が確定できるものだけ。グループは `null`。
- `kind`: `species` / `group`。
- `shoreConfidence`: `S` / `A` / `B`。森戸ホームポイントからの岸釣り確度。
- `septemberLate`: `excellent` / `good` / `possible` / `poor` / `rule-check`。
- `methods`: `choiNage` / `burakuri` / `lure` を `excellent` / `good` / `possible` / `none` で保持。
- `bait`: 実用的な餌。
- `zone`: `sand` / `river-mouth` / `groyne-edge` / `blocks` / `submerged-rock` / `open-water`。
- `food`: 食可否と最初に出す料理。
- `safetyLevel`: `normal` / `caution` / `danger`。
- `ruleRefs`: `rules.json` のID参照。
- `imageRef`: 将来の画像マスター参照。初期は `null` 可。

## catches.json

ユーザー固有の状態。

`status`:

- `caught`: GET済み。
- `lost_at_landing`: 釣り上げ直前バラシ。
- `encountered`: 危険魚など、釣ったが通常GETと分けたいもの。
- `unknown`: 未GET。

将来UIで更新する場合は静的seedを初期値としてlocalStorageへコピーし、日常更新でrepo書き換えを要求しない。

## knots.json

現場で毎回検索しないためのノット手順。

- `useFor`: 用途。
- `difficulty`: `easy` / `medium` / `advanced`。
- `recommendedForUser`: 現在の餌釣り中心構成で優先表示するか。
- `steps`: 片手でスマホを見ながら追える短い工程。
- `check`: 結び終わりの確認方法。
- `warning`: 締め込み時の注意。

初期採用:

1. ユニノット — 万能。サルカン/スナップ/ルアー。
2. 改良クリンチノット — ナイロン/フロロから小型金具へ素早く結ぶ。
3. 電車結び（ダブルユニ系） — 糸と糸を接続。
4. FGノット — PEとリーダー。必要になった時の上級枠。

## rules.json

`type` を必ず区別する。

- `law`: 法令等。
- `fishery_right`: 漁業権。
- `local_agreement`: 地域申し合わせ・自主規制。
- `recommendation`: 再放流等の推奨。
- `safety`: 食中毒・毒棘・寄生虫等。

`appliesToShore` は `true` / `false` / `unconfirmed`。

情報は `sourceUrl`, `sourceName`, `verifiedOn` を持ち、年次ルールは `needsAnnualCheck: true` とする。

## tides.json

潮汐は魚マスターと独立させる。

森戸海岸そのものには気象庁潮位表の掲載地点がないため、MVPでは **気象庁・湘南港（D8）** の天文潮位予測を「森戸参考値」として採用する。

これは森戸の実測潮位ではない。UIでも `森戸参考 / 基準: 気象庁 湘南港` と明記する。

`source`:

- `status`: `verified-proxy`
- `station.code`: `D8`
- `sourceName`: `気象庁 潮位表`
- `sourceUrl`: 湘南港の気象庁ページ
- `annualTextUrl`: 気象庁の年次テキストデータ
- `attribution`: 気象庁データを整形した旨

`days[]`:

- `date`: `YYYY-MM-DD`
- `events[]`: `high` / `low`, 時刻、潮位cm。
- UI側で現在時刻をイベント間に置き、上げ/下げと次イベントまでの残り時間を算出する。
- 潮回り（大潮・中潮等）は確かな出典または確定ロジックを採用するまでSSOTへ入れない。

初期データは2026-09-19〜2026-09-23を収録する。

将来は年次テキストを固定幅仕様でパースして更新できるようにする。森戸に近い公的な実測潮位の安定取得経路が確認できた場合のみ、予測値とは別レイヤーとして追加する。

## Image policy

画像は `Public Domain / CC0 / CC BY / CC BY-SA` を優先する。

将来 `images.json` または魚データ内参照先として以下を保持する。

- local file path
- original file name
- author
- license
- source URL
- attribution required
- modified

釣果サイト・個人ブログ画像の無断転載、外部ホットリンクはしない。

## MVP UI contract

トップで最優先する順序:

1. 今日の日付・次の満潮/干潮・上げ下げ。
2. TODAY'S TARGET。
3. MY FISH（GET / BARA-SHI / UNKNOWN / DANGER）。
4. KNOTS（1タップ）。
5. 危険魚/規制。

魚カードからは `狙い方 → 釣れた後 → 持ち帰り → 料理` へ進める。
