# SPAM BLOCKER v2

iPhoneで番号を確認し、着信拒否用のVCF連絡先を作成する静的ユーティリティ。
VCF作成は着信拒否の完了を意味しない。保存・拒否設定はiPhone側で行う。

## 構成

- `index.html`: Quick Block / 一括登録 / 使い方・設定。semantic HTML。
- `app.css`: システムフォント、小型画面・safe-area・44px操作対象。
- `app.mjs`: 入力・画面・一時リスト・明示的な旧版データ削除。
- `phone.mjs`: 番号の検証、表示、URL受け取り、一括重複排除。
- `vcf.mjs`: vCard 3.0生成、Blobダウンロード。
- `tests/`: Node標準テストと、テスト用Playwrightスクリプト。

フレームワーク、バックエンド、第三者通信、Service Workerは追加しない。
ルートのmemo用SWは列挙されたmemo資産だけを扱い、本ディレクトリをキャッシュしない。
アイコンは既存 `../icons/icon-192.png`。アセットは相対パス、ES modulesはGitHub Pagesで直接配信。

## 互換と意図した変更

- `/spam-blocker/` と `?num=` は維持。既存のエンコードなし先頭 `+` も受理。
- URL入力は自動入力のみ。自動ダウンロードやキーボードの自動表示はしない。
- URLの番号は無効値でも取り除く。他のクエリとハッシュは保持。最初のHTTP要求・既存の履歴まで消去する機能ではない。
- 電話番号は外部API、解析、フォントサービスへ送信しない。`no-referrer` を指定。
- 国内番号と `+81` は同じ国際形式TELへ。`+81(0)…` は修正を推測せず拒否。
- 国内番号は10桁を基本とし、070/080/090/050/0800は11桁、0120は10桁。短縮番号・内線・020等の特殊な番号形式は対象外。
- 海外は `+` に続く6〜15桁の書式のみ確認する。国番号の割当、番号の実在、迷惑電話判定は行わない。
- 03/06以外の地域番号は区切り位置を推測しない。文字列の無条件な除去や `innerHTML` 描画を廃止。
- QuickのFN/N、BatchのFN/N、TEL;TYPE=CELL、UTF-8 MIME、CRLF、Blob+anchor経路を維持。CELLは旧版との互換ラベルであり番号種別の判定ではない。
- Batchは複数TELを持つ1連絡先。最大200件、国内/+81重複排除。不正行がある追加操作は全体を拒否。未追加の入力がある間は書き出し不可。
- `spam-国内番号.vcf` / `spam-blocker.vcf` を維持。+81からのQuick生成も国内形式の同じファイル名へ統一。
- URLの有効番号、作成後の番号を残し、再作成を可能にした。次の番号へ進む操作でクリア。
- Batchはメモリだけで保持し、再読み込みで消える。旧 `spam-blocker-numbers` は自動読込・変更せず、ヘルプ内の明示操作で削除できる。
- SE3回避策とClassic表示、URLショートカット、設定経由、既存連絡先への追加を残す。ただし旧版の「必ず直る」「ほぼ100%」など未裏付けの断定を削除。

## テスト

リポジトリルートから:

```sh
node --test spam-blocker/tests/core.test.mjs
node --check spam-blocker/app.mjs
```

ブラウザーテストは本番に依存を加えず、別ディレクトリへPlaywrightをインストールして使う:

```sh
npm install --prefix /tmp/spam-tests --no-audit --no-fund playwright@1.62.1
node /tmp/spam-tests/node_modules/playwright/cli.js install --with-deps chromium webkit
PLAYWRIGHT_MODULE=/tmp/spam-tests/node_modules/playwright/index.mjs node spam-blocker/tests/browser.mjs
```

`.github/workflows/spam-blocker-tests.yml` も同じテストを実行する。
GitHub Pages相当のサブパスでローカル配信し、Chromium/WebKitの375px基本操作と
320/375/390/667/1280pxのレイアウト、VCFの実ダウンロードを確認する。
スクリーンショットは `/tmp/spam-blocker-evidence/` に生成する（架空のテスト番号のみ）。

## 実機での確認

ブラウザーのWebKit検証はiPhone実機検証の代わりにはならない。
Safariのダウンロード→連絡先取り込み、ホーム画面からのファイル受け渡し、
実際のキーボード・貼り付け許可、iPhone設定での着信拒否を実機で確認する。

## ヘルプの根拠

2026-09-14にAppleの案内を確認し、設定の説明を整理:

- [連絡先を着信拒否](https://support.apple.com/ja-jp/guide/iphone/iph2527f620e/ios)
- [iPhoneの着信拒否](https://support.apple.com/ja-jp/111104)
- [不明な発信者の管理](https://support.apple.com/ja-jp/111106)
