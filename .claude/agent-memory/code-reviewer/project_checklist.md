---
name: プロジェクト固有チェックリスト
description: このLoLプロジェクトで毎回レビューで確認すべき設計上の決定事項と慣習
type: project
---

## Riot API 設計ルール（プロジェクト確定事項）

- PUUID 必須: `summonerName` は非推奨。Account v1 → by-puuid フローが正しい
- JP1: Summoner v4 / League v4（`jp1.api.riotgames.com`）
- ASIA: Account v1 / Match v5（`asia.api.riotgames.com`）
- matchId形式: `JP1_XXXXXXXXXX` プレフィックス付き（Match v5 から返される値をそのまま使う）
- 429ハンドリング: `Retry-After` ヘッダー読み取り必須

## キャッシュTTL（確定値）

| キー | TTL |
|------|-----|
| summoner | 600秒（10分） |
| match_list | 3600秒（1時間） |
| match_detail | 86400秒（24時間） |
| ranked_stats | 300秒（5分）|

## Data Dragon バージョン管理

- `SummonerProfile.tsx` と `MatchCard.tsx` に `DDRAGON_VERSION = '15.7.1'` がハードコードされている
- パッチ更新時に2ファイルを手動更新する必要がある
- **将来改善候補**: バックエンドの `/api/ddragon/version` エンドポイントから動的取得

## アーキテクチャ決定事項

- `RiotClient`: 低レベルHTTPクライアント（エラーハンドリング・リトライ）
- `SummonerService` / `MatchService`: ビジネスロジック + Redisキャッシュ
- `deps.py`: FastAPI依存性注入でサービスを提供
- `InMemoryCache`: Redis未接続時のフォールバック（開発環境での動作保証）
- Pydantic `@property` はシリアライズされない → `model_computed_field` を使うこと

## フロントエンド慣習

- React Query v5: `useQuery` / `useMutation`（`useQueryClient` でキャッシュ操作）
- クエリキー: `summonerKeys` オブジェクトで一元管理（`hooks/useSummoner.ts`）
- エラー型: `(error as { status?: number })?.status` パターンを使用（型ガード関数への統一を検討）
- URLエンコード: `encodeURIComponent` / `decodeURIComponent` をpage層で実施

**Why:** Phase 2レビュー時に確認・記録（2026-04-10）
**How to apply:** Phase 3以降のレビューで、変更・追加されたファイルに対してこのチェックリストを適用する
