# yzrswork — デジタル作品置き場

や印工務店（yzrswork）が制作したデジタル作品の公開置き場です。

公開URL: https://yzrswork.github.io/yzrswork_ai-skill-recipe/

## 収録作品

| ファイル | タイトル | 概要 |
|---|---|---|
| `tr808.html` | TR-808 KIDS | iPhone向けリズムマシン＆シンセゲーム |
| `grid.html` | Grid Instrument | タッチで音が鳴るグリッド楽器 |
| `fireworks.html` | 花火 | タッチで打ち上げ花火を楽しむ |
| `project/index.html` | あそぼう | インタラクティブな遊び場 |
| `news.html` | 電子工作通信 | 電子工作の記録・ニュース |
| `virus-busters.html` | ウィルスバスターズ | iPhone向け縦持ちディフェンスゲーム（全20ステージ・図鑑50種） |

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
