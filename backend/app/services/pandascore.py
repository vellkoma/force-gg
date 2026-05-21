"""
PandaScore API サービス
スケジュール・試合詳細・プレイヤー統計を取得する
"""
import logging
from typing import Any

import httpx

from app.core.config import settings
from app.services.leaguepedia import _champ_image

logger = logging.getLogger(__name__)

PANDASCORE_API = "https://api.pandascore.co"

# PandaScore リーグID キャッシュ（リーグ名 → PS league ID）
_ps_league_id_cache: dict[str, int] = {}


def _auth_headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {settings.pandascore_api_key}"}


def _parse_status(status: str | None) -> str:
    mapping = {
        "not_started": "not_started",
        "running":     "running",
        "finished":    "finished",
        "canceled":    "finished",
    }
    return mapping.get(status or "", "not_started")


async def _get_ps_league_id(league_name: str) -> int | None:
    if league_name in _ps_league_id_cache:
        return _ps_league_id_cache[league_name]
    if not settings.pandascore_api_key:
        return None
    try:
        async with httpx.AsyncClient(headers=_auth_headers(), timeout=15) as c:
            r = await c.get(f"{PANDASCORE_API}/lol/leagues",
                            params={"search[name]": league_name, "per_page": "5"})
            r.raise_for_status()
            for lg in r.json():
                if league_name.lower() in (lg.get("name") or "").lower():
                    _ps_league_id_cache[league_name] = lg["id"]
                    logger.info("PandaScore league ID キャッシュ: %s → %d", league_name, lg["id"])
                    return lg["id"]
    except Exception as e:
        logger.warning("PandaScore league ID 取得失敗 (%s): %s", league_name, e)
    return None


def _parse_match(m: dict[str, Any], our_league_id: int) -> dict | None:
    """PandaScore match オブジェクト → 内部形式"""
    opponents = m.get("opponents") or []
    if len(opponents) < 2:
        return None

    t1 = opponents[0].get("opponent") or {}
    t2 = opponents[1].get("opponent") or {}
    if not t1.get("name") or not t2.get("name"):
        return None

    results = {r["team_id"]: r["score"] for r in (m.get("results") or [])}
    t1_score = results.get(t1.get("id"), 0) or 0
    t2_score = results.get(t2.get("id"), 0) or 0

    begin_at = m.get("begin_at") or ""
    if not begin_at:
        return None

    serie = m.get("serie") or {}
    tourn = m.get("tournament") or {}

    t1_name = t1["name"].strip()
    t2_name = t2["name"].strip()

    return {
        "id":              m["id"],
        "league_id":       our_league_id,
        "begin_at":        begin_at,
        "status":          _parse_status(m.get("status")),
        "number_of_games": m.get("number_of_games") or 3,
        "team1_id":        t1.get("id"),
        "team1_name":      t1_name,
        "team1_acronym":   t1.get("acronym") or t1_name[:4],
        "team1_image_url": t1.get("image_url") or "",
        "team1_score":     t1_score,
        "team2_id":        t2.get("id"),
        "team2_name":      t2_name,
        "team2_acronym":   t2.get("acronym") or t2_name[:4],
        "team2_image_url": t2.get("image_url") or "",
        "team2_score":     t2_score,
        "serie_name":      tourn.get("name") or serie.get("full_name") or "",
        "source":          "pandascore",
    }


async def fetch_schedule(league_name: str, our_league_id: int) -> list[dict]:
    """PandaScore からスケジュールを取得。失敗時は空リストを返す"""
    if not settings.pandascore_api_key:
        return []

    ps_league_id = await _get_ps_league_id(league_name)
    if not ps_league_id:
        logger.info("PandaScore: %s のリーグIDが見つからない", league_name)
        return []

    try:
        async with httpx.AsyncClient(headers=_auth_headers(), timeout=20) as c:
            r = await c.get(
                f"{PANDASCORE_API}/lol/matches",
                params={
                    "filter[league_id]": ps_league_id,
                    "per_page":          "50",
                    "sort":              "-begin_at",
                },
            )
            r.raise_for_status()
            matches_raw = r.json()
    except Exception as e:
        logger.warning("PandaScore fetch_schedule 失敗 (%s): %s", league_name, e)
        return []

    matches = [m for m in (_parse_match(raw, our_league_id) for raw in matches_raw) if m]
    logger.info("PandaScore schedule: %s — %d 件", league_name, len(matches))
    return matches


