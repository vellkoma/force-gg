# /review [パス] — コードレビューコマンド

## 使い方
```
/review                      # 変更されたファイル全体をレビュー
/review backend/             # backendディレクトリをレビュー
/review web/src/pages/       # 特定ディレクトリをレビュー
/review app/routers/summoner.py  # 特定ファイルをレビュー
```

## 実行手順

1. 対象パスのファイルを特定（未指定の場合は `git diff --name-only` で変更ファイルを取得）
2. `@agent-code-reviewer` に委譲してレビュー実行
3. Criticalが0件ならOK、1件以上あれば修正を促す

## 注意
- `@agent-code-reviewer` は読み取り専用（ファイル変更なし）
- レビュー結果は `docs/YYYY-MM-DD/tasks/review-result.md` に保存推奨
