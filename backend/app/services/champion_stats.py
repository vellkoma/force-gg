"""
チャンピオン統計サービス
データソース: SQLite（Riot Match API 自己集計データ） ← update.py で日次更新
"""
import logging
import math
from typing import Any

from app.services import esports_db as db

logger = logging.getLogger(__name__)

VALID_RANKS = {
    "CHALLENGER", "GRANDMASTER", "MASTER",
    "DIAMOND", "EMERALD", "PLATINUM", "GOLD", "SILVER", "BRONZE", "IRON",
}
DEFAULT_RANK = "CHALLENGER"

# 信頼性のないサンプルを除外する最小ピック数
_MIN_PICKS_ALL      = 15  # 全ポジション集約時（チャンピオン全体の合計ピック数）
_MIN_PICKS_POSITION = 8   # ポジション指定時（そのポジションでのピック数）

TIER_THRESHOLDS = [
    ("S+", 0.95),
    ("S",  0.80),
    ("A",  0.55),
    ("B",  0.25),
    ("C",  0.0),
]


def _compute_tiers(stats: list[dict]) -> list[dict]:
    if not stats:
        return stats

    # スコアが負（サンプル不足）は除外してパーセンタイル計算し、Cティア強制
    reliable   = [s for s in stats if s["_score"] >= 0]
    low_sample = [s for s in stats if s["_score"] < 0]

    scores = sorted(s["_score"] for s in reliable)
    n = len(scores) or 1

    def percentile(score: float) -> float:
        return sum(1 for s in scores if s <= score) / n

    for i, s in enumerate(sorted(reliable, key=lambda x: x["_score"], reverse=True), 1):
        pct = percentile(s["_score"])
        for tier_name, threshold in TIER_THRESHOLDS:
            if pct >= threshold:
                s["tier"] = tier_name
                break
        s["rank"] = i

    # サンプル不足チャンピオンはCティア・ランク最下位
    last_rank = len(reliable) + 1
    for s in low_sample:
        s["tier"] = "C"
        s["rank"] = last_rank

    return stats


# ─── SQLite データソース ──────────────────────────────────────

def _build_from_db(rows: list[dict], total_games: int) -> list[dict]:
    """DB の集計行からチャンピオン別サマリーを作成する（全ポジション集約）"""
    from collections import defaultdict

    by_champ: dict[str, list[dict]] = defaultdict(list)
    for r in rows:
        by_champ[r["champion_name"]].append(r)

    total = total_games or 1
    result: list[dict] = []

    for champ_name, pos_rows in by_champ.items():
        # ピック数が最多のポジションを主ポジとする（試合履歴ベース）
        best = max(pos_rows, key=lambda x: x["picks"])
        total_picks = sum(r["picks"] for r in pos_rows)
        total_wins  = sum(r["wins"]  for r in pos_rows)
        total_bans  = best["bans"]

        if total_picks == 0:
            continue

        win_rate  = total_wins  / total_picks
        pick_rate = total_picks / (total * 10)  # 1試合10ピック
        ban_rate  = total_bans  / total if total_bans else 0.0
        # サンプル不足はスコア最低値 → 常にCティアに配置
        score = win_rate * math.log(pick_rate * 1000 + 1) if total_picks >= _MIN_PICKS_ALL else -1.0

        result.append({
            "champion_id":   champ_name,
            "tier":          "B",
            "rank":          0,
            "win_rate":      round(win_rate,  4),
            "pick_rate":     round(pick_rate, 4),
            "ban_rate":      round(ban_rate,  4),
            "best_position": best["position"],
            "games_played":  total_picks,
            "_score":        score,
        })

    return result


def _build_from_db_position(rows: list[dict], total_games: int, position: str) -> list[dict]:
    """ポジション指定時: そのポジションでのプレイ実績のみで集計"""
    total = total_games or 1
    result: list[dict] = []

    for r in rows:
        picks = r["picks"]
        wins  = r["wins"]
        bans  = r["bans"]
        if picks == 0:
            continue

        win_rate  = wins  / picks
        pick_rate = picks / (total * 2)  # 1試合2スロット（両チーム各1）
        ban_rate  = bans  / total if bans else 0.0
        # サンプル不足はスコア最低値 → 常にCティアに配置
        score = win_rate * math.log(pick_rate * 1000 + 1) if picks >= _MIN_PICKS_POSITION else -1.0

        result.append({
            "champion_id":   r["champion_name"],
            "tier":          "B",
            "rank":          0,
            "win_rate":      round(win_rate,  4),
            "pick_rate":     round(pick_rate, 4),
            "ban_rate":      round(ban_rate,  4),
            "best_position": position,
            "games_played":  picks,
            "_score":        score,
        })

    return result


# ─── 公開 API ─────────────────────────────────────────────────

async def get_rank_quality(cache: Any) -> list[dict]:
    cache_key = "champion_rank_quality"
    cached = await cache.get(cache_key)
    if cached:
        return cached
    rows = await db.get_rank_game_counts()
    result = [{"rank": r["rank_group"], "total_games": r["total_games"], "patch": r["patch"]} for r in rows]
    await cache.set(cache_key, result, ttl=3600)
    return result


