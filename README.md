# yzrswork — デジタル作品置き場

や印工務店（yzrswork）が制作したデジタル作品の公開置き場です。

公開URL: https://yzrswork.github.io/yzrswork_ai-skill-recipe/

## 収録作品

| ファイル | タイトル | 概要 |
|---|---|---|
| `yzrsynth/` | YZRsynth_v3.1 | 16ステップドラムシーケンサー・5音色シンセ・ルーパー搭載のiPhone向けリズムマシン（TR-909風UI）。ルートの `yzrsynth.html` `tr808.html` はリダイレクトのみ |
| `grid/` | Grid Instrument | タッチで音が鳴るグリッド楽器。ルートの `grid.html` はリダイレクトのみ |
| `fireworks/` | 花火 | タッチで打ち上げ花火を楽しむ。ルートの `fireworks.html` はリダイレクトのみ |
| `asobou/` | あそぼう | インタラクティブな遊び場。ルートの `project/index.html` はリダイレクトのみ |
| `news/` | 電子工作通信 | 電子工作の記録・ニュース。ルートの `news.html` はリダイレクトのみ |
| `otamatone/` | オタマトーン WEB | しっぽのリボンをなぞって鳴らす白いオタマトーン。TR-808エフェクトとルーパー搭載。ルートの `otamatone.html` はリダイレクトのみ |
| `prompt-forge/` | Prompt Forge | マネキン2体のキャラクターでプロンプトを生成する画像生成AI向けツール。ルートの `prompt-forge.html` はリダイレクトのみ |
| `metronome/` | Metronome Watch | ネオン時計型メトロノーム（16小節×4拍）。ルートの `metronome-watch.html` はリダイレクトのみ |
| `mizu/` | Mizu | 指でなぞって描く水彩トレース。旧`grid_v2.html`は同じ作品への転送のみ |
| `virus-busters/` | ウィルスバスターズ | iPhone向け縦持ちディフェンスゲーム（全20ステージ・図鑑50種）。ルートの `virus-busters.html` はリダイレクトのみ |
| `x-bookmark-logger.html` | X Bookmark Logger | Xのブックマークを自動でGitHub上のObsidian VaultにMarkdown保存するユーザースクリプト（導入ガイド + `x-bookmark-logger.user.js` / `x-bookmark-uploader.user.js`） |
| `note-pv-logger.html` | note PV Logger | noteの全記事のビュー数をダッシュボードAPIから取得し、CSV/TSV/Markdownで書き出すユーザースクリプトの導入ガイド（`note-pv-logger.user.js` / `note-pv-md-logger.user.js`）。トークン不要 |
| `note-pv-logger.user.js` | note PV Logger | noteのダッシュボードAPIから全記事のビュー・スキ・コメント数を取得し、CSVダウンロード/TSVコピーできるユーザースクリプト。noteにログインした状態でページ右下の「📊 PV」ボタンから使う |
| `note-pv-md-logger.user.js` | note PV Markdown Logger | 同じくnoteの全記事ビュー数を取得し、Obsidian向けに「1スナップショット=1ファイル」のMarkdown（frontmatter付き表）としてダウンロード/コピーできるユーザースクリプト。右下の「📝 PV→MD」ボタンから使う |
| `tools/index.html` | 道具箱 / The Toolbox | ランチャーPWA。工房の電卓・装備ナビ・直し方ナビ・HDD選びナビ・自作PC構成プランナー・メモリ選びナビの6本は本体がappsへ移設済みのため `https://apps.yzrswork.com/<slug>/` へ直リンク。e-photoframe ラボと迷惑電話ブロッカーはASR固有のためフルアプリのまま掲載。Web Share共有・ホーム画面追加対応。 |
| `bench/` | 工房の電卓 / Maker's Bench | 本体は https://apps.yzrswork.com/bench/ へ移設済み。ここはハッシュ保持型のリダイレクトのみ（旧PWAキャッシュ解除つき）。 |
| `fixit/` | 直し方ナビ / Fix-it Navigator | 本体は https://apps.yzrswork.com/fixit/ へ移設済み（`#yahoo-mail` `#win-share` `#pc-boot` `#obsidian-sync` の直リンクもapps側で有効）。ここはハッシュ保持型のリダイレクトのみ（旧PWAキャッシュ解除つき）。 |
| `kit/` | 装備ナビ / Maker's Starter Kit | 本体は https://apps.yzrswork.com/kit/ へ移設済み。ここはハッシュ保持型のリダイレクトのみ（旧PWAキャッシュ解除つき）。 |
| `lab/index.html` | e-photoframe ラボ / Modules & Power Planner | e-photoframeシリーズで使ったモジュール（ZN02B/TM1637/XY-WRBT/HW-104/Digispark/TP4056/SPL-2等）の図鑑と、5V単一電源（PDB-1構成）の配電プランナーを2タブで収録するPWA。消費電流を積み上げてACアダプタ容量・ポート数の余裕を確認。各モジュールは出典note記事つき。オフライン対応・Amazonアフィリエイト対応。ASR固有のためフルアプリのまま。 |
| `hdd/` | HDD選びナビ / WD Color & CMR/SMR | 本体は https://apps.yzrswork.com/hdd/ へ移設済み。ここはハッシュ保持型のリダイレクトのみ（旧PWAキャッシュ解除つき）。 |
| `build/` | 自作PC 構成プランナー / PC Build Planner | 本体は https://apps.yzrswork.com/build/ へ移設済み。ここはハッシュ保持型のリダイレクトのみ（旧PWAキャッシュ解除つき）。 |
| `mem/` | メモリ選びナビ / DDR Spec & Capacity | 本体は https://apps.yzrswork.com/mem/ へ移設済み。ここはハッシュ保持型のリダイレクトのみ（旧PWAキャッシュ解除つき）。 |
| `jitsumu450/index.html` | 実務メーター450 / Surveyor Hours Recorder | 測量士登録申請（測量法第50条第3号、450日）に向けた実務時間の現場記録PWA。案件IDと実務時間をタップ記録、8時間=1日換算の達成メーター、判定チートシート、Obsidian実務記録テンプレ準拠のMarkdown/TSV書き出し。データは端末のlocalStorageのみ。オフライン対応。 |
| `bousai/index.html` | 家族防災カード / Family Disaster Card | 家族の防災ポケットカードPWA。発災直後の初動3か条、時間帯別タイムライン（0-10分/1時間/24時間/1週間）、持ち出し・停電・断水チェックリスト、171安否確認の手順、避難訓練の実施記録と期限アラート。集合場所などの家族情報は各端末で入力（アプリにデータは含まない）。オフライン対応。 |
| `fieldcad/index.html` | FieldCAD / Field Layout Sketch | 現場の寸法を入力するだけで正面図、背面図、断面図を自動生成するフィールドCAD PWA。穴はパーツローカルの2D座標で保持し、配置のみ90度単位回転のアセンブリ座標を持つ設計で、投影と断面と干渉判定を軸平行境界箱の演算に単純化。iPhone Safariファースト、SVG描画、IndexedDB永続化。設計の正は `fieldcad/DESIGN.md`。 |

## ローカルで動かす

```
python3 -m http.server 8000
```

ブラウザで `http://localhost:8000` を開く。

iPhone から試す場合は Mac と同じ Wi-Fi に接続し、`ipconfig getifaddr en0` で調べたIPアドレスを使う。

## memo.html の PWA 動作確認

`memo.html` は PWA 対応済み（`manifest.json` / `sw.js` / `icons/`）。

```bash
# プロジェクトルートで簡易サーバ起動
python -m http.server 8000

# Chromeで http://localhost:8000/memo.html を開く
# DevTools > Application > Service Workers でアクティブ確認
# DevTools > Application > Manifest でアイコン・設定確認
# DevTools > Network > Offline にチェック → リロードで動作確認
```

アイコンは `generate_icons.py` で再生成できる:

```bash
pip install Pillow
python generate_icons.py
```

OGP共有カード（note/Xでのリッチ表示用 `icons/og-card.png` 1200x630）は `generate_og.py` で生成できる:

```bash
pip install Pillow
python generate_og.py
```

`memo.html` や `manifest.json` を更新したら `sw.js` の `CACHE_NAME` を bump すること（`memo-v1` → `memo-v2` …）。
