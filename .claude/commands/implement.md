# /implement <機能名> — 機能実装コマンド

## 使い方
```
/implement サモナー検索ページ
/implement チャンピオン一覧API
/implement Stripe課金フロー
/implement Phase1
```

## 実行手順

1. CLAUDE.md を読み込み、現在のフェーズ・技術スタック・規約を確認

2. 機能を分解し、担当エージェントを特定：
   - Riot API / FastAPIエンドポイント → `@agent-riot-api-specialist`
   - React UI / ページ / フック → `@agent-react-component-builder`
   - Electron / LCU API → `@agent-electron-lcu-specialist`
   - AdSense / Stripe → `@agent-monetization-advisor`
   - Phase丸ごと → `@agent-phase-orchestrator`

3. 実行前に以下を確認・提示：
   ```
   ## 実装プラン

   **機能**: [機能名]
   **影響ファイル**: [ファイルパス一覧]

   ### 実行順序
   Step 1 [並列]: @agent-xxx + @agent-yyy
   Step 2 [順次]: @agent-zzz

   続行しますか？
   ```

4. 実装実行

5. 完了後、`@agent-code-reviewer` で自動レビュー

6. CLAUDE.md のフェーズチェックボックスを更新（完了タスクに `[x]`）

7. 実装サマリーを `docs/YYYY-MM-DD/tasks/` に保存
