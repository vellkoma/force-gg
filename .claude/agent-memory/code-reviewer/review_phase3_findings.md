---
name: Phase 3 レビュー所見
description: Phase 3実装（build/champion/meta/premium）のレビューで発見した問題パターンと確認済み良い実装
type: project
---

## 発見した問題（要次回再チェック）

### 警告レベル

1. **assignTier の擬似ロジック（MetaPage.tsx 28行目）**
   - `champion.key % 4` でティア決定しているため実際の強さと無関係
   - 警告バナーで利用者への欺きは防いでいるがブランド・SEOリスクあり
   - **次回: 実ランクデータ連携 or 固定キュレーションリストへの切り替え確認**

2. **asyncio のローカルインポート（champion.py 336行目）**
   - `get_champion_builds` 内で `import asyncio as _asyncio` をローカル実行
   - 標準ライブラリはファイル先頭でインポートする規約
   - **次回: ファイル先頭に移動されているか確認**

3. **RoleDistributionChart のインラインスタイル（RoleDistributionChart.tsx 39-45行目）**
   - Recharts の contentStyle に色値をハードコード（デザイントークンと二重管理）
   - **次回: CSS カスタムプロパティ化 or 定数ファイル切り出しが行われているか確認**

4. **Phase 2 未修正問題が継続中（確認対象外ファイル）**
   - `win_rate @property` シリアライズ問題（summoner.py）
   - `puuid` バリデーション未追加（match.py router）
   - `RGAPI-dummy-key` デフォルト値（config.py）
   - `asyncio.gather(return_exceptions=True)` 未変更（services/match.py）
   - **次回: Phase 4 開始前に解消確認必須**

### 軽微レベル

5. **OGP画像（og:image / twitter:image）未設定（index.html）**
   - SNSシェア時にサムネイルなし
   - **次回: ogp.png 追加と meta タグ設定がされているか確認**

6. **sitemap.xml に lastmod なし**
   - クロール頻度の最適化機会を逃している
   - **次回: 追加されているか確認**

## 確認済みの良い実装（次回も維持確認）

- `_strip_html` で HTMLタグ除去してから Pydantic モデルに渡す（XSSリスクなし）
- `Path(pattern=_CHAMPION_ID_PATTERN)` による入力バリデーション（router層）
- `asyncio.gather` でアイテム・ルーンを並行取得（N+1回避）
- ビルドキャッシュ TTL = 86400s（Data Dragon パッチサイクルに合致）
- MetaPage: スケルトン・エラー・フォールバック全て実装
- TierSection: `loading="lazy"` 設定済み
- PremiumPage: 未実装課金ボタンを `disabled` で明示
- `robots.txt` にサイトマップURL明示
- `index.html` に `lang="ja"` 設定済み
- `Noto Sans JP` + `Rajdhani` フォント適用済み

**Why:** Phase 3完了時点（2026-04-12）のコードベース確認
**How to apply:** Phase 4レビュー時に未修正問題から再チェックを開始する
