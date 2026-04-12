# Phase 4: Desktop開発 実装サマリー

**実装日**: 2026-04-12
**ステータス**: 完了（本番キー設定待ち）

---

## 実装内容

### 1. ユーザー認証（Google + Discord + メール/パスワード）

#### バックエンド
| ファイル | 内容 |
|---------|------|
| `backend/app/models/user.py` | UserRecord / UserCreate / UserLogin / UserResponse / TokenResponse |
| `backend/app/services/auth_service.py` | JWT生成・検証、bcryptハッシュ化、OAuth 2.0フロー、インメモリDB |
| `backend/app/routers/auth.py` | 8エンドポイント（登録・ログイン・OAuth・リフレッシュ等） |
| `backend/app/deps.py` | `get_current_user` / `get_optional_user` 依存性追加 |
| `backend/app/core/config.py` | JWT設定、OAuth設定追加、JWTシークレットバリデーター追加 |

#### フロントエンド
| ファイル | 内容 |
|---------|------|
| `web/src/types/auth.ts` | User / AuthState / LoginResponse（refresh_token含む）|
| `web/src/api/auth.ts` | 7つのAPI関数 |
| `web/src/contexts/AuthContext.tsx` | AuthProvider、useAuth、自動リフレッシュ（14分間隔）|
| `web/src/components/auth/ProtectedRoute.tsx` | 未認証リダイレクト |
| `web/src/components/auth/OAuthCallback.tsx` | OAuthコールバック処理（二重実行防止） |
| `web/src/components/auth/UserMenu.tsx` | ヘッダーユーザーメニュー |
| `web/src/pages/LoginPage.tsx` | ログインページ（Google/Discord/メール） |
| `web/src/pages/RegisterPage.tsx` | 新規登録ページ |

#### アーキテクチャ
- アクセストークン: **15分**有効（JWTアクセストークン）
- リフレッシュトークン: **90日**有効（sessionStorage保存）
- 自動リフレッシュ: **14分**ごとに更新
- OAuth CSRF対策: stateパラメーター検証

---

### 2. Stripe 課金（¥980/月、¥9,800/年）

#### バックエンド
| ファイル | 内容 |
|---------|------|
| `backend/app/services/stripe_service.py` | カスタマー作成、チェックアウト、Webhook処理 |
| `backend/app/routers/stripe.py` | 5エンドポイント（チェックアウト・Webhook・ポータル等） |

#### フロントエンド
| ファイル | 内容 |
|---------|------|
| `web/src/types/stripe.ts` | SubscriptionInfo等の型定義 |
| `web/src/api/stripe.ts` | 4つのAPI関数 |
| `web/src/pages/PremiumPage.tsx` | 料金カード、状態別CTA |
| `web/src/pages/PremiumSuccessPage.tsx` | 決済完了ページ `/premium/success` |
| `web/src/pages/PremiumCancelPage.tsx` | キャンセルページ `/premium/cancel` |

#### 重要事項
- テスト環境で実装済み、本番キーは後から `.env` に設定
- Webhook署名検証必須（`stripe.Webhook.construct_event`）
- テストカード: `4242 4242 4242 4242`
- ローカルWebhookテスト: `stripe listen --forward-to localhost:8000/api/stripe/webhook`

---

### 3. Electron デスクトップアプリ（Windows x64/arm64）

#### ファイル構成
```
desktop/
├── package.json                    # Electron 28 + electron-vite + electron-builder
├── electron.vite.config.ts         # main/preload/renderer 3プロセスビルド設定
├── electron-builder.yml            # Windows x64/arm64 NSIS日本語インストーラー
├── tsconfig.json                   # Node.js + ブラウザ環境分離
├── src/
│   ├── main/
│   │   ├── index.ts                # BrowserWindow（1280×720）、ウィンドウ状態保存
│   │   ├── lcu.ts                  # LCU API クライアント（wmic でポート/トークン取得）
│   │   ├── ipc.ts                  # IPCハンドラー全登録
│   │   ├── overlay.ts              # 透明フレームなし常時最前面ウィンドウ
│   │   └── db.ts                   # SQLite（better-sqlite3）設定・お気に入り・キャッシュ
│   ├── preload/
│   │   ├── index.ts                # contextBridge（許可リスト制限付き）
│   │   └── index.d.ts              # window.electronAPI 型定義
│   ├── types/
│   │   └── lcu.ts                  # ChampSelectSession / LcuSummoner 等
│   └── renderer/src/
│       ├── hooks/useLcu.ts         # LCU状態管理（3秒ポーリング）
│       ├── pages/DesktopHomePage.tsx # 接続状態・サモナー情報・ゲームフロー
│       └── pages/OverlayPage.tsx   # チャンピオン選択オーバーレイ（透明）
```

#### セキュリティ設定（全ウィンドウ）
- `contextIsolation: true` ✓
- `nodeIntegration: false` ✓
- `sandbox: true` ✓
- `webSecurity: true` ✓
- CSP で外部スクリプト禁止 ✓

#### LCU API 仕様
- Windows の `wmic` コマンドで `LeagueClientUx.exe` のポート/トークンを取得
- `https://127.0.0.1:{port}` に Basic認証でアクセス
- 自己署名証明書を許可（localhost専用のhttps.Agentで隔離）

---

## 本番稼働前のチェックリスト

### 環境変数設定（`.env`）
```
JWT_SECRET_KEY=<openssl rand -hex 32 の出力>

GOOGLE_CLIENT_ID=<Google Cloud Console で取得>
GOOGLE_CLIENT_SECRET=<同上>

DISCORD_CLIENT_ID=<Discord Developer Portal で取得>
DISCORD_CLIENT_SECRET=<同上>

STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_MONTHLY_PRICE_ID=price_...
STRIPE_YEARLY_PRICE_ID=price_...
```

### OAuth リダイレクトURI登録
- **Google**: `https://your-domain.com/oauth/callback`
- **Discord**: `https://your-domain.com/oauth/callback`

### Stripe 設定
1. Stripeダッシュボードで商品作成（¥980/月、¥9,800/年）
2. Webhookエンドポイント登録（`/api/stripe/webhook`）
3. `checkout.session.completed`, `customer.subscription.deleted`, `invoice.payment_failed` を有効化

---

## コードレビュー指摘事項（修正済み）

- ✅ JWT シークレットキーのデフォルト値 → 起動時バリデーター追加
- ✅ アクセストークン30日 → 15分に短縮
- ✅ リフレッシュトークン未送信 → sessionStorage保存・送信対応
- ✅ 自動リフレッシュ間隔を15分→14分に調整（期限切れ前に更新）

## コードレビュー指摘事項（次フェーズで対応）

- 🟡 `shell.openExternal` の URL を `https://` のみに限定
- 🟡 OAuth state の有効期限管理（Redis移行時に TTL 設定）
- 🟡 `removeAllListeners` を `removeListener(fn)` パターンに変更
- 🟡 Phase 2-3 からの未修正問題（config.py の riot_api_key デフォルト値等）
