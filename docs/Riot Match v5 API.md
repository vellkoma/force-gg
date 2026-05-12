# Riot Match v5 API — 取得可能データメモ

参照: https://developer.riotgames.com/apis#match-v5/GET_getMatch

---

## データ構造

```
Match（1試合）
├── metadata
│   ├── matchId          "JP1_580170649"
│   ├── gameVersion      "16.9.386.6510"
│   └── participants[]   PUUID一覧（10人）
│
└── info
    ├── 試合基本情報
    │   ├── gameDuration     秒数（例: 1823）
    │   ├── gameCreation     UNIXタイムスタンプ（ms）
    │   ├── gameMode         "CLASSIC"
    │   ├── queueId          420（ランク）/ 440（フレックス）
    │   └── gameVersion      パッチ番号
    │
    ├── participants[]（10人分）
    │   ├── 基本
    │   │   ├── championName     "Ahri"
    │   │   ├── championId       103
    │   │   ├── puuid
    │   │   ├── summonerName
    │   │   ├── teamId           100（Blue）/ 200（Red）
    │   │   ├── individualPosition "MIDDLE"
    │   │   └── win              true / false
    │   │
    │   ├── 戦績
    │   │   ├── kills / deaths / assists
    │   │   ├── kda              計算値
    │   │   ├── totalDamageDealtToChampions
    │   │   ├── totalDamageTaken
    │   │   ├── totalHeal
    │   │   ├── goldEarned
    │   │   ├── goldSpent
    │   │   ├── totalMinionsKilled
    │   │   └── neutralMinionsKilled
    │   │
    │   ├── アイテム
    │   │   └── item0 〜 item6   アイテムID（0=空）
    │   │
    │   ├── ルーン
    │   │   ├── perks.styles[0]  メインスタイル
    │   │   │   ├── style        キーストーンスタイルID
    │   │   │   └── selections[] 選択ルーンID × 4
    │   │   └── perks.styles[1]  サブスタイル
    │   │       └── selections[] 選択ルーンID × 2
    │   │
    │   ├── challenges（詳細KPI群）
    │   │   ├── soloKills
    │   │   ├── turretPlatesTaken
    │   │   ├── visionScore
    │   │   ├── controlWardsPlaced
    │   │   ├── epicMonsterSteals
    │   │   └── ...（100項目超）
    │   │
    │   └── スペル
    │       ├── summoner1Id      スペルID
    │       └── summoner2Id
    │
    └── teams[]（Blue / Red）
        ├── win              true / false
        ├── objectives
        │   ├── baron.kills
        │   ├── dragon.kills
        │   ├── tower.kills
        │   ├── inhibitor.kills
        │   └── riftHerald.kills
        └── bans[]
            ├── championId
            └── pickTurn
```

---

## force.gg での利用状況

### 現在使用中
| フィールド | 用途 |
|-----------|------|
| `championName`, `individualPosition`, `win` | ティアリスト集計（勝率・ピック率） |
| `item0〜item6` | アイテム統計 |
| `bans[].championId` | バン率集計 |
| `gameVersion` | パッチフィルタリング |
| `gameCreation` | パッチ期間キャッシュ |

### 未使用（実装候補）
| フィールド | 活用アイデア |
|-----------|------------|
| `kills / deaths / assists` | チャンピオン別平均KDA表示 |
| `totalDamageDealtToChampions` | ダメージ効率ランキング |
| `perks` | ルーン採用率統計 |
| `goldEarned`, `totalMinionsKilled` | CS・ゴールド効率分析 |
| `teams[].objectives` | バロン/ドラゴン獲得と勝率の相関 |
| `gameDuration` | 平均試合時間（チャンピオン別） |
| `visionScore` | ビジョン貢献度 |
| `challenges.soloKills` | ソロキル率 |

---

## キュー ID 一覧（主要）

| queueId | 種別 | API取得 |
|---------|------|--------|
| 420 | ランク（ソロ/デュオ） | ✅ |
| 440 | フレックス | ✅ |
| 450 | ARAM | ✅ |
| 400 | ノーマル（ドラフト） | ✅ |
| 1700 | Arena | ✅ |
| 1710 | Arena（新バリアント） | ✅ |
| 未定 | **ARAM: Mayhem** | ❌ 未対応 |

---

## ARAM: Mayhem の調査記録（2026-05-11）

### 調査方法
vellkoma#JP1（ほぼメイヘムのみプレイ）の PUUID で Match v5 API を叩き、
`count=100`・フィルタなしで全試合を取得。

### 結果
- 返ってきたマッチ数: **2件のみ**（どちらも通常 ARAM）
- メイヘムの試合はゼロ件 → **API から除外されている**

### フィールド確認
返ってきた ARAM 試合（gameVersion 16.5 / 15.24）のフィールド：

```
queueId           : 450        ← 通常 ARAM と同じ
gameMode          : ARAM
mapId             : 12
gameModeMutators  : ['mapskin_map12_bloom']   ← マップスキン識別子
playerAugment1〜6 : 0          ← オーグメントデータなし
playerSubteamId   : 0
subteamPlacement  : 0
```

`gameModeMutators` の `mapskin_map12_bloom` はマップスキンイベントの識別子であり、
メイヘム固有のものではなく通常 ARAM のスキンイベントにも使われる。

### 結論

```
queueId: 450  gameMode: ARAM
  ├── 通常 ARAM          → Match v5 API で取得可能 ✅
  ├── ARAM マップスキン  → 取得可能 ✅（gameModeMutators で識別）
  └── ARAM: Mayhem      → Match v5 API 未対応 ❌
```

- Riot の GitHub Issue #1109 で「ARAM: Mayhem が 403 を返す」と報告されており、
  API 側が正式にサポートするまでメイヘムのマッチデータは取得不可。
- キューIDも `queues.json` に未掲載。
- Mayhem はオーグメントを使用するが `playerAugment1〜6` は API に返らない。
- Riot の正式サポート後に再調査予定。

---

## パッチバージョン形式の注意

DDragon のバージョン（例: `16.9.1`）と Match API の `gameVersion`（例: `16.9.386.6510`）は形式が異なる。
3桁目はホットフィックス番号ではなくビルド番号のため、フィルタは `major.minor`（`"16.9"`）のプレフィックス一致で行う。
