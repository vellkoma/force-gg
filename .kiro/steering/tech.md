# force.gg — 技術スタック＆コマンド

## バックエンド（Python）

| レイヤー | 技術 |
|----------|------|
| フレームワーク | FastAPI 0.115 + Pydantic v2 |
| ランタイム | Python 3.11+、全面 `async/await` |
| HTTP クライアント | `httpx.AsyncClient` |
| キャッシュ | Redis（`redis==5.2`）、インメモリフォールバックあり |
| データベース | PostgreSQL（`asyncpg`）、Esports スケジュール用に SQLite |
| 認証 | JWT（`python-jose`）+ bcrypt（`passlib`）|
| 設定管理 | `pydantic-settings`、`backend/.env` から読み込み |
| 決済 | Stripe SDK（`stripe==11.4`）|
| AI | Anthropic SDK（`anthropic>=0.20`）— Claude API |
| メール | Resend（HTTP 経由）|
| デプロイ | Railway（Docker）|

### バックエンドの主要パターン
- 全設定は `app.core.config` のシングルトン `settings` オブジェクトで管理
- エラーは `HTTPException` で統一、メッセージは日本語
- Redis キャッシュキーは `{domain}:{identifier}` 形式（例: `summoner:Faker#JP1`）
- キャッシュ TTL は `settings` で定義（例: `cache_ttl_summoner = 600`）
- Riot API: サモナー/ランクは JP1（`jp1.api.riotgames.com`）、Match v5 は ASIA（`asia.api.riotgames.com`）
- PUUID を必ず使用 — `summonerName` は非推奨
- 429 レスポンスは `Retry-After` ヘッダーを読んで処理
- 静的画像は `backend/img/` を `StaticFiles` でサーブ

### バックエンド起動コマンド
```powershell
# 推奨（古いプロセスを自動終了）
cd backend
.\start.ps1

# 手動
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
- API ドキュメント: http://localhost:8000/docs

---

## Web フロントエンド（TypeScript）

| レイヤー | 技術 |
|----------|------|
| フレームワーク | React 18 + Vite 5 |
| 言語 | TypeScript 5 |
| スタイリング | TailwindCSS 3（ダークゲーミングテーマ）|
| データフェッチ | TanStack React Query v5 |
| ルーティング | React Router v6 |
| HTTP | axios（`web/src/api/client.ts` の共通 `apiClient` 経由）|
| グラフ | Recharts |
| デプロイ | Vercel |

### フロントエンドの主要パターン
- 全 API 呼び出しは `apiClient` axios インスタンス経由 — `fetch` を直接使わない
- データフェッチはカスタムフック（`hooks/use*.ts`）に React Query でラップ
- クエリキーファクトリーはフックファイル内に定義（例: `summonerKeys`）
- 関数コンポーネントのみ — クラスコンポーネント禁止
- スタイリングは TailwindCSS のみ — インラインスタイル禁止
- コンポーネントは 200 行以内

### Web コマンド
```bash
cd web
npm run dev          # 開発サーバー → http://localhost:5173
npm run build        # tsc + vite ビルド
npm run type-check   # tsc --noEmit（型チェックのみ）
npm run lint         # eslint、警告 0 件が基準
```

---

## デスクトップ（Electron）

| レイヤー | 技術 |
|----------|------|
| フレームワーク | Electron 40 + electron-vite 2 |
| レンダラー | React 18 + React Router v7 + TailwindCSS |
| ビルド/配布 | electron-builder 26 |
| 自動アップデート | electron-updater |
| IPC | contextBridge（preload パターン）|
| LCU API | カスタムクライアント（`desktop/src/main/lcu.ts`）|
| ローカルストレージ | electron-store |
| データベース | better-sqlite3（オフラインデータ）|

### デスクトップコマンド
```bash
cd desktop
npm run dev          # Electron 開発モード起動
npm run build        # electron-vite ビルド
npm run dist:win     # Windows 用ビルド＆パッケージ化
npm run release:win  # ビルド＆GitHub Releases に公開（GH_TOKEN 必要）
```
- リリース出力先: `desktop/release/`

---

## 環境変数

### `backend/.env`
| キー | 説明 |
|------|------|
| `RIOT_API_KEY` | Riot 開発者キー（開発環境では 24 時間で期限切れ）|
| `REDIS_URL` | `redis://localhost:6379` |
| `JWT_SECRET_KEY` | 32 文字以上、本番環境では必須 |
| `ANTHROPIC_API_KEY` | Claude API キー（AI コーチング用）|
| `STRIPE_SECRET_KEY` | Stripe シークレットキー |
| `STRIPE_WEBHOOK_SECRET` | Stripe Webhook シークレット |
| `DATABASE_URL` | PostgreSQL 接続文字列 |
| `CORS_ORIGINS` | 許可オリジン（カンマ区切り）|

### `web/.env`
| キー | 説明 |
|------|------|
| `VITE_API_URL` | バックエンド URL（開発時は空、Vite プロキシが `/api` を処理）|

### `desktop/.env`
| キー | 説明 |
|------|------|
| `VITE_API_BASE_URL` | バックエンド URL（デフォルト: `http://localhost:8000`）|
