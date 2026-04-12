---
name: Phase 4 レビュー所見
description: Phase 4実装（認証/Stripe/Electron）のレビューで発見した問題パターンと確認済み良い実装
type: project
---

## 発見した問題（要次回再チェック）

### 致命的レベル

1. **jwt_secret_key のデフォルト値がハードコード（config.py 38行目）**
   - `"change-this-secret-key-in-production"` という弱いデフォルト値
   - `riot_api_key` の `RGAPI-dummy-key` と同様の問題（Phase 2から継続）
   - 本番環境で環境変数を設定し忘れると JWT が偽造可能になる
   - `field_validator` による起動時チェックが追加されていない
   - **次回: 起動時バリデーターの追加確認**

2. **リフレッシュトークンをフロントから送れない設計（api/auth.ts 84行目）**
   - `refreshToken()` が `/api/auth/refresh` に POST しているが、リフレッシュトークンをボディに含めていない
   - バックエンドの `RefreshRequest` は `refresh_token: str` を必須フィールドとして受け取る
   - `AuthContext.tsx` の自動リフレッシュロジックが実際には機能しない（リクエストが 422 になる）
   - **次回: リフレッシュトークンの送信・受信実装が修正されているか確認**

3. **アクセストークン有効期限が30日（auth_service.py 140行目）**
   - `jwt_access_token_expire_days = 30` はアクセストークンとしては長すぎる
   - 通常のベストプラクティスは15分〜1時間。リフレッシュトークン（90日）との使い分けが機能していない
   - アクセストークンが漏洩した場合に30日間有効なまま
   - **次回: アクセストークンを短期（例: 15分）に変更されているか確認**

### 警告レベル

4. **setWindowOpenHandler の http:// も openExternal に渡している（index.ts 96行目）**
   - `http://` から始まるURLもそのまま外部ブラウザで開いている
   - 中間者攻撃でHTTPにダウングレードされたURLを外部で開く可能性がある
   - **次回: `https://` のみに限定されているか確認**

5. **`on` イベントの登録後にクリーンアップ関数がない（preload/index.ts 111行目）**
   - `ipcRenderer.on(channel, ...)` で登録したリスナーが `off()` で `removeAllListeners(channel)` を呼んでいる
   - `removeAllListeners` は特定コールバックではなく全リスナーを削除するため、複数の購読者がいると問題になる
   - 本番では `ipcRenderer.removeListener(channel, specificCallback)` が推奨される
   - **次回: 修正されているか確認**

6. **`err: any` の使用（LoginPage.tsx 51行目、RegisterPage.tsx 76行目）**
   - `catch (err: any)` を使用しており、`any` 型が混入している
   - プロジェクト慣習の `(error as { status?: number })?.status` パターンに統一すべき
   - **次回: 型ガード化されているか確認**

7. **OAuth state の有効期限なし（auth_service.py 39行目）**
   - `_oauth_states: set[str]` にTTLがなく、使われなかったstateが永続的に蓄積する
   - 本番Redisに移行時はEXPIREを設定すること（CSRF対策の観点でも重要）
   - **次回: Redis移行時にTTLが設定されているか確認**

8. **Phase 2・3の未修正問題が継続中**
   - `riot_api_key` の `RGAPI-dummy-key` デフォルト値（config.py 18行目）
   - `asyncio.gather(return_exceptions=True)` 未変更（services/match.py）
   - `win_rate @property` シリアライズ問題（summoner.py）
   - `puuid` バリデーション未追加（match.py router）
   - **次回: Phase 5開始前に解消確認必須**

## 確認済みの良い実装（次回も維持確認）

- Electron: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` 全て設定済み
- Electron preload: ALLOWED_CHANNELS 許可リストでチャンネル名を管理
- Electron preload: contextBridge.exposeInMainWorld で Node.js直アクセス不可
- Stripe: `stripe.Webhook.construct_event` による署名検証を実装済み（stripe_service.py 184行目）
- Stripe: `STRIPE_WEBHOOK_SECRET` 未設定時は 503 を返す（強制チェック）
- Stripe: 課金状態チェックがサーバーサイド（get_current_user Depends）で実施
- 認証: bcrypt ハッシュ（passlib）で正しくパスワード保管
- 認証: タイミング攻撃対策のダミーハッシュ検証実装（auth_service.py 116行目）
- 認証: OAuth stateパラメータによるCSRF対策（_validate_and_consume_state）
- 認証: フロント側でOAuthコールバックをuseRef(calledRef)でStrictMode二重実行防止
- 認証: `get_current_user` / `get_optional_user` の依存性注入パターン
- PremiumPage: React Query v5 useQuery/useMutation 使用、staleTime設定済み
- LCU: rejectUnauthorized: false を localhost専用エージェントで限定（適切な自己署名証明書対応）
- LCU: execSync の timeout 設定（5000ms）でハング防止
- UserMenu: useEffect クリーンアップ関数あり（mousedown イベント解除）
- OAuthCallback: エラーパラメータ検出・ユーザーフレンドリーなエラーメッセージ

**Why:** Phase 4完了時点（2026-04-12）のコードベース確認
**How to apply:** Phase 5レビュー時に未修正問題から再チェックを開始する