async def fetch_live_and_recent(league_name: str, our_league_id: int) -> list[dict]:
    """
    PandaScore から running（Live）と直近24時間に終了した試合を取得する。
    1時間ごとのステータス更新用。失敗時は空リストを返す。
    """
    if not settings.pandascore_api_key:
        return []

    ps_league_id = await _get_ps_league_id(league_name)
    if not ps_league_id:
        return []

    matches_raw: list[dict] = []
    try:
        async with httpx.AsyncClient(headers=_auth_headers(), timeout=20) as c:
            # running（試合中）
            r1 = await c.get(
                f"{PANDASCORE_API}/lol/matches/running",
                params={"filter[league_id]": ps_league_id, "per_page": "20"},
            )
            if r1.status_code == 200:
                matches_raw.extend(r1.json())

            # 直近終了した試合（past の先頭10件 = 最新終了分）
            r2 = await c.get(
                f"{PANDASCORE_API}/lol/matches/past",
                params={
                    "filter[league_id]": ps_league_id,
                    "per_page": "10",
                    "sort": "-end_at",
                },
            )
            if r2.status_code == 200:
                matches_raw.extend(r2.json())
    except Exception as e:
        logger.warning("PandaScore fetch_live_and_recent 失敗 (%s): %s", league_name, e)
        return []

    matches = [m for m in (_parse_match(raw, our_league_id) for raw in matches_raw) if m]
    logger.info("PandaScore live/recent: %s — %d 件", league_name, len(matches))
    return matches


async def fetch_match_games(ps_match_id: int) -> list[dict]:
    """
    PandaScore からゲーム別プレイヤー統計を取得する。
    Leaguepedia の fetch_match_games と同じ形式で返す。
    """
    if not settings.pandascore_api_key:
        return []

    try:
        async with httpx.AsyncClient(headers=_auth_headers(), timeout=20) as c:
            r = await c.get(f"{PANDASCORE_API}/lol/matches/{ps_match_id}")
            r.raise_for_status()
            match_data = r.json()

            game_ids = [g["id"] for g in (match_data.get("games") or []) if g.get("id")]
            if not game_ids:
                return []

            result = []
            for i, game_id in enumerate(sorted(game_ids)):
                gr = await c.get(f"{PANDASCORE_API}/lol/games/{game_id}")
                gr.raise_for_status()
                game = gr.json()
                result.append(_parse_game(game, i + 1))

            return [g for g in result if g]

    except Exception as e:
        logger.warning("PandaScore fetch_match_games 失敗 (match=%d): %s", ps_match_id, e)
        return []


def _parse_game(game: dict, game_number: int) -> dict | None:
    teams = game.get("teams") or []
    if not teams:
        return None

    blue_team = next((t for t in teams if (t.get("side") or "").lower() == "blue"), None)
    red_team  = next((t for t in teams if (t.get("side") or "").lower() == "red"), None)

    winner_info = game.get("winner") or {}
    winner_id   = winner_info.get("id")
    blue_id     = (blue_team or {}).get("team", {}).get("id") if blue_team else None
    red_id      = (red_team  or {}).get("team", {}).get("id") if red_team  else None

    if winner_id and winner_id == blue_id:
        winner_side = "blue"
    elif winner_id and winner_id == red_id:
        winner_side = "red"
    else:
        winner_side = None

    def team_name(t: dict | None) -> str:
        if not t:
            return ""
        return (t.get("team") or {}).get("name") or ""

    def team_gold(t: dict | None) -> int:
        if not t:
            return 0
        return sum(
            (p.get("gold_earned") or 0)
            for p in (t.get("player_stats") or [])
        )

    def parse_players(t: dict | None) -> list[dict]:
        if not t:
            return []
        result = []
        for p in (t.get("player_stats") or []):
            player_info = p.get("player") or {}
            champ_name  = (p.get("champion") or {}).get("name") or ""
            result.append({
                "player_name":    player_info.get("name") or "",
                "team_name":      team_name(t),
                "champion_name":  champ_name,
                "champion_image": _champ_image(champ_name) if champ_name else "",
                "kills":          p.get("kills") or 0,
                "deaths":         p.get("deaths") or 0,
                "assists":        p.get("assists") or 0,
                "total_gold":     p.get("gold_earned") or 0,
                "damage_dealt":   p.get("total_damage_dealt_to_champions") or 0,
            })
        return result

    return {
        "gameNumber":   game_number,
        "duration":     game.get("length"),
        "winnerSide":   winner_side,
        "blueTeamName": team_name(blue_team),
        "redTeamName":  team_name(red_team),
        "blueTeamGold": team_gold(blue_team),
        "redTeamGold":  team_gold(red_team),
        "bluePlayers":  parse_players(blue_team),
        "redPlayers":   parse_players(red_team),
    }
