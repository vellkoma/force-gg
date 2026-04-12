---
name: Phase 2 レビュー所見
description: Phase 2実装（summoner/match）のレビューで発見した問題パターンと確認済み良い実装
type: project
---

## 発見した問題（要次回再チェック）

### 未修正の可能性がある問題

1. **game_end_timestamp の単位不整合**
   - `backend/app/models/match.py` 49行目: コメントで「UNIXミリ秒」と記載
   - `web/src/components/summoner/MatchCard.tsx` 66行目: `* 1000` を掛けており二重変換の可能性
   - Riot API の `gameEndTimestamp` はミリ秒 → フロントの `* 1000` は不要な可能性が高い
   - **次回: 日付表示が正しいか実動作確認を促す**

2. **asyncio.gather のエラー伝播**
   - `backend/app/services/match.py` 152行目: `return_exceptions=False`（デフォルト）
   - 20件中1件の失敗で全体が壊れる
   - **次回: `return_exceptions=True` に変更されているか確認**

3. **win_rate のシリアライズ不整合**
   - `backend/app/models/summoner.py`: `RankedEntry.win_rate` が `@property` で定義
   - Pydantic v2 は `@property` をシリアライズしないため、APIレスポンスに `win_rate` フィールドは含まれない
   - `web/src/types/summoner.ts` 24行目: `win_rate: number` と定義しているが実際は来ない
   - `SummonerProfile.tsx` 17行目: `entry.win_rate != null` でフォールバック計算しているため実害はない
   - **次回: どちらかに統一されているか確認**

4. **PUUID パスバリデーション欠如**
   - `backend/app/routers/match.py`: `puuid` パスパラメータにバリデーションなし
   - `summoner.py` の `game_name`/`tag_line` には pattern 検証がある（一貫性がない）
   - **次回: UUID v4 形式のバリデーションが追加されているか確認**

5. **riot_api_key のデフォルト値**
   - `backend/app/core/config.py` 18行目: `"RGAPI-dummy-key"` というデフォルト値
   - 起動時バリデーター（`field_validator`）で空文字チェックを追加することを提案
   - **次回: バリデーターが追加されているか確認**

## 確認済みの良い実装（次回も維持確認）

- Account v1 → Summoner v4（by-puuid）の正しいフロー（summonerName不使用）
- JP1（summoner/ranked）/ ASIA（account/match）リージョン正しく使い分け
- 429ハンドリング: Retry-After + asyncio.sleep + 最大3回リトライ
- RedisキャッシュTTL: summoner=600s, match_list=3600s, match_detail=86400s（仕様通り）
- Redisフォールバック（InMemoryCache）の実装
- asyncio.gather による並列マッチ取得（N+1回避）
- キャッシュから my_stats（puuid依存）を除外して保存する設計
- React Query v5 + staleTime 設定（useSummoner.ts）
- encodeURIComponent によるURL安全なAPI呼び出し
- SummonerSearchBar の lastIndexOf('#') による正確な分割

**Why:** Phase 2完了時点（2026-04-10）のコードベース確認
**How to apply:** Phase 3レビュー時に未修正問題から再チェックを開始する
