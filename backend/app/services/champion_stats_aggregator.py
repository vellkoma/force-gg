"""
チャンピオン統計データ集計サービス
Riot Match v5 API からチャレンジャー帯のマッチをサンプリングして
champion_stats_aggregate テーブルに集計・保存する。

呼び出し方:
    from app.services.champion_stats_aggregator import collect_and_store_stats
    await collect_and_store_stats(riot_client)
"""
import asyncio
import logging
from collections import defaultdict
from datetime import datetime, timezone

import httpx
from fastapi import HTTPException

from app.services import esports_db as db
from app.services.riot_client import RiotClient

logger = logging.getLogger(__name__)

_POS: dict[str, str | None] = {
    "TOP":     "TOP",
    "JUNGLE":  "JUNGLE",
    "MIDDLE":  "MID",
    "BOTTOM":  "ADC",
    "UTILITY": "SUPPORT",
    "Invalid": None,
}

# Riot API でのティア名（entries エンドポイント用）
_TIER_API: dict[str, str] = {
    "DIAMOND":  "DIAMOND",
    "EMERALD":  "EMERALD",
    "PLATINUM": "PLATINUM",
    "GOLD":     "GOLD",
    "SILVER":   "SILVER",
    "BRONZE":   "BRONZE",
    "IRON":     "IRON",
}

# チャレンジャーから何名サンプルするか
_MAX_SUMMONERS = 100
# 1人あたり何試合取得するか（最新パッチ）
_MATCHES_PER_SUMMONER = 10
# 過去パッチ指定時: 1人あたりの取得件数（Riot API 上限 100）
# チャレンジャー帯は1日5〜10試合プレイするため100件で約2週間分をカバー
_MATCHES_PER_SUMMONER_HISTORICAL = 100
# 並列リクエスト数（dev key レート制限対策）
_SEM_SIZE = 2


async def _get_current_patch() -> str:
    """DDragon から最新バージョンをホットフィックス番号付きで返す（例: "16.9.1"）"""
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.get("https://ddragon.leagueoflegends.com/api/versions.json")
        r.raise_for_status()
        versions: list[str] = r.json()
    latest = versions[0]
    parts = latest.split(".")
    # major.minor.hotfix の3パートまで保持
    return ".".join(parts[:3]) if len(parts) >= 3 else ".".join(parts[:2])


async def _get_champion_id_map(patch: str) -> dict[int, str]:
    async with httpx.AsyncClient(timeout=10) as c:
        r_ver = await c.get("https://ddragon.leagueoflegends.com/api/versions.json")
        r_ver.raise_for_status()
        versions: list[str] = r_ver.json()
        # 3パート（"16.9.1"）→ 完全一致優先、なければ major.minor 前方一致
        patch_parts = patch.split(".")
        major_minor  = f"{patch_parts[0]}.{patch_parts[1]}."
        ver = next(
            (v for v in versions if v == patch or v.startswith(patch + ".")),
            next((v for v in versions if v.startswith(major_minor)), versions[0])
        )

        r = await c.get(
            f"https://ddragon.leagueoflegends.com/cdn/{ver}/data/en_US/champion.json"
        )
        r.raise_for_status()
        data = r.json()

    return {int(info["key"]): name for name, info in data["data"].items()}


async def _safe(sem: asyncio.Semaphore, coro, default=None):
    async with sem:
        try:
            result = await coro
            await asyncio.sleep(0.2)
            return result
        except (HTTPException, Exception) as e:
            logger.debug("API呼び出しエラー（スキップ）: %s", e)
            await asyncio.sleep(0.2)
            return default


