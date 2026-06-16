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
| `bench/index.html` | 工房の電卓 / Maker's Bench | 電子工作の作業台に常駐するオフライン計算ツール集（オームの法則・LED直列抵抗・カラーコード・555タイマー・電池駆動時間・エンジニア表記パーサ）。Amazonアフィリエイト対応PWA。 |
| `fixit/index.html` | 直し方ナビ / Fix-it Navigator | よくあるトラブルを質問に答えるだけで切り分ける対話式診断ウィザードPWA。iPhoneのYahoo!メール（IMAP/SMTP遮断）とWindows11 24H2の共有フォルダ問題を収録。note記事から `#yahoo-mail` `#win-share` で直リンク可。オフライン対応・Amazonアフィリエイト対応。 |
| `kit/index.html` | 装備ナビ / Maker's Starter Kit | 電子工作の工具・部品ストックをステップ別にチェックし、Amazonの買い物リストに集約するPWA。「持ってる」消し込み・調達先ガイド（Amazon/AliExpress/秋月千石/aitendo）つき。note「電子工作部品の話」vol.1〜3の選定がベース。オフライン対応・Amazonアフィリエイト対応。 |

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

`memo.html` や `manifest.json` を更新したら `sw.js` の `CACHE_NAME` を bump すること（`memo-v1` → `memo-v2` …）。
