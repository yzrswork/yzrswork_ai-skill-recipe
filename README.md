# TR-808 KIDS — iPhone向けシンセゲーム

## 動かし方

```
python3 -m http.server 8000
```

Mac と iPhone を同じ Wi-Fi に接続し、Mac の IP アドレスを確認：

```
ipconfig getifaddr en0
```

iPhone の Safari で `http://[ローカルIP]:8000` を開く。

## ファイル構成

- `index.html` — 単一ファイル。外部依存なし。

## 機能

- **PLAYモード** — 4音色(ピコピコ/ふわふわ/キラキラ/ブイーン)、マルチタッチ演奏、ARP/DELAY/REVERB/CHORUSエフェクト
- **GAMEモード** — きらきら星・カエルの合唱・チューリップのリズムゲーム、星3つ評価
