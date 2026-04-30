"""
Leaguepedia (lol.fandom.com) Cargo API サービス

無料・認証不要。スケジュール + 試合後プレイヤー統計を取得可能。
"""
import logging
from datetime import datetime, timedelta
from typing import Any

import httpx

logger = logging.getLogger(__name__)

LEAGUEPEDIA_API = "https://lol.fandom.com/api.php"

# Data Dragon チャンピオン名の例外マッピング（Leaguepedia表記 → DDragon key）
_CHAMP_KEY: dict[str, str] = {
    "Wukong":           "MonkeyKing",
    "Nunu & Willump":   "Nunu",
    "Renata Glasc":     "Renata",
    "Bel'Veth":         "Belveth",
    "Cho'Gath":         "Chogath",
    "Kai'Sa":           "Kaisa",
    "Kha'Zix":          "Khazix",
    "Kog'Maw":          "KogMaw",
    "LeBlanc":          "Leblanc",
    "Lee Sin":          "LeeSin",
    "Rek'Sai":          "RekSai",
    "Vel'Koz":          "Velkoz",
    "Xin Zhao":         "XinZhao",
    "Master Yi":        "MasterYi",
    "Miss Fortune":     "MissFortune",
    "Twisted Fate":     "TwistedFate",
    "Jarvan IV":        "JarvanIV",
    "Tahm Kench":       "TahmKench",
    "Dr. Mundo":        "DrMundo",
    "K'Sante":          "KSante",
    "Aurelion Sol":     "AurelionSol",
    "Troll King":       "Trundle",
}


def _champ_image(name: str) -> str:
    key = _CHAMP_KEY.get(name, name.replace(" ", "").replace("'", ""))
    return f"https://ddragon.leagueoflegends.com/cdn/img/champion/tiles/{key}_0.jpg"


def _team_logo_url(filename: str) -> str:
    from urllib.parse import quote
    return f"https://lol.fandom.com/wiki/Special:FilePath/{quote(filename, safe='')}"


async def fetch_team_logos(team_names: list[str]) -> dict[str, str]:
    """チーム名 → ロゴURL の辞書を返す（Leaguepedia Teams テーブル）"""
    if not team_names:
        return {}
    names_clause = ",".join(f'"{n}"' for n in team_names)
    try:
        rows = await _cargo_query({
            "tables": "Teams",
            "fields": "Name,Image",
            "where":  f"Name IN ({names_clause})",
            "limit":  str(len(team_names) + 10),
        })
    except Exception as e:
        logger.warning("fetch_team_logos failed: %s", e)
        return {}

    result: dict[str, str] = {}
    for row in rows:
        name  = (row.get("Name") or "").strip()
        image = (row.get("Image") or "").strip()
        if name and image:
            result[name] = _team_logo_url(image)
    return result


def _gamelength_secs(gl: str | None) -> int | None:
    if not gl:
        return None
    try:
        m, s = gl.split(":")
        return int(m) * 60 + int(s)
    except Exception:
        return None


def _safe_int(v: Any) -> int:
    try:
        return int(v or 0)
    except (ValueError, TypeError):
        return 0


async def _cargo_query(params: dict, _retry: int = 3) -> list[dict]:
    import asyncio
    base = {"action": "cargoquery", "format": "json", "limit": "50"}
    base.update(params)

    for attempt in range(_retry):
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(
                LEAGUEPEDIA_API, params=base,
                headers={"User-Agent": "force.gg/1.0 (https://forcegg.io)"},
            )
            resp.raise_for_status()
            data = resp.json()

        if "error" in data:
            code = data["error"].get("code", "")
            if code == "ratelimited" and attempt < _retry - 1:
                wait = 10 * (attempt + 1)  # 10s, 20s, 30s
                logger.warning("Leaguepedia レートリミット: %ds 待機 (attempt %d)", wait, attempt + 1)
                await asyncio.sleep(wait)
                continue
            raise ValueError(f"Leaguepedia: {data['error'].get('info', data['error'])}")

        return [row["title"] for row in data.get("cargoquery", [])]

    return []


# ─── スケジュール取得 ──────────────────────────────────────

