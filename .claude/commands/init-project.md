# /init-project — プロジェクト初期化コマンド

Phase 1の「プロジェクト初期化」タスクを実行します。
web/ と backend/ のディレクトリ構造・依存関係・設定ファイルを一括生成します。

## 実行内容

### 1. ディレクトリ構造作成
```bash
mkdir -p web backend shared docs
mkdir -p backend/app/{routers,services,models,cache}
mkdir -p web/src/{components/{ui,champions,summoner,ads},pages,hooks,api,types,utils}
```

### 2. Web（React + Vite）初期化
```bash
cd web
npm create vite@latest . -- --template react-ts --force
npm install
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
npm install @tanstack/react-query@5 react-router-dom axios recharts
npm install -D @types/node
```

### 3. Backend（FastAPI）初期化
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install fastapi uvicorn[standard] httpx redis pydantic-settings python-dotenv tenacity
pip install stripe auth-lib asyncpg sqlalchemy
pip freeze > requirements.txt
```

### 4. 設定ファイル生成
以下のファイルを生成すること：
- `web/tailwind.config.ts`（LoLカラーパレット込み）
- `web/src/main.tsx`（QueryClient・RouterProvider設定）
- `backend/main.py`（FastAPI app + CORS設定）
- `backend/app/deps.py`（Redis・DB依存性注入）
- `.env.example`（全環境変数のテンプレート）
- `.gitignore`（node_modules, venv, .env）

### 5. Tailwind カスタムカラー設定

```typescript
// web/tailwind.config.ts に追加するカスタムカラー
colors: {
  lol: {
    bg:      '#070B14',
    card:    '#0D1626',
    sub:     '#111827',
    border:  '#1E2A40',
    text:    '#E0E6F0',
    muted:   '#6B7A99',
    cyan:    '#00C6FF',
    gold:    '#C89B3C',
    success: '#00E676',
    warning: '#FFB347',
    danger:  '#FF6B6B',
  }
}
```

## 完了後
- CLAUDE.md の `[ ] React + Vite プロジェクト初期化` を `[x]` に更新
- CLAUDE.md の `[ ] FastAPI バックエンド構築` を `[x]` に更新
- 次のタスクを `@agent-react-component-builder` に委譲してチャンピオン一覧ページ実装
