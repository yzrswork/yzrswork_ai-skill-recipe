# yzrswork — デジタル作品置き場

や印工務店（yzrswork）が制作したデジタル作品の公開置き場です。

公開URL: https://yzrswork.github.io/yzrswork_ai-skill-recipe/

## 収録作品

| ファイル | タイトル | 概要 |
|---|---|---|
| `yzrsynth.html` | YZRsynth_v3.1 | 16ステップドラムシーケンサー・5音色シンセ・ルーパー搭載のiPhone向けリズムマシン（TR-909風UI）。旧 `tr808.html` はリダイレクトのみ |
| `grid.html` | Grid Instrument | タッチで音が鳴るグリッド楽器 |
| `fireworks.html` | 花火 | タッチで打ち上げ花火を楽しむ |
| `project/index.html` | あそぼう | インタラクティブな遊び場 |
| `news.html` | 電子工作通信 | 電子工作の記録・ニュース |
| `virus-busters.html` | ウィルスバスターズ | iPhone向け縦持ちディフェンスゲーム（全20ステージ・図鑑50種） |
| `x-bookmark-logger.html` | X Bookmark Logger | Xのブックマークを自動でGitHub上のObsidian VaultにMarkdown保存するユーザースクリプト（導入ガイド + `x-bookmark-logger.user.js` / `x-bookmark-uploader.user.js`） |
| `note-pv-logger.html` | note PV Logger | noteの全記事のビュー数をダッシュボードAPIから取得し、CSV/TSV/Markdownで書き出すユーザースクリプトの導入ガイド（`note-pv-logger.user.js` / `note-pv-md-logger.user.js`）。トークン不要 |
| `note-pv-logger.user.js` | note PV Logger | noteのダッシュボードAPIから全記事のビュー・スキ・コメント数を取得し、CSVダウンロード/TSVコピーできるユーザースクリプト。noteにログインした状態でページ右下の「📊 PV」ボタンから使う |
| `note-pv-md-logger.user.js` | note PV Markdown Logger | 同じくnoteの全記事ビュー数を取得し、Obsidian向けに「1スナップショット=1ファイル」のMarkdown（frontmatter付き表）としてダウンロード/コピーできるユーザースクリプト。右下の「📝 PV→MD」ボタンから使う |
| `tools/index.html` | 道具箱 / The Toolbox | 実用ツール（工房の電卓・装備ナビ・e-photoframe ラボ・直し方ナビ・HDD選びナビ・メモリ選びナビ）をまとめたランチャーPWA。各ツールへ直リンク、Web Share共有・ホーム画面追加対応。全ツールにOGP/Twitterカードを付与しnote/Xでの共有時にリッチ表示。 |
| `bench/index.html` | 工房の電卓 / Maker's Bench | 電子工作の作業台に常駐するオフライン計算ツール集（オームの法則・LED直列抵抗・カラーコード・555タイマー・電池駆動時間・エンジニア表記パーサ）。Amazonアフィリエイト対応PWA。 |
| `fixit/index.html` | 直し方ナビ / Fix-it Navigator | よくあるトラブルを質問に答えるだけで切り分ける対話式診断ウィザードPWA。Yahoo!メール（IMAP/SMTP遮断）・Windows11 24H2共有フォルダ・自作PCのビープ音／起動不良・iPhone版Obsidian同期の4件を収録。note記事から `#yahoo-mail` `#win-share` `#pc-boot` `#obsidian-sync` で直リンク可。オフライン対応・Amazonアフィリエイト対応。 |
| `kit/index.html` | 装備ナビ / Maker's Starter Kit | 電子工作の工具・部品ストックをステップ別にチェックし、Amazonの買い物リストに集約するPWA。「持ってる」消し込み・調達先ガイド（Amazon/AliExpress/秋月千石/aitendo）つき。note「電子工作部品の話」vol.1〜3の選定がベース。オフライン対応・Amazonアフィリエイト対応。 |
| `lab/index.html` | e-photoframe ラボ / Modules & Power Planner | e-photoframeシリーズで使ったモジュール（ZN02B/TM1637/XY-WRBT/HW-104/Digispark/TP4056/SPL-2等）の図鑑と、5V単一電源（PDB-1構成）の配電プランナーを2タブで収録するPWA。消費電流を積み上げてACアダプタ容量・ポート数の余裕を確認。各モジュールは出典note記事つき。オフライン対応・Amazonアフィリエイト対応。 |
| `hdd/index.html` | HDD選びナビ / WD Color & CMR/SMR | Western DigitalのHDDを用途から色（Blue/Red Plus/Red/Purple/Black）で選び、CMR/SMRをシリーズ別早見と型番末尾チェッカー（EFPX/EFZX/EFRX/EFAX/EARZ/EZAZ/EZBX）で判定するPWA。RAID/NASにSMRを避けるための注意つき。note「WDの色の選び方ガイド」＋最新公式情報がベース。オフライン対応・Amazonアフィリエイト対応。 |
| `build/index.html` | 自作PC 構成プランナー / PC Build Planner | CPUソケット→DDR規格、用途→RAM容量、ストレージ用途、GPUクラス→電源容量の目安を順に選んで構成サマリーと買い物リンクを出すPWA。LGA1700のDDR分岐・RTX50系の新コネクタ注意・組み立て/初回起動チェックリストつき。HDD選び/メモリ選び/起動診断へ相互リンク。オフライン対応・Amazonアフィリエイト対応。 |
| `mem/index.html` | メモリ選びナビ / DDR Spec & Capacity | 自作PCのメモリを、ソケット（AM5/AM4/LGA1700/LGA1851）からDDR規格を確認し、用途から容量を選び、2枚構成（デュアルチャネル）で組むための選び方PWA。XMP/EXPO・JEDEC定格・ノッチ非互換の注意つき。note「DDR3〜DDR5の話」＋2026年の最新ソケット対応がベース。オフライン対応・Amazonアフィリエイト対応。 |

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
