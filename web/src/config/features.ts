/**
 * 機能フラグ
 *
 * 環境変数で機能の有効/無効を切り替える。
 * Vercel の環境変数を変更 → 再デプロイ で即座に反映される。
 */

/**
 * プレミアムプランの新規登録を受け付けるかどうか。
 *
 * false（休止中）のとき:
 *   - 料金カード・トライアルバナー・申し込みボタンを非表示
 *   - ヘッダーメニューの「プレミアムへアップグレード」を非表示
 *   - AI コーチングページのアップグレード導線を案内文に置き換え
 *   - 既存契約者の管理ポータル・解約は引き続き利用可能
 *
 * 再開する場合:
 *   1. Vercel 環境変数 VITE_PREMIUM_SIGNUP_ENABLED=true を設定
 *   2. Railway 環境変数 PREMIUM_SIGNUP_ENABLED=true を設定
 *   3. 両方を再デプロイ
 */
export const PREMIUM_SIGNUP_ENABLED =
  import.meta.env.VITE_PREMIUM_SIGNUP_ENABLED === 'true'
