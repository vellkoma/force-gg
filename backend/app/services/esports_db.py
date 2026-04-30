"""
Esports スケジュール SQLite DB サービス
"""
import logging
from datetime import datetime, timezone
from typing import Any

import aiosqlite

from app.core.config import settings

logger = logging.getLogger(__name__)
_DB_PATH = settings.esports_db_path


async def init_db() -> None:
    async with aiosqlite.connect(_DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS esports_matches (
                id              INTEGER PRIMARY KEY,
                league_id       INTEGER NOT NULL,
                begin_at        TEXT    NOT NULL,
                status          TEXT    NOT NULL,
                number_of_games INTEGER NOT NULL DEFAULT 3,
                team1_id        INTEGER,
                team1_name      TEXT,
                team1_acronym   TEXT,
                team1_image_url TEXT,
                team1_score     INTEGER DEFAULT 0,
                team2_id        INTEGER,
                team2_name      TEXT,
                team2_acronym   TEXT,
                team2_image_url TEXT,
                team2_score     INTEGER DEFAULT 0,
                serie_name      TEXT,
                updated_at      TEXT    NOT NULL
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS esports_sync_log (
                league_id      INTEGER PRIMARY KEY,
                last_synced_at TEXT    NOT NULL
            )
        """)
        await db.execute("""
            CREATE INDEX IF NOT EXISTS idx_matches_league_begin
                ON esports_matches (league_id, begin_at)
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS esports_games (
                id             INTEGER PRIMARY KEY,
                match_id       INTEGER NOT NULL,
                game_number    INTEGER DEFAULT 1,
                duration       INTEGER,
                winner_team_id INTEGER,
                blue_team_id   INTEGER,
                red_team_id    INTEGER
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS esports_game_players (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                game_id       INTEGER NOT NULL,
                player_name   TEXT    NOT NULL,
                team_id       INTEGER,
                team_name     TEXT,
                champion_name TEXT,
                champion_image TEXT,
                kills         INTEGER DEFAULT 0,
                deaths        INTEGER DEFAULT 0,
                assists       INTEGER DEFAULT 0,
                total_gold    INTEGER DEFAULT 0,
                damage_dealt  INTEGER DEFAULT 0
            )
        """)
        await db.execute("""
            CREATE INDEX IF NOT EXISTS idx_game_players_game
                ON esports_game_players (game_id)
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS esports_league_icons (
                league_name TEXT PRIMARY KEY,
                icon_url    TEXT NOT NULL,
                updated_at  TEXT NOT NULL
            )
        """)

        # source カラム追加（既存DBとの互換性維持）
        try:
            await db.execute(
                "ALTER TABLE esports_matches ADD COLUMN source TEXT DEFAULT 'leaguepedia'"
            )
        except Exception:
            pass  # 既に存在する場合は無視

        # 旧PandaScore形式のleague_id（小さい整数）を削除
        # 現在のleague_idはlolesports形式（98767991...）で14桁以上
        await db.execute(
            "DELETE FROM esports_matches WHERE league_id < 1000000000000000"
        )
        await db.execute(
            "DELETE FROM esports_sync_log WHERE league_id < 1000000000000000"
        )
        await db.commit()
    logger.info("Esports DB 初期化完了: %s", _DB_PATH)


async def get_last_synced(league_id: int) -> datetime | None:
    async with aiosqlite.connect(_DB_PATH) as db:
        async with db.execute(
            "SELECT last_synced_at FROM esports_sync_log WHERE league_id = ?",
            (league_id,),
        ) as cur:
            row = await cur.fetchone()
    if row:
        return datetime.fromisoformat(row[0])
    return None


async def update_sync_log(league_id: int) -> None:
    now = datetime.now(timezone.utc).isoformat()
    async with aiosqlite.connect(_DB_PATH) as db:
        await db.execute(
            "INSERT OR REPLACE INTO esports_sync_log (league_id, last_synced_at) VALUES (?, ?)",
            (league_id, now),
        )
        await db.commit()


async def upsert_matches(matches: list[dict[str, Any]]) -> None:
    now = datetime.now(timezone.utc).isoformat()
    async with aiosqlite.connect(_DB_PATH) as db:
        for m in matches:
            await db.execute(
                """
                INSERT OR REPLACE INTO esports_matches
                  (id, league_id, begin_at, status, number_of_games,
                   team1_id, team1_name, team1_acronym, team1_image_url, team1_score,
                   team2_id, team2_name, team2_acronym, team2_image_url, team2_score,
                   serie_name, source, updated_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                """,
                (
                    m["id"], m["league_id"], m["begin_at"], m["status"],
                    m["number_of_games"], m["team1_id"], m["team1_name"],
                    m["team1_acronym"], m["team1_image_url"], m["team1_score"],
                    m["team2_id"], m["team2_name"], m["team2_acronym"],
                    m["team2_image_url"], m["team2_score"],
                    m.get("serie_name"), m.get("source", "leaguepedia"), now,
                ),
            )
        await db.commit()


async def upsert_game(game: dict[str, Any]) -> None:
    async with aiosqlite.connect(_DB_PATH) as db:
        await db.execute(
            """
            INSERT OR REPLACE INTO esports_games
              (id, match_id, game_number, duration, winner_team_id, blue_team_id, red_team_id)
            VALUES (?,?,?,?,?,?,?)
            """,
            (
                game["id"], game["match_id"], game.get("game_number", 1),
                game.get("duration"), game.get("winner_team_id"),
                game.get("blue_team_id"), game.get("red_team_id"),
            ),
        )
        await db.commit()


async def upsert_game_players(game_id: int, players: list[dict[str, Any]]) -> None:
    async with aiosqlite.connect(_DB_PATH) as db:
        await db.execute("DELETE FROM esports_game_players WHERE game_id = ?", (game_id,))
        for p in players:
            player_info  = p.get("player") or {}
            team_info    = p.get("team") or {}
            champ_info   = p.get("champion") or {}
            await db.execute(
                """
                INSERT INTO esports_game_players
                  (game_id, player_name, team_id, team_name, champion_name, champion_image,
                   kills, deaths, assists, total_gold, damage_dealt)
                VALUES (?,?,?,?,?,?,?,?,?,?,?)
                """,
                (
                    game_id,
                    player_info.get("name") or p.get("name", ""),
                    team_info.get("id"),
                    team_info.get("name", ""),
                    champ_info.get("name", ""),
                    champ_info.get("image_url", ""),
                    p.get("kills", 0),
                    p.get("deaths", 0),
                    p.get("assists", 0),
                    p.get("total_gold", 0),
                    p.get("total_damage_dealt_to_champions", 0),
                ),
            )
        await db.commit()


async def upsert_league_icon(league_name: str, icon_url: str) -> None:
    now = datetime.now(timezone.utc).isoformat()
    async with aiosqlite.connect(_DB_PATH) as db:
        await db.execute(
            "INSERT OR REPLACE INTO esports_league_icons (league_name, icon_url, updated_at) VALUES (?,?,?)",
            (league_name, icon_url, now),
        )
        await db.commit()


async def get_league_icons() -> dict[str, str]:
    async with aiosqlite.connect(_DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT league_name, icon_url FROM esports_league_icons") as cur:
            return {row["league_name"]: row["icon_url"] async for row in cur}


async def get_match_by_id(match_id: int) -> dict[str, Any] | None:
    async with aiosqlite.connect(_DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM esports_matches WHERE id = ?", (match_id,)
        ) as cur:
            row = await cur.fetchone()
    return dict(row) if row else None


async def get_match_games(match_id: int) -> list[dict[str, Any]]:
    async with aiosqlite.connect(_DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM esports_games WHERE match_id = ? ORDER BY game_number ASC",
            (match_id,),
        ) as cur:
            games = [dict(row) async for row in cur]

        for game in games:
            async with db.execute(
                "SELECT * FROM esports_game_players WHERE game_id = ? ORDER BY total_gold DESC",
                (game["id"],),
            ) as cur:
                game["players"] = [dict(row) async for row in cur]

    return games


async def get_matches(league_id: int, limit: int = 15) -> list[dict[str, Any]]:
    """
    時系列順で返す: 過去10件（古→新） + 進行中 + 未開始5件（早→遅）
    初期スクロール位置を「直近の予定試合」に合わせるための並び順。
    """
    async with aiosqlite.connect(_DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        # 完了: 直近10件を古い順で返す（時系列表示用）
        async with db.execute(
            """
            SELECT * FROM esports_matches
            WHERE league_id = ? AND status IN ('finished','canceled')
            ORDER BY begin_at DESC LIMIT 10
            """,
            (league_id,),
        ) as cur:
            finished = list(reversed([dict(row) async for row in cur]))

        # 進行中 + 未開始: 5件（開始日時昇順）
        async with db.execute(
            """
            SELECT * FROM esports_matches
            WHERE league_id = ? AND status IN ('running','not_started')
            ORDER BY begin_at ASC LIMIT 5
            """,
            (league_id,),
        ) as cur:
            upcoming = [dict(row) async for row in cur]

    running = [m for m in upcoming if m["status"] == "running"]
    pending = [m for m in upcoming if m["status"] == "not_started"]
    # 時系列: 過去(古→新) → 進行中 → 未開始
    return finished + running + pending