async def get_available_patches(rank: str, cache: Any) -> list[str]:
    if rank not in VALID_RANKS:
        rank = DEFAULT_RANK
    cache_key = f"champion_patches:{rank}"
    cached = await cache.get(cache_key)
    if cached:
        return cached
    patches = await db.get_available_patches(rank)
    await cache.set(cache_key, patches, ttl=3600)
    return patches


async def get_all_champion_stats(rank: str, cache: Any, patch: str | None = None, position: str | None = None) -> list[dict]:
    if rank not in VALID_RANKS:
        rank = DEFAULT_RANK

    pos_key = position if position and position != "ALL" else "ALL"
    cache_key = f"champion_stats_all:{rank}:{patch or 'latest'}:{pos_key}"
    cached = await cache.get(cache_key)
    if cached:
        return cached

    # 1. SQLite から取得
    db_rows = await db.get_champion_stats_latest(rank, patch, position if pos_key != "ALL" else None)
    if not db_rows and rank != DEFAULT_RANK:
        logger.info("champion_stats: %s のデータなし → CHALLENGER にフォールバック", rank)
        db_rows = await db.get_champion_stats_latest(DEFAULT_RANK, patch, position if pos_key != "ALL" else None)
    if not db_rows:
        logger.info("champion_stats: データなし（rank=%s, patch=%s, pos=%s）", rank, patch, pos_key)
        return []

    resolved_patch = patch or await db.get_latest_patch(rank)
    total_games = db_rows[0].get("total_games", 0)
    if pos_key != "ALL":
        result = _build_from_db_position(db_rows, total_games, pos_key)
    else:
        result = _build_from_db(db_rows, total_games)
    logger.info("champion_stats: SQLite から %d件（パッチ %s, ポジ %s）", len(result), resolved_patch, pos_key)

    result = _compute_tiers(result)
    clean = [{k: v for k, v in s.items() if k != "_score"} for s in result]
    await cache.set(cache_key, clean, ttl=3600)
    return clean


async def get_single_champion_stats(champion_id: str, rank: str, cache: Any, patch: str | None = None) -> list[dict]:
    if rank not in VALID_RANKS:
        rank = DEFAULT_RANK

    cache_key = f"champion_stats_single:{champion_id}:{rank}:{patch or 'latest'}"
    cached = await cache.get(cache_key)
    if cached:
        return cached

    db_rows = await db.get_champion_stats_single(champion_id, rank, patch)
    if not db_rows:
        return []

    total_games = db_rows[0].get("total_games", 1) or 1
    result = []
    for r in db_rows:
        picks = r["picks"]
        wins  = r["wins"]
        bans  = r["bans"]
        if picks == 0:
            continue
        result.append({
            "position":     r["position"],
            "win_rate":     round(wins / picks, 4),
            "pick_rate":    round(picks / (total_games * 10), 4),
            "ban_rate":     round(bans / total_games, 4) if bans else 0.0,
            "games_played": picks,
        })

    result.sort(key=lambda x: x["games_played"], reverse=True)
    await cache.set(cache_key, result, ttl=3600)
    return result


async def get_champion_patch_history(champion_id: str, rank: str, cache: Any) -> list[dict]:
    if rank not in VALID_RANKS:
        rank = DEFAULT_RANK

    cache_key = f"champion_history:{champion_id}:{rank}"
    cached = await cache.get(cache_key)
    if cached:
        return cached

    rows = await db.get_champion_patch_history(champion_id, rank)
    result = []
    for r in rows:
        picks = r["total_picks"] or 0
        wins  = r["total_wins"]  or 0
        if picks == 0:
            continue
        result.append({
            "patch":        r["patch"],
            "win_rate":     round(wins / picks, 4),
            "pick_rate":    round(picks / ((r["total_games"] or 1) * 10), 4),
            "games_played": picks,
        })

    await cache.set(cache_key, result, ttl=3600)
    return result


async def get_champion_item_stats(
    champion_id: str,
    rank: str,
    cache: Any,
    patch: str | None = None,
    position: str | None = None,
) -> list[dict]:
    if rank not in VALID_RANKS:
        rank = DEFAULT_RANK

    pos_key = position if position and position not in ("ALL", "") else "ALL"
    cache_key = f"champion_items:{champion_id}:{rank}:{patch or 'latest'}:{pos_key}"
    cached = await cache.get(cache_key)
    if cached:
        return cached

    rows = await db.get_champion_item_stats(champion_id, rank, patch, position if pos_key != "ALL" else None)
    if not rows:
        return []

    # スロット別に集計（上位TOP_N件）
    TOP_N = 3
    from collections import defaultdict
    by_slot: dict[int, list[dict]] = defaultdict(list)
    for r in rows:
        by_slot[r["slot"]].append(r)

    result = []
    for slot in sorted(by_slot.keys()):
        items = sorted(by_slot[slot], key=lambda x: x["item_count"], reverse=True)[:TOP_N]
        total_picks = items[0]["total_picks"] if items else 1
        result.append({
            "slot": slot,
            "items": [
                {
                    "item_id":   i["item_id"],
                    "pick_rate": round(i["item_count"] / total_picks, 4) if total_picks else 0.0,
                    "count":     i["item_count"],
                }
                for i in items
            ],
        })

    await cache.set(cache_key, result, ttl=3600)
    return result