async def fetch_schedule(wiki_prefix: str, year: int, season: str) -> list[dict]:
    """
    MatchSchedule テーブルから今シーズンの全試合を取得する。
    LIKE クエリ1本で取得（リクエスト数削減）。
    """
    try:
        rows = await _cargo_query({
            "tables":   "MatchSchedule",
            "fields":   "Team1,Team2,DateTime_UTC,BestOf,Winner,Team1Score,Team2Score,Tab,OverviewPage",
            "where":    f'OverviewPage LIKE "{wiki_prefix}/{year}%"',
            "order_by": "DateTime_UTC DESC",
            "limit":    "50",
        })
    except Exception as e:
        logger.warning("MatchSchedule fetch failed (%s/%d): %s", wiki_prefix, year, e)
        rows = []

    if not rows:
        return []

    # Spring/Summer リーグ: シーズン名で絞り込み
    # Split形式リーグ（LPL/CBLOL/LCP等）は "split" キーワードで現在のSplitを判断
    season_lower = season.lower()
    split_keyword = "split 1" if season == "Spring" else "split 2"

    filtered = [
        r for r in rows
        if season_lower in (r.get("OverviewPage") or "").lower()
        or split_keyword in (r.get("OverviewPage") or "").lower()
    ]
    return filtered if filtered else rows


async def fetch_schedule_from_scoreboard(wiki_prefix: str, year: int) -> list[dict]:
    """
    MatchSchedule にデータがないリーグ向けフォールバック。
    ScoreboardGames（試合結果）からマッチ情報を再構築する。
    LPL など Split 制のリーグや MatchSchedule が未整備のリーグに対応。
    """
    try:
        games = await _cargo_query({
            "tables":   "ScoreboardGames",
            "fields":   "Team1,Team2,Winner,Gamelength,DateTime_UTC,Tournament",
            "where":    f'Tournament LIKE "{wiki_prefix}/{year}%"',
            "order_by": "DateTime_UTC DESC",
            "limit":    "100",
        })
    except Exception as e:
        logger.warning("ScoreboardGames fallback failed (%s/%d): %s", wiki_prefix, year, e)
        return []

    if not games:
        return []

    # 同日・同カードのゲームをマッチに集約
    from collections import defaultdict
    match_groups: dict[tuple, list[dict]] = defaultdict(list)
    for g in games:
        t1  = (g.get("Team1") or "").strip()
        t2  = (g.get("Team2") or "").strip()
        dt  = (g.get("DateTime UTC") or "").strip()
        day = dt[:10]  # "YYYY-MM-DD"
        key = (min(t1, t2), max(t1, t2), day)
        match_groups[key].append(g)

    rows = []
    for (_, _, day), gs in sorted(match_groups.items(), key=lambda x: x[0][2], reverse=True):
        g0   = gs[0]
        t1   = (g0.get("Team1") or "").strip()
        t2   = (g0.get("Team2") or "").strip()
        dt   = (g0.get("DateTime UTC") or "").strip()
        tourn = g0.get("Tournament") or ""

        t1_wins = sum(1 for g in gs if (g.get("Winner") or "").strip() == "1")
        t2_wins = sum(1 for g in gs if (g.get("Winner") or "").strip() == "2")
        total   = t1_wins + t2_wins
        winner  = "1" if t1_wins > t2_wins else ("2" if t2_wins > t1_wins else "")
        best_of = max(total + (0 if winner else 1), 3)

        rows.append({
            "Team1":        t1,
            "Team2":        t2,
            "DateTime UTC": dt,
            "BestOf":       str(best_of),
            "Winner":       winner,
            "Team1Score":   str(t1_wins),
            "Team2Score":   str(t2_wins),
            "Tab":          tourn,
            "OverviewPage": tourn,
        })

    logger.info("ScoreboardGames fallback: %s %d — %d マッチ再構築", wiki_prefix, year, len(rows))
    return rows


# ─── 試合詳細（ゲーム別プレイヤー統計）──────────────────────

