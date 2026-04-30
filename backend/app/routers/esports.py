"""
Esports スケジュール エンドポイント（Leaguepedia ベース）
"""
import asyncio
import logging

from fastapi import APIRouter, Header, HTTPException, Query
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.services import esports_db as db
from app.services.esports_sync import LEAGUE_CONFIG

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/esports", tags=["esports"])


def _players_summary(games: list[dict]) -> dict:
    all_players: dict[str, dict] = {}
    for g in games:
        for p in g.get("players", []):
            key = p["player_name"]
            if key not in all_players:
                all_players[key] = {**p, "kills": 0, "deaths": 0, "assists": 0,
                                    "total_gold": 0, "damage_dealt": 0}
            s = all_players[key]
            s["kills"]        += p["kills"]
            s["deaths"]       += p["deaths"]
            s["assists"]      += p["assists"]
            s["total_gold"]   += p["total_gold"]
            s["damage_dealt"] += p["damage_dealt"]

    players = list(all_players.values())
    if not players:
        return {"top_kda": None, "top_dmg": None}

    def kda(p: dict) -> float:
        return (p["kills"] + p["assists"]) / max(p["deaths"], 1)

    return {
        "top_kda": max(players, key=kda),
        "top_dmg": max(players, key=lambda p: p["damage_dealt"]),
    }


def _to_frontend(m: dict, league_name: str, games: list[dict]) -> dict:
    status_map = {
        "not_started": "unstarted",
        "running":     "inProgress",
        "finished":    "completed",
        "canceled":    "completed",
    }
    state   = status_map.get(m["status"], "unstarted")
    t1_wins = m["team1_score"] or 0
    t2_wins = m["team2_score"] or 0

    def team(name, acronym, image, wins, t_id) -> dict:
        result = None
        if state == "completed" and (t1_wins > 0 or t2_wins > 0):
            result = {
                "outcome":  "win" if wins == max(t1_wins, t2_wins) and wins > 0 else "loss",
                "gameWins": wins,
            }
        return {"id": t_id, "name": name, "code": acronym or name[:6],
                "image": image or "", "result": result}

    summary        = _players_summary(games) if games else {"top_kda": None, "top_dmg": None}
    total_duration = sum(g.get("duration") or 0 for g in games)

    return {
        "startTime": m["begin_at"],
        "state":     state,
        "type":      "match",
        "blockName": m.get("serie_name") or "",
        "league":    {"name": league_name, "slug": ""},
        "match": {
            "id":            str(m["id"]),
            "teams":         [
                team(m["team1_name"], m["team1_acronym"], m["team1_image_url"], t1_wins, m["team1_id"]),
                team(m["team2_name"], m["team2_acronym"], m["team2_image_url"], t2_wins, m["team2_id"]),
            ],
            "strategy":      {"type": "bestOf", "count": m["number_of_games"]},
            "totalDuration": total_duration,
            "summary":       summary,
        },
    }


@router.get("/schedule", summary="Esports スケジュール取得（Leaguepedia）")
async def get_esports_schedule(
    leagueId: str = Query(..., description="lolesports リーグ ID"),
    hl: str       = Query("ja-JP"),
) -> JSONResponse:
    try:
        league_id = int(leagueId)
    except ValueError:
        return JSONResponse({"error": f"不正なリーグID: {leagueId}"}, status_code=400)

    if league_id not in LEAGUE_CONFIG:
        return JSONResponse({"error": f"未対応リーグ: {leagueId}"}, status_code=404)

    matches     = await db.get_matches(league_id, limit=15)
    league_name = LEAGUE_CONFIG[league_id]["name"]
    syncing     = False  # update.py で管理するため常に false

    events = []
    for m in matches:
        games = await db.get_match_games(m["id"]) if m["status"] == "finished" else []
        events.append(_to_frontend(m, league_name, games))

    return JSONResponse({
        "data": {"schedule": {"events": events}},
        "syncing": syncing,  # フロントエンドでポーリング判断に使用
    })


@router.get("/match/{match_id}", summary="試合詳細（PandaScore → Leaguepedia フォールバック）")
async def get_match_detail(match_id: int) -> JSONResponse:
    from app.services.leaguepedia import fetch_match_games
    from app.services import pandascore as ps_service

    match_row = await db.get_match_by_id(match_id)
    if not match_row:
        return JSONResponse({"games": [], "source": "not_found"}, status_code=404)

    source = match_row.get("source", "leaguepedia")
    games  = []

    # ─── PandaScore 優先（source=pandascore または PS API キーがある場合）──
    if source == "pandascore":
        try:
            games = await ps_service.fetch_match_games(match_id)
            if games:
                return JSONResponse({"games": _fmt_games(games), "source": "pandascore"})
        except Exception as e:
            logger.warning("PandaScore match detail 失敗 match=%d: %s", match_id, e)

    # ─── Leaguepedia フォールバック ────────────────────────
    config = LEAGUE_CONFIG.get(match_row["league_id"], {})
    wiki   = config.get("wiki", "")
    try:
        games = await fetch_match_games(
            league_id   = match_row["league_id"],
            wiki_prefix = wiki,
            team1_name  = match_row["team1_name"],
            team2_name  = match_row["team2_name"],
            begin_at    = match_row["begin_at"],
        )
    except Exception as e:
        logger.warning("Leaguepedia fetch error match=%d: %s", match_id, e)
        games = []

    return JSONResponse({"games": _fmt_games(games), "source": "leaguepedia"})


def _fmt_games(games: list[dict]) -> list[dict]:
    return [
        {
            "gameNumber":   g["gameNumber"],
            "duration":     g["duration"],
            "winnerSide":   g.get("winnerSide"),
            "blueTeamName": g["blueTeamName"],
            "redTeamName":  g["redTeamName"],
            "blueTeamGold": g.get("blueTeamGold", 0),
            "redTeamGold":  g.get("redTeamGold", 0),
            "bluePlayers":  g["bluePlayers"],
            "redPlayers":   g["redPlayers"],
        }
        for g in games
    ]


@router.get("/leagues", summary="リーグ一覧とアイコンURL")
async def get_leagues() -> JSONResponse:
    icons = await db.get_league_icons()
    leagues = [
        {
            "id":       str(league_id),
            "name":     cfg["name"],
            "hl":       cfg["hl"],
            "icon_url": icons.get(cfg["name"], ""),
        }
        for league_id, cfg in LEAGUE_CONFIG.items()
    ]
    return JSONResponse(leagues)


@router.post("/admin/update", summary="日次データ更新トリガー（GitHub Actions から呼び出す）")
async def trigger_update(x_update_secret: str = Header(...)) -> JSONResponse:
    if x_update_secret != settings.update_secret:
        raise HTTPException(status_code=401, detail="Unauthorized")

    async def _run() -> None:
        import sys, os
        sys.path.insert(0, ".")
        from update import main as update_main
        await update_main()

    asyncio.create_task(_run())
    return JSONResponse({"status": "started"})
