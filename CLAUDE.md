# LoL Web & Desktop App — Claude Code Project Memory

## プロジェクト概要

**force.gg** — LoLプレイヤー向けWebアプリ＆Electronデスクトップアプリ。
**差別化ポイント**: AI coaching（Claude API）× 戦績統計を組み合わせたサービス。

## 収益化ロードマップ

```
Phase 1-2: Google AdSense（Web広告）
Phase 3:   プレミアム会員設計（Stripe準備）
Phase 4-5: Web + Desktop サブスクリプション（月額 ¥980）
```

---

## 技術スタック

### Web
| 分類 | ライブラリ | 用途 |
|------|-----------|------|
| Frontend | React 18 + Vite | UIフレームワーク |
| Frontend | TailwindCSS | スタイリング |
| Frontend | Recharts | グラフ・統計表示 |
| Frontend | React Query v5 | APIキャッシュ・フェッチ |
| Frontend | React Router v6 | ルーティング |
| Backend | FastAPI (Python 3.11+) | APIサーバー |
| Backend | Pydantic v2 | バリデーション |
| Backend | Redis | キャッシュ・レート制限 |
| Backend | PostgreSQL | ユーザーデータ |
| Auth/課金 | Auth.js v5 | 認証 |
| Auth/課金 | Stripe | サブスクリプション |
| Deploy | Vercel | フロントエンド |
| Deploy | Railway | バックエンド |
| 外部API | Riot Games API | ゲームデータ |
| 外部API | Google AdSense | 広告収益 |

### Desktop（Phase 4以降）
| 分類 | ライブラリ | 用途 |
|------|-----------|------|
| Framework | Electron 28+ | デスクトップアプリ |
| UI | React 18（Web共通） | レンダラー |
| 配布 | electron-builder | .exeビルド |
| 更新 | electron-updater | 自動アップデート |
| ゲーム連携 | LCU API | LoLクライアント内部API |
| ローカルDB | SQLite (better-sqlite3) | オフライン保存 |
| AI | Claude API (Sonnet) | AIコーチング |

---

## ディレクトリ構成

```
lol-app/
├── web/                        # React + Vite フロントエンド
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/             # 汎用UIパーツ（Button, Card等）
│   │   │   ├── champions/      # チャンピオン関連
│   │   │   ├── summoner/       # サモナー関連
│   │   │   └── ads/            # AdSenseコンポーネント
│   │   ├── pages/              # ルートに対応するページ
│   │   ├── hooks/              # カスタムフック（useXxx）
│   │   ├── api/                # APIクライアント関数
│   │   ├── types/              # TypeScript型定義
│   │   └── utils/
│   ├── public/
│   └── vite.config.ts
├── backend/                    # FastAPI バックエンド
│   ├── app/
│   │   ├── routers/            # エンドポイント（summoner, match, champion）
│   │   ├── services/           # ビジネスロジック
│   │   ├── models/             # Pydanticモデル
│   │   ├── cache/              # Redis キャッシュ層
│   │   └── deps.py             # 依存性注入
│   ├── tests/
│   └── main.py
├── desktop/                    # Electron（Phase 4〜）
│   ├── main/                   # メインプロセス
│   ├── preload/                # contextBridge
│   └── renderer/               # レンダラー（Web流用）
├── shared/                     # 型・ユーティリティ共通
└── docs/                       # 設計ドキュメント
    ├── YYYY-MM-DD/
    │   ├── tasks/
    │   ├── specs/
    │   └── design/
```

---

## Riot Games API ルール（必須）

```python
# リージョン
JP1_BASE  = "https://jp1.api.riotgames.com"   # Summoner/Ranked/Champion
ASIA_BASE = "https://asia.api.riotgames.com"   # Match v5

# レート制限
DEV_KEY_LIMIT  = (20, 1)    # 20 req / 1sec
DEV_KEY_LIMIT2 = (100, 120) # 100 req / 2min

# キャッシュTTL（Redis）
CACHE_TTL = {
    "summoner":      600,    # 10分
    "match_list":    3600,   # 1時間
    "match_detail":  86400,  # 24時間
    "champion_stats":3600,   # 1時間
    "ranked_stats":  300,    # 5分
}
```

