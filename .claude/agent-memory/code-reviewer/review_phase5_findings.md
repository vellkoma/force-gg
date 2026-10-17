---
name: Phase 5 レビュー所見
description: Phase 5実装（AIコーチング/自動アップデート/アカウント連携）のレビューで発見した問題と確認済みの良い実装
type: project
---

## 発見した問題（要次回再チェック）

### 致命的レベル

1. **Railway本番URLがAccountPage.tsxにハードコード（10行目）**
   - `const API_BASE = 'https://my-lol-app-production.up.railway.app'` が直接埋め込まれている
   - Electronビルド成果物（.exe）内に本番URLが固定されてしまう
   - 将来のホスト変更時に再ビルド必須になる
   - 環境変数（`import.meta.env.VITE_API_BASE_URL` 等）で外部化すべき
   - **次回: 環境変数化されているか確認**

2. **プレミアム判定がフロントエンド側のローカル値のみ（AccountPage.tsx 86行目）**
   - `setIsPremium(false) // 将来: APIから取得` のコメントのまま未実装
   - ローカルに保存した `auth_is_premium` フラグを信頼しており、サーバーサイド検証がない
   - ログイン後にプレミアム状態を再取得するAPIコール（`/api/auth/me` 等）が未実装
   - **次回: サーバーサイド検証の追加確認**

3. **コーチングエンドポイントに認証チェックなし（coaching.py 106-107行目）**
   - `description` に「認証不要ですが、プレミアム機能ゲートはフロントエンド側で制御してください」と明記されている
   - バックエンドで認証・プレミアムチェックをしていないため、APIを直接呼べば誰でもコーチングを利用できる
   - `Depends(get_current_user)` または `Depends(require_premium_user)` を追加すべき
   - **次回: バックエンドで認証ガードが追加されているか確認**

### 警告レベル

4. **`removeAllListeners` の問題が継続（preload/index.ts 129行目）**
   - Phase 4から指摘継続。`off()` が `ipcRenderer.removeAllListeners(channel)` を使用
   - 複数コンポーネントが同チャンネルを購読している場合、一方の `off()` で全リスナーが消える
   - `useUpdater.ts` のクリーンアップ（84-90行目）は正しく `off()` を呼んでいるが根本問題は未解決
   - 修正案: コールバックを参照として保持し `ipcRenderer.removeListener(channel, cb)` を使う
   - **次回: 修正されているか確認**

5. **DDragon バージョンが `14.1.1` にハードコード（DesktopHomePage.tsx 141, 180行目）**
   - `https://ddragon.leagueoflegends.com/cdn/14.1.1/img/...` が2箇所でハードコード
   - Webフロント側（SummonerProfile.tsx等）の `15.7.1` とも不一致でパッチ周回毎に手動更新が必要
   - バックエンドの `/api/ddragon/version` 等から動的取得すべき
   - **次回: バージョン動的取得、またはWebと同一定数化されているか確認**

6. **チャンピオン画像URLが championId（数値）のまま（DesktopHomePage.tsx 180行目）**
   - `cdn/14.1.1/img/champion/${player.championId}.png` → DDragonはIDではなくチャンピオン名でURLを構成する
   - 実際には `/cdn/14.1.1/img/champion/Jinx.png` が正しく、数値IDでは画像が404になる
   - LCU APIから得た championId をチャンピオン名にマッピングするロジックが必要
   - **次回: チャンピオンIDからname変換が実装されているか確認**

7. **Phase 4からの継続問題（未修正）**
   - `riot_api_key` の `RGAPI-dummy-key` デフォルト値（config.py 18行目）— 本番環境で漏洩リスク
   - リフレッシュトークンをボディに含めていない（api/auth.ts）
   - `asyncio.gather(return_exceptions=True)` 未変更（services/match.py）
   - `win_rate @property` シリアライズ問題（summoner.py）
   - `puuid` バリデーション未追加（match.py router）
   - OAuth state の TTL なし（auth_service.py）
   - **次回: Phase 5終了前に解消必須**

### 改善推奨レベル

8. **`_call_claude_api` が実装されておらず常にモック（coaching_service.py 161-204行目）**
   - `ANTHROPIC_API_KEY` が設定されていても実際のClaude API呼び出しは未実装
   - `_has_api_key` が `True` でも内部でモックを返している
   - TODO コメントとしては適切だが、Phase 5の主要機能として早期に実装が必要
   - **次回: Claude API の実際の呼び出しが実装されているか確認**

9. **Claude API レスポンスのJSONパース失敗ハンドリングが未考慮**
   - 実装時に `json.loads(raw)` の失敗（モデルが JSON 以外を返した場合）が未処理
   - `try/except json.JSONDecodeError` と再試行または適切なエラーメッセージが必要

10. **`recent_stats` が固定ダミー値（CoachingPage.tsx 25-30行目）**
    - `DEFAULT_STATS = { win_rate: 0.5, kda: 2.5, ... }` が常に送信される
    - サモナーページの実際のマッチデータとの連携が「将来予定」のまま
    - ユーザーへの説明がないため、コーチングが実データに基づいていないことが不明瞭

## 確認済みの良い実装（Phase 5）

- `CoachingRequest` の Pydantic v2 バリデーション: `role` 許可リスト・`recent_stats` サイズ制限が適切
- コーチングエンドポイント: 例外を握り潰さず `HTTPException(500)` で日本語エラーを返す
- `ANTHROPIC_API_KEY` 未設定時のフォールバック設計（モックで起動できる）
- `config.py`: `JWT_SECRET_KEY` の `field_validator` による本番環境強制チェックが追加済み（Phase 4問題解消）
- `config.py`: `jwt_access_token_expire_minutes: int = 15` に修正済み（Phase 4問題解消）
- `useCoachingMutation`: React Query v5 `useMutation` 使用、適切な分離
- `CoachingPage`: エラーステータス別の日本語メッセージ分岐
- `CoachingPanel`: `is_mock` フラグを使ったモックデータ警告バナーの表示
- `useUpdater.ts`: `useEffect` クリーンアップ関数でイベントリスナーを解除
- `UpdateBanner.tsx`: ダウンロード中/完了/利用可能の状態分岐が明確
- Electron preload: ALLOWED_CHANNELS 許可リストが維持されている（Phase 4から継続）
- `DesktopHomePage`: `gameflowPhase` 変化で自動オーバーレイ制御（`useEffect` 依存配列が正確）
- `AccountPage`: `catch {}` で例外を適切にキャッチし、ユーザーに日本語エラーを表示
- `PremiumPage`: `staleTime: 60_000` 設定済み、React Query v5 使用

**Why:** Phase 5完了時点（2026-04-13）のコードベース確認
**How to apply:** Phase 6レビュー時に未修正問題から再チェックを開始する
