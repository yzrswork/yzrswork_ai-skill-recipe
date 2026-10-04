# 検証記録

2026-10-04（日本時間）。main `05c953a` から `feat/kuku-rpg-v2` で実装。

## 実装前

Chromium / 375×812で、現行の3択、誤答後の再回答、音OFF、20称号のずかんを確認しました。既存の称号ID・必要クリスタル数・SVGシンボルを維持しました。

## ロジック

`node --test kuku/tests/core.test.js`：23/23成功。

- 72の方向付きfacts、各段の×1〜×9、昇順・逆順・bag全件保証。
- seeded RNG、全100階のmetadata再現性、5/10/50/100F種別・時間、問題数境界。
- ボスと深淵の非復元抽出、mastery補正とrecentFacts抑制、本編ルートには補正なし。
- v1からのクリスタル・称号・ベスト移行、旧キー保持、破損・読み拒否・書き拒否で起動継続、未来版を上書きしないこと。
- ★境界、3ルートCLEARによるボス解放、Stage4後の中ボスによるStage5解放。
- 3問×3ウェーブ、HP3、会心なし、ウェーブ報酬。
- まよいで全会心でも9種類必須、会心なしでも12正答で終了。1,000 seedで終了保証。
- 段階ヒントと本人の再回答、時間切れ回収、誤答履歴保持、時間切れだけでは★減少なし。
- 本編から100階までの通し進行、武器進化、エンディング、覚醒、保存データに階配列を持たないこと。

## ブラウザ

Playwright 1.62.1、Chromium / WebKit。GitHub Pagesと同じ `/yzrswork_ai-skill-recipe/kuku/` サブパスで両エンジンが成功しました。

- 移行したクリスタルと旧ベスト、音OFF、20称号、ずかんのTab循環・Escape・フォーカス復帰・背景inert。
- すべて誤答から回復する9問ルートは★1、報酬は3ウェーブ+ルートで5◇、それでもくだりへ進行。
- 3ルート→エリアボス→次Stage、再読み込みでCLEAR保持。
- Stage5の12キー、3択への切替、3段階ヒント、OSキーボードを呼ぶ入力要素なし。
- Stage7の20秒、休憩とずかんで25秒経過しても問題を保持、時間切れで次の問題へ進み、回復してCLEAR。
- Stage9の12秒、ラスボスとエンディング、深淵解放。
- 51Fは4問・時間なし・51〜60Fの10ノード、CLEAR後に52Fを保存。
- 100Fは8秒・九九喰らい ゼロ、CLEAR後に覚醒を保存。
- 320/375/390/768/1280pxで横にはみ出さないこと。reduced-motion時に攻撃アニメーションなし。
- 音OFFでAudioContext生成ゼロ、音ONは本人操作後に初期化を試み、OFFへ戻せること。
- 保存getter拒否、破損JSON、書き込みquota拒否でも3択まで起動。
- アプリのJS例外なし、参照素材の404なし、外部画像・音源・フォントへの通信なし。
- 地図、ずかん、選択式戦闘、テンキー、結果、100Fクリア後の地図でaxe WCAG 2 A/AA・2.1 AA違反ゼロ。
- スマートフォン幅の選択式、テンキー、100Fスクリーンショットを目視確認。

## 未実施・限界

iPhone実機のSafariとVoiceOverは未実施です。このWindows環境のWebKitにはWeb Audio APIがないため、WebKitでは音機能が利用不能でもゲームが継続することを検証しました。実音の再生・再開はChromiumと実機で分けて確認してください。CIのLinux WebKitではWeb Audio APIがある場合の初期化も検証します。

実機のセーフエリア、縦横回転、OSへの切替、効果音、VoiceOverの項目はREADMEに記載しています。PRに追加したCIは、Nodeテスト、両ブラウザ回帰、axe、スクリーンショット保存を再実行します。

## Visual Pass 2（2026-10-04）

PR #89 の `878e04e` をベースに、同じ `feat/kuku-rpg-v2` へ追記。確認時の最新mainは `05c953a` のままでした。戦闘計算・進行・保存・問題生成・Stage config・RNG・深淵生成・既存23件のロジックテスト・既存ブラウザテストの差分はゼロです。ゲーム側の変更は、表示専用の素材URL/名前とCSSの敵・武器サイズのみです。

