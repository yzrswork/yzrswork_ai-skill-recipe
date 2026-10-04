# 九九クエスト RPG v2

小学2年生向けの一人称九九RPG。Vanilla JS + ES Modules、ビルド不要。既存のHTML骨格、CSS、20称号とSVG、バッジずかん、近接積の3択、合成効果音を分離・再利用しています。

## 起動と検証

リポジトリ直下で `python -m http.server 8000` を実行し、`http://localhost:8000/kuku/` を開きます。ES Modulesのため `file://` での起動は対象外です。GitHub Pagesのサブパスにも対応しています。

```sh
node --test kuku/tests/*.test.js
```

ブラウザ検証にはテスト用のPlaywrightとaxeを、リポジトリ外の一時ディレクトリへインストールします。アプリ本体に実行時依存は追加していません。

```sh
npm install --prefix /tmp/kuku-tests --no-audit --no-fund playwright@1.62.1 @axe-core/playwright@4.11.1
node /tmp/kuku-tests/node_modules/playwright/cli.js install --with-deps chromium webkit
PLAYWRIGHT_MODULE=/tmp/kuku-tests/node_modules/playwright/index.mjs AXE_MODULE=/tmp/kuku-tests/node_modules/@axe-core/playwright/dist/index.mjs node kuku/tests/browser.mjs
PLAYWRIGHT_MODULE=/tmp/kuku-tests/node_modules/playwright/index.mjs AXE_MODULE=/tmp/kuku-tests/node_modules/@axe-core/playwright/dist/index.mjs node kuku/tests/visual-browser.mjs
```

スクリーンショットは `KUKU_EVIDENCE` で指定したディレクトリ（既定はリポジトリ外の `../kuku-evidence`）へ出力します。

## 構成と責務

| ファイル | 責務 |
|---|---|
| `script.js` | 起動のみ |
| `js/config.js` | 確定Stage、3ルート、武器、保存バージョン |
| `js/rng.js` | seed乱数、Fisher–Yates shuffle |
| `js/questions.js` | 72 facts、段別bag、3択、mastery重みと非復元抽出 |
| `js/progression.js` | CLEARによる解放、★、武器進化 |
| `js/battle.js` | DOMを持たない戦闘、HP、会心、ヒント、時間切れ回収 |
| `js/dungeon.js` | 再現可能な階層metadata、出題、攻略進行 |
| `js/save.js` | Save v2、v1移行、破損・拒否・未来版の扱い |
| `js/ui.js` | 地図、戦闘、テンキー、時間・休憩、結果の接続 |
| `js/profile.js` / `badges.js` | 既存称号とずかんを抽出、フォーカス管理 |
| `js/audio.js` | 既存の独自合成音。音OFF時はAudioContextを生成しない |
| `js/story.ja.js` / `messages.ja.js` | ストーリーと戦闘文言 |
| `style.css` / `rpg.css` | 既存のレイアウトと称号描画 / v2の拡張 |
| `js/assets.js` | 表示専用の素材URL・名前。ゲームIDを維持 |
| `assets/` | 従来SVG65点とVisual Pass 2の独自WebP62点 |

## Visual Pass 2

敵・ボス・武器を透過WebP、背景を不透明WebPへ変更しました。重点ボス5体から始め、全ボス11体、守護者8体、Stage1〜8の通常敵24体と深淵3体、武器5種、背景11枚へ展開しています。体型・顔・装備・構えを個別に設計し、既存作品や作家の直接模倣はしていません。

戦闘の敵表示はスマートフォンでも全身と構えを読める大きさへ拡大。問題・回答・ログの配置とUI部品は従来のCSS/SVGを維持しています。保存形式、進行、出題、戦闘計算、音、既存テストは変更していません。通常敵と守護者の名前の調整は表示専用です。

比較と一覧は [Visual Pass 2 素材比較](visual-pass-2.html)。形式・生成方法・圧縮・保持するSVGについては [素材README](assets/visual-pass-2/README.md)、個別の生成指示は [PROMPTS.json](assets/visual-pass-2/PROMPTS.json) を参照してください。内蔵画像生成で制作し、配信時はリポジトリ内の静的ファイルのみを読みます。

