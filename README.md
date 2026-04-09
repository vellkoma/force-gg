# LoL Stats JP

日本語対応のLeague of Legends戦績・統計Webアプリ。

**差別化ポイント**: 日本語UI × AIコーチング（Claude API）を組み合わせた唯一のサービス。

## 機能

- チャンピオン一覧（日本語名・ロールフィルター・検索）
- サモナー検索・戦績表示（実装中）
- チャンピオン統計・勝率表示（実装中）

## 技術スタック

**フロントエンド**
- React 18 + Vite + TypeScript
- TailwindCSS（LoLダークゲーミングテーマ）
- React Query v5 / React Router v6 / Recharts

**バックエンド**
- FastAPI + Pydantic v2（Python 3.11+）
- Redis（キャッシュ）
- Riot Games API / Data Dragon API

## セットアップ

### バックエンド

```bash
cd backend
cp .env.example .env
# .env に RIOT_API_KEY を設定
pip install -r requirements.txt
uvicorn main:app --reload
# → http://localhost:8000/docs
```

### フロントエンド

```bash
cd web
cp .env.example .env
npm install
npm run dev
# → http://localhost:3000
```

### 環境変数

**backend/.env**
```
RIOT_API_KEY=RGAPI-your-key-here
REDIS_URL=redis://localhost:6379
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

**web/.env**
```
VITE_API_URL=  # 空のままでOK（Viteプロキシ経由）
```

## ロードマップ

- [x] Phase 1: 基盤構築（React + FastAPI + チャンピオン一覧）
- [ ] Phase 2: Web MVP（サモナー検索・戦績・AdSense）
- [ ] Phase 3: Web強化（ビルド推奨・SEO・プレミアム設計）
- [ ] Phase 4: Desktopアプリ（Electron + LCU API）
- [ ] Phase 5: 収益最大化（AIコーチング・Stripe）

## ライセンス

このプロジェクトはRiot Games APIを使用しています。
LoL Stats JPはRiot Gamesが承認・後援するものではなく、Riot GamesまたはLeague of Legendsの制作・管理に公式に関与している者のものでもありません。
League of Legends及びRiot GamesはRiot Games, Inc.の商標または登録商標です。
