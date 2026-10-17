# Kiro — 機能概要

Kiroは、AWS製のAI開発環境（IDE）。VSCodeベースのエディタにAIエージェントを統合し、コードを書くだけでなく設計・実装・デバッグまでを自律的にサポートする。

---

## セッションタイプ

| タイプ | 用途 |
|--------|------|
| **Vibe** | 会話・質問・探索的なコーディング |
| **Spec** | 要件 → 設計 → タスクの構造化ワークフロー |

---

## 自律性モード

| モード | 動作 |
|--------|------|
| **Autopilot**（デフォルト） | タスクをエンドツーエンドで自律実行。変更の確認・巻き戻しはいつでも可能 |
| **Supervised** | ターンごとに承認を求める。ファイル変更をhunkレベルで accept/reject できる |

---

## 主要機能

### Spec（構造化開発）
要件・設計・タスクの3ドキュメントをAIが生成・管理する開発フロー。
- `.kiro/specs/{feature-name}/` に `requirements.md`, `design.md`, `tasks.md` を生成
- ワークフロー選択: Requirements-First / Design-First / Bugfix / Quick Plan

### Steering（ルール注入）
`.kiro/steering/*.md` に書いたルールをAIに自動で読み込ませる。
- **always**（デフォルト）: 全セッションで常に適用
- **fileMatch**: 特定ファイルが開かれたときだけ適用（front-matterで `inclusion: fileMatch` + `fileMatchPattern`）
- **manual**: `#ファイル名` で明示的に呼び出したときだけ適用（`inclusion: manual`）
- `#[[file:<相対パス>]]` でOpenAPI仕様などの外部ファイルを参照可能

### Hooks（自動トリガー）
IDEイベントに応じてエージェントを自動起動するルール。`.kiro/hooks/` に JSON で定義。

**トリガーイベント:**
- `fileEdited` / `fileCreated` / `fileDeleted` — ファイル操作
- `promptSubmit` / `agentStop` — チャットイベント
- `preToolUse` / `postToolUse` — ツール実行前後
- `preTaskExecution` / `postTaskExecution` — Specタスク実行前後
- `userTriggered` — 手動実行

**アクション:**
- `askAgent`: エージェントにプロンプトを送る
- `runCommand`: シェルコマンドを実行する

### MCP（Model Context Protocol）
外部ツール・サービスをAIに接続する拡張機構。
- 設定: `~/.kiro/settings/mcp.json`（グローバル）または `.kiro/settings/mcp.json`（ワークスペース）
- `uvx` コマンドで多くのMCPサーバーを追加インストール不要で実行可能

### チャットコンテキスト
- `#File` / `#Folder` でファイル・フォルダをコンテキストに追加
- `#Problems` で現在のエラー、`#Terminal` でターミナル出力、`#Git Diff` で差分を参照
- 画像・PDF・DOCXをドラッグ＆ドロップで添付可能

### Powers
ドキュメント・ワークフローガイド・MCPサーバーをパッケージ化した拡張機能。コンテキストを最小化しつつ必要な機能を on-demand でロードする。

---

## グローバル vs ワークスペース設定

| スコープ | パス |
|----------|------|
| グローバル（全ワークスペース共通） | `~/.kiro/steering/`, `~/.kiro/settings/mcp.json` |
| ワークスペース固有 | `.kiro/steering/`, `.kiro/settings/mcp.json` |

ワークスペース設定がグローバル設定より優先される。