- 内蔵画像生成による独自WebP62点：ボス11、守護者8、Stage1〜8通常敵24、深淵通常敵3、武器5、背景11。旧SVG65点を保持。
- 透過素材51点の実ピクセルをRGBAとして検査。アルファ範囲0〜255、透明領域15%以上、四隅は透明（縮小補間の最大2/255を許容）。背景11点は全ピクセル不透明。
- 画像合計11,466,434 bytes、最大289,092 bytes。透過素材768×768、背景1280×853。ゲーム内では62点の一括読み込みなし。
- `node --test kuku/tests/*.test.js`：26/26成功。従来23件に、形式・寸法・容量・アルファ・個別ハッシュ・旧SVG保持・主要5体のID・未登録素材のSVG参照を確認する3件を追加。
- `browser.mjs`：既存144項目がChromium/WebKitで再成功。セーブ移行・拒否・誤答・★・ルートとボス・タイマー・本編/100F・覚醒・音OFF・reduced-motionの回帰を確認。主要ゲーム画面のaxe WCAG A/AA違反ゼロ。
- `visual-browser.mjs`：Chromium/WebKit計292項目成功。62枚すべてを実ブラウザでデコードし、素材404・JS例外ゼロ。素材比較ページのaxe WCAG A/AA違反ゼロ。
- 比較ページの一覧46体、武器5、背景11を確認。主要ボス5体は320/390/768pxの実戦画面でWebP参照・敵表示200px以上・戦闘枠内に収まること・横はみ出しなし・開始表示で保存内容が変わらないことを検証。
- 全46体の一覧、武器の進化、主要5体の旧SVGとの比較、390px戦闘画面を目視確認。空騎兵の生成画像に残った背景は、内蔵画像編集で透過へ修正してから採用。

証跡：[主要5体の比較](evidence/visual-pass-2/boss-comparison.png)、[戦闘・改修前](evidence/visual-pass-2/battle-before.png)、[戦闘・改修後](evidence/visual-pass-2/battle-after.png)、[モンスター一覧](evidence/visual-pass-2/roster.png)、[武器5種](evidence/visual-pass-2/weapons.png)。改修前の戦闘画像は `878e04e` のアーカイブを別サーバーで起動して撮影したものです。改修後の素材は [比較ページ](visual-pass-2.html) でも確認できます。

CIにも追加の素材テストとビジュアル検証を登録しています。iPhone実機Safari/VoiceOverに関する上記の未実施範囲は引き続き残ります。

## Modern Mobile UI Refresh（2026-10-04）

`origin/main` の最新SHA `54189bccccfd36dd51a25d60fb74f231cb1730d4` を取得し、公開ページがHTTP 200であることと、390×844pxでの現行導線を確認してから `feat/kuku-modern-mobile-ui` を作成しました。公開版ではプロフィール情報、Stage一覧、ルート、設定がHOMEに並び、次の操作と戦闘UIの優先順位が弱い状態でした。刷新仕様は [MODERN_UI_SPEC.md](MODERN_UI_SPEC.md) に実装前に記録しています。

- HOME、冒険MAP、戦闘、結果、図鑑、深淵の画面階層を再構成。HOMEから次ルート/ボス/深淵へ進め、MAPは縦道筋とルート詳細Sheetに変更しました。
- アイボリー/ネイビーの画面、余白と面による整理、下部ナビ、設定Sheet、進行に応じたCTAを追加。戦闘ログはaria live regionに残して視覚UIから隠し、敵WebP・九九式・回答タイルへ集中させています。
- Save v2、学習・戦闘・進行・mastery・Stageデータ・100F生成・アセット形式に変更なし。表示接続とテストだけの改修です。
- Nodeテスト：26/26成功。
- `browser.mjs`：Chromium/WebKit 160項目成功。進行、移行、タイマー、音OFF、focus、axeの回帰確認。
- `modern-ui-browser.mjs`：Chromium/WebKit 120項目成功。初回HOME、縦MAP、Sheet、戦闘、結果、全画面Stage Clear、Stage6武器獲得、Stage4ボス、Stage5テンキー、Stage7タイマー、図鑑、バッジ、51F、設定、320/375/390/430/768/1280px横幅、axeを確認。
- `visual-browser.mjs`：Chromium/WebKit 292項目成功。既存WebPの実ブラウザ読み込み、画像寸法、比較GalleryとSave保持を再確認。
- axeのWCAG 2 A/AA・2.1 AA違反、JavaScript例外、失敗した素材リクエスト、指定幅での横はみ出しはゼロ。WebKitで見つかった設定文字のコントラストを濃くし、再実行で解消しました。

画面証跡は [更新前HOME](evidence/modern-ui/before-home.png)、[更新後HOME](evidence/modern-ui/home-after.png)、[冒険MAP](evidence/modern-ui/adventure-map.png)、[Stage1戦闘](evidence/modern-ui/stage-1-battle.png)、[Stage4ボス](evidence/modern-ui/stage-4-boss.png)、[Stage5テンキー](evidence/modern-ui/stage-5-keypad.png)、[Stage7タイマー](evidence/modern-ui/stage-7-timer.png)、[結果](evidence/modern-ui/result.png)、[Stage Clear](evidence/modern-ui/stage-clear.png)、[武器獲得演出](evidence/modern-ui/stage-6-weapon-clear.png)、[モンスター図鑑](evidence/modern-ui/collection-monsters.png)、[バッジ](evidence/modern-ui/collection-badges.png)、[深淵51F](evidence/modern-ui/abyss-51f.png)です。実機iPhone Safari、VoiceOver、セーフエリア、縦横回転はこの環境では未確認です。
