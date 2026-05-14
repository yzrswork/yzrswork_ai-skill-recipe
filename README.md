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

## ローカルで動かす

```
python3 -m http.server 8000
```

ブラウザで `http://localhost:8000` を開く。

iPhone から試す場合は Mac と同じ Wi-Fi に接続し、`ipconfig getifaddr en0` で調べたIPアドレスを使う。
