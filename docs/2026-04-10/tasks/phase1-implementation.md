# Phase 1 実装サマリー — 2026-04-10

## 実装内容

### フロントエンド（web/）
- React 18 + Vite 5 プロジェクト初期化
- TailwindCSS（LoLダークゲーミングテーマ: `#0a0e1a` / `#c89b3c`）
- React Query v5 + React Router v6 セットアップ
- 汎用UIコンポーネント: Button / Card / LoadingSpinner / Skeleton
- チャンピオン一覧: ChampionCard / ChampionGrid / ChampionsPage
  - 検索バー（名前・称号・英字IDでフィルタ）
  - ロールフィルター（7種類、日本語）
  - レスポンシブグリッド（2〜6列）
- APIクライアント（Axios、429ハンドリング）
- カスタムフック: useChampions

### バックエンド（backend/）
- FastAPI + Pydantic v2
- Data Dragon API連携（チャンピオン一覧・詳細、日本語データ）
- Redisキャッシュ層（インメモリフォールバック付き）
- エンドポイント:
  - `GET /api/champions` — 全チャンピオン一覧
  - `GET /api/champions/{id}` — 単体詳細
- summoner / match ルータースケルトン（Phase 2用）
- CORS設定（localhost:5173）

## 起動方法

```bash
# バックエンド
cd backend
cp .env.example .env  # RIOT_API_KEY を設定
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# フロントエンド
cd web
cp .env.example .env
npm install
npm run dev
```

## 次フェーズ（Phase 2）への準備
- summoner / match ルータースケルトン実装済み
- `RIOT_API_KEY` を `.env` に設定するだけでRiot API呼び出し可能
- フロントエンドの `hooks/` に `useSummoner`, `useMatchHistory` を追加する予定
