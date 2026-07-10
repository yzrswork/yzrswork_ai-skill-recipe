# 作業ログ 2026-07-10 — YZRS Times

## 概要
「AI編集長が毎日編集する、自分専用のデジタル新聞」YZRS Times の壁打ち・設計・MVP実装。
コンセプト検討 → 設計レビュー2巡＋自己レビュー → Fable 5が骨格構築・Sonnet 5サブエージェント
2体が並列実装 → 統合検証まで完了。成果物は専用リポジトリ `yzrs-times` に格納（作成待ち）。

- ブランチ: `claude/yzrs-times-concept-0f15dh`（本リポジトリには設計記録とこのログのみ）
- 成果物: ローカルリポジトリ `/home/user/yzrs-times`（コミット2件・push待ち）
- 設計記録: yzrs-times側の `docs/DESIGN.md`、運用規律は `README.md`「紙面憲法」「データ契約」

## 経緯と主要な意思決定
ユーザー持ち込みのコンセプト（朝昼夕の3版・Hidden Gem・Heat Index・編集長コメント等）を
壁打ちで深掘り。以下を決定:

1. **MVPは朝刊のみ**・見出し原文＋日本語3行要約・Cloudflare Pages＋専用リポジトリ
2. **編集パイプラインは GitHub Actions cron ＋ Gemini API無料枠**（完全¥0運用）。
   Claude Code Routine案（サブスク枠内でAPIトークン代ゼロ）も検討したが、ユーザーはProプランで
   日々の利用枠を毎日消費するため見送り。Claudeは開発・改善役に回す分担とした
3. **AIは編集判断のみ**。収集・重複除去・Heat計算・事実データは決定論的コード

設計レビュー（CTO視点2巡）で確定した規律の要点:
- LLMは候補IDのみ参照（URL・価格・日付を書かせない）＝幻覚の構造的排除
- 号は発行後不変・相場天気は「5:00時点」凍結・1号15本以内・新聞語彙で統一
- 生シグナル保存（Heat式は後から全号再計算可能）・schemaVersion・出自記録(promptHash等)
- 補習cron（8:00 JST・冪等）・全ソースfail-soft・Gemini全滅時もフォールバック発行

## 実装（Sonnet 5サブエージェント2体並列 → Fable 5統合）
- パイプライン: `scripts/`（collect/rank/edit/store＋ソース型別フェッチャー8種＋gemini/mockプロバイダ、
  計約1,600行）。Sonnet 5が実装中に実バグ3件を自己検出・修正（fetchのkeep-aliveによる
  プロセスハング、ソース死活の偽陽性、LLM出力のセクション欠落）
- 紙面: `public/index.html`（単一ファイル・フレームワークなし）。題字→テーマ→発行時点ストリップ
  （静的スパークライン）→一面→セクション→Hidden Gem→編集部より→フィードバック→切り抜き→縮刷版
  の一方向構造。モバイル幅の桁あふれをPlaywright検証で自己検出・修正
- 統合修正（Fable 5）: ウィジェット取得失敗時はnull（紙面はブロック非表示）、空の発行時点帯の抑制、
  月次indexエントリ形のREADME明文化

## 検証
- mockプロバイダでのE2E発行（冪等性・同日号数再利用・fail-soft・スキーマ一致を確認）
- 本サンドボックスは外部通信がallowlist制限のため実ソース取得は不可（本番Actionsは制限なし）。
  手書きfixture候補をrank→edit実経路に通し、記事あり紙面の正しさを確認
- Chromium（iPhone幅/PC幅）で「全ソース遮断のフォールバック号」と「サンプル号」の両方の
  描画を確認。最悪ケースでも誠実な紙面として成立する

## 残タスク（ユーザー側の手作業）
1. github.com/new で `yzrs-times` リポジトリ作成（App権限では作成不可・403確認済み）＋
   Claude GitHub Appへのアクセス付与 → セッションからpush
2. Gemini APIキー発行（AI Studio・クレカ不要）→ Actions secret `GEMINI_API_KEY`
3. Cloudflare Pages接続（Build output: `public`・ビルドコマンドなし）
※ 手順は yzrs-times/SETUP.md に初心者向けに記載済み