## 保存互換

新キーは `yzrs-kuku-save-v2`。`schemaVersion: 2` と `dungeon.generationVersion: 1` を分離し、profile/settings/story/mastery/dungeonだけ保存します。階metadataや戦闘中のデッキ、100階分の配列は保存しません。

初回に `yzrs-kuku-best-v1` と `yzrs-kuku-progress-v1` から、クリスタル、選択称号、10問の旧ベストを移行します。旧キーは削除・上書きしません。このリリースで保持し、将来の削除は別の移行として扱います。v1には段別ルートの証明がないため、v2のCLEARは付けません。旧ベストは地図上で表示します。

破損したv2は旧キーから回復を試みます。読み書きが拒否されてもメモリ上で遊べます。未来のschema/generationは上書きせず、体験モードで起動します。masteryのキーは72 factsのみに限定します。

## 仕様の具体化

- 3ルートは、のぼり → くだり → まよいの順で開きます。★・時間・ノーミスは進行条件にしません。
- のぼり・くだりは3問ずつ3ウェーブ、HP3、会心なし。ウェーブ撃破+1◇、ルート+2◇。まよいはHP12、ルート+3◇です。
- 会心はまよいのみ。現在の初回正答連続数に基づき10% / 2連続15% / 3連続以上25%。ヒント後の正解でも攻撃できます。
- まよいでHPが先に0になっても、9種類全部への正答を必須とします。残HPにはbagの問題を追加し、最大12回の正解で終了します。★の分母は最初の9種類です。
- 「同一戦闘内のfact重複なし」は、初期出題デッキの抽出に適用します。まよいの追加問題と、誤答・時間切れの再回答は、確定仕様上必要な回復出題として例外です。ボス・深淵の初期デッキは常に非復元です。
- 時間切れはダメージなし、コンボを切り、同じfactを後に回します。同一factは1回だけ時間切れになり、回復出題は時間なしです。誤答回数は回復出題まで保持します。
- 時間は★条件ではありません。時間切れ前後を通じて、各factに本人が初めて提出した答えで初回正答を判定します。時間切れだけでは★を減らさず、時間切れ前の誤答履歴は保持します。
- 誤答には、等しいまとまり → ひとつ前の積 → 答えを提示、の3段階ヒント。答え提示後も本人の正答入力を要求します。
- エリアボス9問、中ボス8問、Stage9は12問。エリアボスはその段、中ボスは2・3・5・4、Stage9と深淵は72 facts全体からmastery重みで出題します。
- 深淵metadataは `seed + floor + generationVersion` のみで決まります。出題は同じseed派生乱数と、その時点のmastery/recentFactsで抽出します。masteryが変化した再挑戦では問題が変わることがありますが、階の種類・問題数・時間・報酬は不変です。
- recentFactsは直近18件。候補数が足りる場合は直近のfactsを除外して連続出題を防ぎ、候補が足りない場合だけ重みを下げて復帰させます。
- 深淵ボスは6〜9問をseedで決定、100Fは12問。通常階+1◇、強敵+3◇、ボス・50F+5◇、100F+20◇を実装初期値としています。
- 「時間なしであそぶ」は全時間制限を外せます。休憩、画面非表示、ウィンドウのフォーカス喪失、バッジずかんで残り時間を停止します。
- 戦闘中に地図へ戻った場合、獲得済みのウェーブ報酬とmasteryを保持し、その戦闘は最初から再挑戦。深淵は現在階を保存し、CLEAR時だけ次階へ進めます。

## 実機で残る確認

自動のWebKit検証はiPhone実機のSafariそのものではありません。実機で、縦横回転、セーフエリア、テンキー操作時にOSキーボードが出ないこと、ホームへ切り替えたときの時間停止、音ON後の再開、VoiceOverでの問題・選択肢・ログの読み上げを確認してください。外部画像・音源・Webフォントは使っていません。
