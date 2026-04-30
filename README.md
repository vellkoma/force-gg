# force.gg

日本語対応のLeague of Legends戦績・統計Webアプリ＆デスクトップアプリ。

**差別化ポイント**: 日本語UI × AIコーチング（Claude API）× プロシーンスケジュール表示を組み合わせたサービス。

## 機能

- チャンピオン一覧（日本語名・ロールフィルター・検索）
- サモナー検索・戦績表示
- チャンピオン統計・勝率表示
- プロシーン スケジュール（LJL / LCK / LCS / LEC / LPL / CBLOL / LCP / PCS）
- AIコーチング（Claude API）
- デスクトップアプリ（Electron）

## 技術スタック

**フロントエンド**
- React 18 + Vite + TypeScript
- TailwindCSS（LoLダークゲーミングテーマ）
- React Query v5 / React Router v6 / Recharts

**バックエンド**
- FastAPI + Pydantic v2（Python 3.11+）
- Redis（キャッシュ）・SQLite（Esportsスケジュール）
- Riot Games API / Data Dragon API / Leaguepedia Cargo API

**デスクトップ**
- Electron 28+ / electron-builder / electron-updater

## セットアップ

### バックエンド

```bash
cd backend
cp .env.example .env
# .env に RIOT_API_KEY などを設定
pip install -r requirements.txt
```

**通常起動（推奨）**

```powershell
cd backend
.\start.ps1
```

`start.ps1` は古いPythonプロセスを自動終了してから uvicorn を起動します。
→ http://localhost:8000/docs

**手動起動**

```powershell
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### フロントエンド

```bash
cd web
cp .env.example .env
npm install
npm run dev
# → http://localhost:5173
```

### デスクトップアプリ

```bash
cd desktop
npm install
npm run dev
```

### 環境変数

**backend/.env**
```
RIOT_API_KEY=RGAPI-your-key-here
REDIS_URL=redis://localhost:6379
CORS_ORIGINS=http://localhost:5173
JWT_SECRET_KEY=your-secret-key-32chars-minimum
ANTHROPIC_API_KEY=sk-ant-...   # AIコーチング用（省略可）
STRIPE_SECRET_KEY=sk_test_...  # 課金機能用（省略可）
```

**web/.env**
```
VITE_API_URL=http://localhost:8000
```

## 注意事項

### バックエンド起動時のプロセス管理

uvicorn を `--reload` モードで起動した場合、Ctrl+C で停止しても子プロセスが残ることがあります。
残存プロセスがポート 8000 を占有したまま次の uvicorn が起動すると、**古いコードが応答し続ける**問題が発生します。

**対処法**: `.\start.ps1` を使うか、手動で以下を実行してから起動してください。

```powershell
# ポート8000を占有しているプロセスを終了
Get-Process python*, uvicorn* -ErrorAction SilentlyContinue | Stop-Process -Force

# 特定のPIDを終了する場合
netstat -ano | findstr ":8000"
Stop-Process -Id <PID> -Force
```

## ロードマップ

- [x] Phase 1: 基盤構築（React + FastAPI + チャンピオン一覧）
- [x] Phase 2: Web MVP（サモナー検索・戦績・AdSense）
- [x] Phase 3: Web強化（ビルド推奨・SEO・プレミアム設計）
- [x] Phase 4: Desktopアプリ（Electron + LCU API）
- [ ] Phase 5: 収益最大化（AIコーチング・Stripe・直配布）

## ライセンス

このプロジェクトはRiot Games APIを使用しています。
force.ggはRiot Gamesが承認・後援するものではなく、Riot GamesまたはLeague of Legendsの制作・管理に公式に関与している者のものでもありません。
League of Legends及びRiot GamesはRiot Games, Inc.の商標または登録商標です。