- **PUUID必須**: summonerNameは非推奨、必ずPUUIDベースで実装
- **429ハンドリング**: `Retry-After` ヘッダーを読んで再試行
- **matchId形式**: `JP1_` プレフィックス付き

---

## コーディング規約

### Python (FastAPI)
- `async/await` 徹底（`httpx.AsyncClient` 使用）
- 型ヒント必須（Pydantic v2モデル）
- エラーは `HTTPException` で統一、メッセージは日本語
- 環境変数は `python-dotenv` + `pydantic-settings` で管理

### TypeScript / React
- 関数コンポーネントのみ（classコンポーネント禁止）
- カスタムフックでAPIロジック分離（`hooks/use*.ts`）
- TailwindCSS でスタイリング（インラインスタイル原則禁止）
- React Query v5 で全API呼び出しをラップ
- コンポーネント1ファイル200行以内

### 共通
- コメントは日本語OK
- コミット: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`
- 環境変数: `.env` / `.env.example` で管理
- テストは `tests/` に配置（mirroringディレクトリ構成）

---

## Sub-Agent ルーティングルール

### 並列実行（ALL条件を満たす場合）
- タスク間に依存関係がない
- 異なるファイルを操作する
- 3つ以上の独立したドメイン

**並列例**:
- フロントエンドUI + バックエンドAPIエンドポイントの同時実装
- 複数ページの同時実装
- テスト作成 + ドキュメント更新

### 順次実行（ANY条件が当てはまる場合）
- タスク間に依存関係がある（Bの実装にAの出力が必要）
- 同じファイルを複数タスクが操作する
- スコープが不明確

**順次例**:
- DB設計 → モデル定義 → API → フロントエンド
- Riot API仕様確認 → キャッシュ設計 → 実装

### メインコンテキスト（サブエージェント不要）
- バグ修正（小規模）
- 設計相談・壁打ち
- コードの小さな修正（10行以内）

---

## フェーズ状況（完了したらチェック）

- [x] **Phase 1: 基盤構築**（Month 1–2）← 完了
  - [x] Riot Games API キー取得・申請
  - [x] React + Vite プロジェクト初期化
  - [x] FastAPI バックエンド構築
  - [x] チャンピオン一覧ページ実装
- [x] **Phase 2: Web MVP**（Month 3–4）← 完了
  - [x] サモナー検索・戦績表示
  - [x] チャンピオン統計・勝率表示
  - [x] Google AdSense 導入（全ページ配置・遅延ロード対応）
  - [x] Vercel / Netlify デプロイ
- [x] **Phase 3: Web強化**（Month 5–6）
  - [x] ビルド推奨機能実装
  - [x] ランク別メタ分析ページ
  - [x] SEO最適化
  - [x] プレミアム会員機能設計
- [x] **Phase 4: Desktop開発**（Month 7–9）← 完了
  - [x] 課金機能実装 (Stripe テスト環境・本番キー設定待ち)
  - [x] ユーザー認証 (Google + Discord + メール/パスワード)
  - [x] Electron + React 環境構築 (Windows x64/arm64)
  - [x] LCU API連携
  - [x] チャンピオン選択画面オーバーレイ
  - [x] リアルタイム統計表示
- [ ] **Phase 5: 収益最大化**（Month 10–12）
  - [x] Web × Desktop アカウント連携
  - [x] 有料プラン拡充（プレミアム機能ゲート・特典リスト更新）
  - [ ] AI コーチング機能 (Claude API) ← ANTHROPIC_API_KEY 取得後に実装
  - [x] 自動アップデート機能（UpdateBanner・download/install IPC）
  - [ ] Windows Store / 直配布
