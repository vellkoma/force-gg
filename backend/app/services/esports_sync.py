"""
Esports 定数 + Leaguepedia パーサー
スケジュール同期は update.py で行うため、ここはデータ定義のみ。
"""
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Any

LEAGUE_CONFIG: dict[int, dict] = {
    # PandaScore から最新データが取れるリーグ（先に処理してLeaguepediaの回復時間を確保）
    98767991302996019:  {"name": "LEC",   "wiki": "LEC",       "hl": "en-GB"},
    98767991314006698:  {"name": "LPL",   "wiki": "LPL",       "hl": "zh-CN"},
    113476371197627891: {"name": "LCP",   "wiki": "LCP",       "hl": "en-US"},
    104366947889790212: {"name": "PCS",   "wiki": "PCS",       "hl": "en-US"},
    # Leaguepedia フォールバックが必要なリーグ（後にまとめて300秒間隔で処理）
    98767991349978712:  {"name": "LJL",   "wiki": "LJL",       "hl": "ja-JP"},
    98767991310872058:  {"name": "LCK",   "wiki": "LCK",       "hl": "ko-KR"},
    98767991299243165:  {"name": "LCS",   "wiki": "LTA North", "hl": "en-US"},
    98767991332355509:  {"name": "CBLOL", "wiki": "CBLOL",     "hl": "pt-BR"},
}


def _match_id(league_id: int, team1: str, team2: str, date: str) -> int:
    key = f"{league_id}|{team1.lower()}|{team2.lower()}|{date}"
    return int(hashlib.sha256(key.encode()).hexdigest()[:7], 16)


def _team_acronym(name: str) -> str:
    upper = "".join(c for c in name if c.isupper())
    if 2 <= len(upper) <= 5:
        return upper
    return name[:4].strip()


def _safe_int(v: Any) -> int:
    try:
        return int(v or 0)
    except (ValueError, TypeError):
        return 0


def _parse_match(row: dict, league_id: int) -> dict | None:
    """Leaguepedia の行データを内部形式に変換する"""
    team1  = (row.get("Team1") or "").strip()
    team2  = (row.get("Team2") or "").strip()
    dt_str = (row.get("DateTime UTC") or "").strip()

    if not team1 or not team2 or not dt_str:
        return None

    try:
        dt = datetime.strptime(dt_str, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
    except ValueError:
        return None

    begin_at = dt.isoformat()
    winner   = (row.get("Winner") or "").strip()
    now      = datetime.now(timezone.utc)

    if winner in ("1", "2"):
        status = "finished"
    elif dt > now + timedelta(minutes=10):
        status = "not_started"
    elif now - dt < timedelta(hours=4):
        status = "running"
    else:
        # winner 未設定でも開始から4時間超 → 終了扱い（過去試合が not_started のまま残らないように）
        status = "finished"

    t1_score = _safe_int(row.get("Team1Score")) if winner else 0
    t2_score = _safe_int(row.get("Team2Score")) if winner else 0
    best_of  = _safe_int(row.get("BestOf")) or 3

    return {
        "id":              _match_id(league_id, team1, team2, begin_at[:10]),
        "league_id":       league_id,
        "begin_at":        begin_at,
        "status":          status,
        "number_of_games": best_of,
        "team1_id":        None,
        "team1_name":      team1,
        "team1_acronym":   _team_acronym(team1),
        "team1_image_url": "",
        "team1_score":     t1_score,
        "team2_id":        None,
        "team2_name":      team2,
        "team2_acronym":   _team_acronym(team2),
        "team2_image_url": "",
        "team2_score":     t2_score,
        "serie_name":      row.get("Tab") or "",
        "source":          "leaguepedia",
    }