async def _get_puuids_for_rank(client: RiotClient, sem: asyncio.Semaphore, rank_group: str) -> list[str]:
    """ランクグループに応じた PUUID リストを取得する"""
    queue = "RANKED_SOLO_5x5"

    if rank_group == "CHALLENGER":
        league = await client.get_challenger_league(queue)
        entries = league.get("entries", [])
        entries.sort(key=lambda x: x.get("leaguePoints", 0), reverse=True)
        entries = entries[:_MAX_SUMMONERS]
        return [e["puuid"] for e in entries if e.get("puuid")]

    if rank_group == "GRANDMASTER":
        league = await client.get_grandmaster_league(queue)
        entries = league.get("entries", [])
        entries.sort(key=lambda x: x.get("leaguePoints", 0), reverse=True)
        entries = entries[:_MAX_SUMMONERS]
        return [e["puuid"] for e in entries if e.get("puuid")]

    if rank_group == "MASTER":
        league = await client.get_master_league(queue)
        entries = league.get("entries", [])
        entries.sort(key=lambda x: x.get("leaguePoints", 0), reverse=True)
        entries = entries[:_MAX_SUMMONERS]
        return [e["puuid"] for e in entries if e.get("puuid")]

    # DIAMOND 以下: entries エンドポイント + summonerId → PUUID 変換
    # ※ 開発用 API キーでは 403 が返る。本番キーが必要。
    tier = _TIER_API.get(rank_group)
    if not tier:
        logger.warning("不明なランクグループ: %s", rank_group)
        return []

    try:
        raw_entries: list[dict] = await client.get_league_entries(tier, "I", queue, page=1)
    except Exception as e:
        logger.error(
            "  %s のエントリ取得失敗: %s\n"
            "  ※ DIAMOND 以下のエンドポイントは本番 API キーが必要です（開発キーでは 403）",
            rank_group, e,
        )
        return []
    # ページ2も取得（1ページ200件が上限）
    if len(raw_entries) >= 200:
        page2 = await _safe(sem, client.get_league_entries(tier, "I", queue, page=2), default=[])
        raw_entries += (page2 or [])

    import random
    random.shuffle(raw_entries)
    raw_entries = raw_entries[:_MAX_SUMMONERS]

    # PUUID がエントリーに含まれている場合はそのまま使用
    puuids = [e["puuid"] for e in raw_entries if e.get("puuid")]
    if puuids:
        return puuids

    # 含まれていない場合は summonerId から PUUID を取得
    async def fetch_puuid(entry: dict) -> str | None:
        sid = entry.get("summonerId")
        if not sid:
            return None
        summoner = await _safe(sem, client.get_summoner_by_id(sid), default=None)
        return summoner.get("puuid") if summoner else None

    results = await asyncio.gather(*[fetch_puuid(e) for e in raw_entries])
    return [p for p in results if p]


