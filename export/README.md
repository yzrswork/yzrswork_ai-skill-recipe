# yzrs-times 移送用エクスポート

`yzrs-times.bundle` は yzrs-times リポジトリの全履歴（4コミット）を含む git bundle。
セッションの権限制約で直接pushできなかったため、この認可済みリポジトリを中継している。

## 展開してpushする手順

```bash
git clone yzrs-times.bundle yzrs-times
cd yzrs-times
git remote set-url origin https://github.com/yzrswork/yzrs-times.git
git push -u origin main
```

push完了後、このexport/ディレクトリとブランチは削除してよい。
