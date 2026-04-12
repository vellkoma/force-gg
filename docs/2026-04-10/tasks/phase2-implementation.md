# Phase 2 実装サマリー — 2026-04-10

## 実装内容

### バックエンド（backend/）
- `app/services/riot_client.py` — Riot API共有クライアント（429リトライ、JP1/ASIA分岐）
- `app/services/summoner.py` — サモナープロフィール取得（TTL 600秒）
- `app/services/match.py` — マッチ履歴取得（asyncio.gather並列、TTL 3600/86400秒）
- `app/models/summoner.py` — AccountInfo / SummonerInfo / RankedEntry / SummonerProfile
- `app/models/match.py` — ParticipantStats / MatchInfo / MatchDetail / MatchListResponse
- `app/routers/summoner.py` — GET /api/summoner/{game_name}/{tag_line}（パスバリデーション付き）
- `app/routers/match.py` — GET /api/matches/{puuid}?count=20

### フロントエンド（web/src/）
- `types/summoner.ts` / `types/match.ts` — TypeScript型定義 + ラベルマップ
- `api/summoner.ts` — fetchSummonerProfile / fetchMatchHistory
- `hooks/useSummoner.ts` — useSummonerProfile / useMatchHistory（React Query v5）
- `components/summoner/SummonerSearchBar.tsx` — GameName#TAG形式検索
- `components/summoner/SummonerProfile.tsx` — アイコン・レベル・ランクカード
- `components/summoner/MatchCard.tsx` — 勝敗・KDA・アイテム・時間表示
- `components/ads/AdBanner.tsx` — AdSenseプレースホルダー（環境変数で切替）
- `pages/SummonerPage.tsx` — /summoner / /summoner/:gameName/:tagLine
- `App.tsx` 更新 — サモナールート追加
- `pages/HomePage.tsx` 更新 — ヒーローに検索バー追加

## 未完了（手動対応が必要）
- Vercel / Netlify デプロイ — アカウント設定が必要
- Google AdSense — サイト公開・審査通過後に VITE_ADSENSE_CLIENT_ID を設定

## 次フェーズ（Phase 3）
- ビルド推奨機能
- ランク別メタ分析ページ
- SEO最適化
- プレミアム会員機能設計