async def fetch_match_games(
    league_id: int,
    wiki_prefix: str,
    team1_name: str,
    team2_name: str,
    begin_at: str,
) -> list[dict]:
    """
    マッチの begin_at + チーム名から Leaguepedia の ScoreboardGames を特定し、
    プレイヤー統計を返す。
    """
    dt = datetime.fromisoformat(begin_at.replace("Z", "+00:00"))
    dt_from = (dt - timedelta(hours=2)).strftime("%Y-%m-%d %H:%M:%S")
    dt_to   = (dt + timedelta(hours=26)).strftime("%Y-%m-%d %H:%M:%S")
    season  = "Spring" if dt.month <= 6 else "Summer"
    overview = f"{wiki_prefix}/{dt.year} Season/{season} Season"

    try:
        games_raw = await _cargo_query({
            "tables":   "ScoreboardGames",
            "fields":   "UniqueGame,Team1,Team2,Winner,Gamelength,Team1Gold,Team2Gold",
            "where": (
                f'Tournament="{overview}"'
                f' AND DateTime_UTC>="{dt_from}"'
                f' AND DateTime_UTC<="{dt_to}"'
                f' AND Gamelength IS NOT NULL'
            ),
            "order_by": "DateTime_UTC ASC",
        })
    except Exception as e:
        logger.warning("ScoreboardGames failed: %s", e)
        return []

    if not games_raw:
        # フォールバック: Tournament LIKE
        try:
            games_raw = await _cargo_query({
                "tables":   "ScoreboardGames",
                "fields":   "UniqueGame,Team1,Team2,Winner,Gamelength,Team1Gold,Team2Gold",
                "where": (
                    f'Tournament LIKE "{wiki_prefix}/{dt.year}%"'
                    f' AND DateTime_UTC>="{dt_from}"'
                    f' AND DateTime_UTC<="{dt_to}"'
                    f' AND Gamelength IS NOT NULL'
                ),
                "order_by": "DateTime_UTC ASC",
            })
        except Exception as e:
            logger.warning("ScoreboardGames LIKE failed: %s", e)
            return []

    if not games_raw:
        return []

    unique_ids = [g["UniqueGame"] for g in games_raw if g.get("UniqueGame")]
    if not unique_ids:
        return []

    # プレイヤー統計を一括取得
    ids_clause = ",".join(f'"{uid}"' for uid in unique_ids)
    try:
        players_raw = await _cargo_query({
            "tables":   "ScoreboardPlayers",
            "fields":   "UniqueGame,Player,Team,Champion,Kills,Deaths,Assists,Gold,DamageToChampions,Side",
            "where":    f"UniqueGame IN ({ids_clause})",
            "order_by": "UniqueGame,Side,Gold DESC",
            "limit":    "500",
        })
    except Exception as e:
        logger.warning("ScoreboardPlayers failed: %s", e)
        players_raw = []

    players_by_game: dict[str, list[dict]] = {}
    for p in players_raw:
        gid = p.get("UniqueGame", "")
        players_by_game.setdefault(gid, []).append(p)

    result = []
    for i, g in enumerate(games_raw):
        uid    = g.get("UniqueGame", "")
        winner = g.get("Winner", "")
        winner_side = "blue" if winner == "1" else ("red" if winner == "2" else None)

        players = players_by_game.get(uid, [])
        blue_pl = [_fmt_player(p) for p in players if (p.get("Side") or "").lower() == "blue"]
        red_pl  = [_fmt_player(p) for p in players if (p.get("Side") or "").lower() == "red"]

        result.append({
            "gameNumber":   i + 1,
            "duration":     _gamelength_secs(g.get("Gamelength")),
            "winnerSide":   winner_side,
            "blueTeamName": g.get("Team1", ""),
            "redTeamName":  g.get("Team2", ""),
            "blueTeamGold": _safe_int(g.get("Team1Gold")),
            "redTeamGold":  _safe_int(g.get("Team2Gold")),
            "bluePlayers":  blue_pl,
            "redPlayers":   red_pl,
        })

    return result


def _fmt_player(p: dict) -> dict:
    champ = p.get("Champion", "")
    return {
        "player_name":    p.get("Player", ""),
        "team_name":      p.get("Team", ""),
        "champion_name":  champ,
        "champion_image": _champ_image(champ) if champ else "",
        "kills":          _safe_int(p.get("Kills")),
        "deaths":         _safe_int(p.get("Deaths")),
        "assists":        _safe_int(p.get("Assists")),
        "total_gold":     _safe_int(p.get("Gold")),
        "damage_dealt":   _safe_int(p.get("DamageToChampions")),
    }