async def collect_and_store_stats(client: RiotClient, rank_group: str = "CHALLENGER", patch: str | None = None) -> None:
    rank_group = rank_group.upper()
    logger.info("チャンピオン統計集計 開始 [%s]", rank_group)

    # パッチ・チャンピオンIDマップ取得
    try:
        if patch:
            # major.minor.hotfix まで保持（"16.9" → "16.9"、"16.9.1" → "16.9.1"）
            parts = patch.split(".")
            patch = ".".join(parts[:3]) if len(parts) >= 3 else f"{parts[0]}.{parts[1]}"
            logger.info("  パッチ指定: %s", patch)
        else:
            patch = await _get_current_patch()
            logger.info("  パッチ: %s（最新）", patch)
        id_map = await _get_champion_id_map(patch)
        logger.info("  チャンピオン: %d件", len(id_map))
    except Exception as e:
        logger.error("  初期データ取得失敗: %s", e)
        return

    sem = asyncio.Semaphore(_SEM_SIZE)

    # ランク別に PUUID を取得
    try:
        puuids = await _get_puuids_for_rank(client, sem, rank_group)
    except Exception as e:
        logger.error("  PUUID取得失敗: %s", e)
        return

    logger.info("  PUUID取得: %d件", len(puuids))
    if not puuids:
        logger.warning("  PUUIDが取得できませんでした")
        return

    # 過去パッチ指定時は遡り件数を増やす
    current_patch = await _get_current_patch()
    is_historical = patch != current_patch
    matches_per_summoner = (
        _MATCHES_PER_SUMMONER_HISTORICAL if is_historical
        else _MATCHES_PER_SUMMONER
    )
    logger.info(
        "  1人あたり取得件数: %d件（%s）",
        matches_per_summoner,
        "過去パッチ" if is_historical else "最新パッチ",
    )

    # パッチ期間キャッシュを確認（startTime/endTime フィルタに使用）
    patch_parts = patch.split(".")
    major_minor = f"{patch_parts[0]}.{patch_parts[1]}"
    date_range = await db.get_patch_date_range(major_minor)
    start_time: int | None = None
    end_time: int | None = None
    if date_range and is_historical:
        start_time = date_range["start_time"]
        end_time   = date_range["end_time"]
        from datetime import datetime as _dt
        logger.info(
            "  パッチ期間キャッシュ使用: %s 〜 %s",
            _dt.fromtimestamp(start_time).strftime("%Y-%m-%d"),
            _dt.fromtimestamp(end_time).strftime("%Y-%m-%d"),
        )

    # マッチID 収集（重複除去）
    match_id_sets: list[list[str]] = []
    for puuid in puuids:
        ids = await _safe(
            sem,
            client.get_match_ids(
                puuid,
                count=matches_per_summoner,
                queue=420,
                start_time=start_time,
                end_time=end_time,
            ),
            default=[],
        )
        match_id_sets.append(ids or [])

    all_match_ids = list({mid for lst in match_id_sets for mid in lst})
    logger.info("  ユニークマッチID: %d件", len(all_match_ids))

    if not all_match_ids:
        logger.warning("  マッチIDが取得できませんでした")
        return

    # マッチ詳細取得（チャンク処理でレート制限対策）
    # dev key: 100 req/2min → 8並列 × チャンク間5秒でスロットリング
    CHUNK = 8
    matches: list[dict] = []
    for i in range(0, len(all_match_ids), CHUNK):
        chunk = all_match_ids[i : i + CHUNK]
        results = await asyncio.gather(
            *[_safe(sem, client.get_match(mid), default=None) for mid in chunk]
        )
        matches.extend(m for m in results if m)
        logger.info("  マッチ詳細: %d/%d", len(matches), len(all_match_ids))
        if i + CHUNK < len(all_match_ids):
            await asyncio.sleep(5)

    logger.info("  マッチ詳細取得完了: %d件", len(matches))

    if not matches:
        logger.warning("  マッチ詳細が取得できませんでした")
        return

    # パッチでフィルタリング（gameVersion は "16.9.1.12345" 形式）
    before = len(matches)
    matches = [
        m for m in matches
        if m.get("info", {}).get("gameVersion", "").startswith(patch + ".")
    ]
    logger.info("  パッチ %s のマッチ: %d件（除外: %d件）", patch, len(matches), before - len(matches))

    if not matches:
        logger.warning("  パッチ %s のマッチが見つかりませんでした（別パッチのデータのみ）", patch)
        return

    # パッチ期間をDBに記録（gameCreation は ms → s に変換）
    timestamps = [
        m["info"]["gameCreation"] // 1000
        for m in matches
        if m.get("info", {}).get("gameCreation", 0) > 0
    ]
    if timestamps:
        await db.upsert_patch_date_range(major_minor, min(timestamps), max(timestamps))
        from datetime import datetime as _dt
        logger.info(
            "  パッチ期間記録: %s [%s 〜 %s]",
            major_minor,
            _dt.fromtimestamp(min(timestamps)).strftime("%Y-%m-%d"),
            _dt.fromtimestamp(max(timestamps)).strftime("%Y-%m-%d"),
        )

    # gameVersion（major.minor.hotfix）ごとにグループ化して個別に保存
    by_version: dict[str, list[dict]] = defaultdict(list)
    for m in matches:
        game_ver = m.get("info", {}).get("gameVersion", "")
        ver_parts = game_ver.split(".")
        ver_key = ".".join(ver_parts[:3]) if len(ver_parts) >= 3 else ".".join(ver_parts[:2])
        by_version[ver_key].append(m)

    logger.info("  ホットフィックス別内訳: %s", {v: len(ms) for v, ms in by_version.items()})

    now = datetime.now(timezone.utc).isoformat()
    for ver, ver_matches in sorted(by_version.items()):
        pick_stats: dict[tuple[str, str], dict] = defaultdict(lambda: {"wins": 0, "picks": 0})
        ban_stats: dict[str, int] = defaultdict(int)
        item_slot_stats: dict[tuple[str, str], dict[int, dict[int, int]]] = defaultdict(
            lambda: defaultdict(lambda: defaultdict(int))
        )
        total_games = len(ver_matches)

        for match in ver_matches:
            info = match.get("info", {})

            for p in info.get("participants", []):
                champ = p.get("championName", "")
                raw_pos = p.get("individualPosition", "")
                pos = _POS.get(raw_pos)
                if not champ or not pos:
                    continue
                key = (champ, pos)
                pick_stats[key]["picks"] += 1
                if p.get("win", False):
                    pick_stats[key]["wins"] += 1
                for slot in range(6):
                    item_id = p.get(f"item{slot}", 0)
                    if item_id > 0:
                        item_slot_stats[key][slot][item_id] += 1

            for team in info.get("teams", []):
                for ban in team.get("bans", []):
                    cid = ban.get("championId", -1)
                    if cid > 0:
                        name = id_map.get(cid, "")
                        if name:
                            ban_stats[name] += 1

        rows = [
            {
                "champion_name": champ,
                "position":      pos,
                "patch":         ver,
                "rank_group":    rank_group,
                "wins":          stats["wins"],
                "picks":         stats["picks"],
                "bans":          ban_stats.get(champ, 0),
                "total_games":   total_games,
                "updated_at":    now,
            }
            for (champ, pos), stats in pick_stats.items()
        ]

        # アイテム統計集計
        item_rows = []
        for (champ, pos), slot_data in item_slot_stats.items():
            picks = pick_stats.get((champ, pos), {}).get("picks", 0)
            if picks == 0:
                continue
            for slot, item_counts in slot_data.items():
                for item_id, count in item_counts.items():
                    item_rows.append({
                        "champion_name": champ,
                        "position":      pos,
                        "patch":         ver,
                        "rank_group":    rank_group,
                        "slot":          slot,
                        "item_id":       item_id,
                        "item_count":    count,
                        "total_picks":   picks,
                        "updated_at":    now,
                    })

        if rows:
            await db.upsert_champion_stats(rows)
            await db.upsert_champion_stats_meta(ver, total_games, now, rank_group)
            logger.info("  保存完了 [%s]: %d件（%dマッチ）", ver, len(rows), total_games)
        else:
            logger.warning("  集計データなし [%s]", ver)
        if item_rows:
            await db.upsert_champion_item_stats(item_rows)
            logger.info("  アイテム統計保存 [%s]: %d件", ver, len(item_rows))

    logger.info("チャンピオン統計集計 完了 [%s / %s]", rank_group, patch)
