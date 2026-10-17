# force.gg — プロジェクト構成

## ルートレイアウト

```
force-gg/
├── backend/        # FastAPI Python バックエンド
├── web/            # React + Vite Web フロントエンド
├── desktop/        # Electron デスクトップアプリ
├── docs/           # 設計ドキュメント（YYYY-MM-DD/ 形式）
├── .github/        # GitHub Actions（Esports データ日次更新）
├── .kiro/          # Kiro ステアリングルール
└── .claude/        # Claude エージェント設定・メモリ
```

---

## バックエンド（`backend/`）

```
backend/
├── app/
│   ├── core/
│   │   ├── config.py       # pydantic-settings; シングルトン `settings` オブジェクト
│   │   └── database.py     # PostgreSQL 初期化/クローズ（asyncpg）
│   ├── cache/
│   │   └── redis.py        # CacheClient — Redis + インメモリフォールバック
│   ├── routers/            # ドメインごとに 1 ファイル（summoner, match, champion, auth, coaching, esports, stripe）
│   ├── services/           # ビジネスロジック。ドメインごとに 1 クラス
│   ├── models/             # Pydantic v2 リクエスト/レスポンスモデル
│   └── deps.py             # FastAPI 依存性注入（get_*_service）
├── tests/                  # app/ と同じディレクトリ構成でミラーリング
├── main.py                 # アプリエントリーポイント: lifespan、CORS、ルーター登録
├── requirements.txt
├── Dockerfile
└── start.ps1               # 推奨開発起動スクリプト
```

**規約:**
- ルーターは HTTP ルーティングのみ — ビジネスロジックはサービスに書く
- サービスは `deps.py` 経由で依存（RiotClient、CacheClient）をインジェクション
- 各サービスファイルにモジュールレベルのキャッシュキー定数を定義（例: `CACHE_KEY_SUMMONER = "summoner:{game_name}#{tag_line}"`）
- ルーターファイルはモジュールドキュメント文字列でエンドポイント一覧を冒頭に記載

---

## Web フロントエンド（`web/`）

```
web/src/
├── api/
│   ├── client.ts           # 共通 axios インスタンス（認証・エラーインターセプター付き）
│   └── *.ts                # ドメイン別 API 関数（summoner.ts, champions.ts など）
├── components/
│   ├── ui/                 # 汎用 UI コンポーネント（Button, Card, LoadingSpinner など）
│   ├── champions/          # チャンピオンドメインのコンポーネント
│   ├── summoner/           # サモナードメインのコンポーネント
│   ├── esports/            # Esports スケジュールのコンポーネント
│   ├── coaching/           # AI コーチングのコンポーネント
│   ├── auth/               # 認証 UI（ProtectedRoute, UserMenu, OAuthCallback）
│   ├── meta/               # メタ/ティア分析のコンポーネント
│   ├── search/             # 検索バーのコンポーネント
│   └── ads/                # AdSense コンポーネント
├── hooks/                  # React Query カスタムフック（useChampions, useSummoner など）
├── pages/                  # ルートごとに 1 ファイル（ChampionsPage, SummonerPage など）
├── contexts/               # React コンテキストプロバイダー（AuthContext）
├── types/                  # ドメイン別 TypeScript インターフェース
├── utils/                  # 純粋なユーティリティ関数
└── App.tsx                 # ルート定義
```

**規約:**
- `api/*.ts` — フェッチ関数のみ、React を含めない
- `hooks/use*.ts` — API 呼び出しを React Query でラップ、クエリキーファクトリーもここに定義
- `pages/` — コンポーネントの組み合わせのみ、ロジックは最小限
- `components/ui/` — 汎用・ドメイン非依存のものだけ配置
- `types/` — バックエンドのモデル名に合わせてドメインごとに 1 ファイル

---

## デスクトップ（`desktop/src/`）

```
desktop/src/
├── main/
│   ├── index.ts            # Electron メインプロセスエントリー
│   ├── ipc.ts              # IPC ハンドラー登録
│   ├── lcu.ts              # LCU（League Client Update）API クライアント
│   ├── overlay.ts          # チャンピオン選択オーバーレイウィンドウ管理
│   └── db.ts               # better-sqlite3 ローカルデータベース
├── preload/
│   └── index.ts            # contextBridge — レンダラーへの安全な IPC API 公開
├── renderer/src/
│   ├── components/         # デスクトップ固有の UI コンポーネント
│   ├── context/            # デスクトップ状態の React コンテキスト
│   ├── hooks/              # デスクトップ固有のフック
│   ├── layouts/            # アプリシェル / レイアウトコンポーネント
│   ├── pages/              # デスクトップのページコンポーネント
│   └── utils/              # デスクトップのユーティリティ
└── types/
    └── lcu.ts              # LCU API の TypeScript 型定義
```

**規約:**
- メインプロセスとレンダラーは IPC のみで通信 — レンダラーからメインのコードを直接 import しない
- 全 IPC チャンネルは `ipc.ts` で定義・登録
- `preload/index.ts` はメインとレンダラーの唯一の橋渡し — 最小限に保つ
- レンダラーの構造はコード共有のため可能な限り `web/src/` と合わせる

---

## ドキュメント（`docs/`）

```
docs/
├── YYYY-MM-DD/             # 日付別の設計セッション
│   ├── tasks/
│   ├── specs/
│   └── design/
└── Riot Match v5 API.md    # Riot API リファレンスメモ
```
