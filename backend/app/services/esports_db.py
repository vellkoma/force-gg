"""
Esports スケジュール PostgreSQL DB サービス
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

import asyncpg

from app.core.config import settings

logger = logging.getLogger(__name__)

_pool: asyncpg.Pool | None = None


def _pool_or_raise() -> asyncpg.Pool:
    if _pool is None:
        raise RuntimeError("DB pool が初期化されていません")
    return _pool


async def init_db() -> None:
    global _pool
    if _pool is not None:
        return
    _pool = await asyncpg.create_pool(settings.database_url, min_size=2, max_size=10)

    async with _pool.acquire() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS esports_matches (
                id              BIGINT  PRIMARY KEY,
                league_id       BIGINT  NOT NULL,
                begin_at        TEXT    NOT NULL,
                status          TEXT    NOT NULL,
                number_of_games INTEGER NOT NULL DEFAULT 3,
                team1_id        BIGINT,
                team1_name      TEXT,
                team1_acronym   TEXT,
                team1_image_url TEXT,
                team1_score     INTEGER DEFAULT 0,
                team2_id        BIGINT,
                team2_name      TEXT,
                team2_acronym   TEXT,
                team2_image_url TEXT,
                team2_score     INTEGER DEFAULT 0,
                serie_name      TEXT,
                source          TEXT    DEFAULT 'leaguepedia',
                updated_at      TEXT    NOT NULL
            )
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS esports_sync_log (
                league_id      BIGINT PRIMARY KEY,
                last_synced_at TEXT   NOT NULL
            )
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_matches_league_begin
                ON esports_matches (league_id, begin_at)
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS esports_games (
                id             BIGINT  PRIMARY KEY,
                match_id       BIGINT  NOT NULL,
                game_number    INTEGER DEFAULT 1,
                duration       INTEGER,
                winner_team_id BIGINT,
                blue_team_id   BIGINT,
                red_team_id    BIGINT
            )
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS esports_game_players (
                id            BIGSERIAL PRIMARY KEY,
                game_id       BIGINT NOT NULL,
                player_name   TEXT   NOT NULL,
                team_id       BIGINT,
                team_name     TEXT,
                champion_name  TEXT,
                champion_image TEXT,
                kills         INTEGER DEFAULT 0,
                deaths        INTEGER DEFAULT 0,
                assists       INTEGER DEFAULT 0,
                total_gold    INTEGER DEFAULT 0,
                damage_dealt  INTEGER DEFAULT 0
            )
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_game_players_game
                ON esports_game_players (game_id)
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS esports_league_icons (
                league_name TEXT PRIMARY KEY,
                icon_url    TEXT NOT NULL,
                updated_at  TEXT NOT NULL
            )
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS champion_stats_aggregate (
                champion_name TEXT NOT NULL,
                position      TEXT NOT NULL,
                patch         TEXT NOT NULL,
                rank_group    TEXT NOT NULL DEFAULT 'CHALLENGER',
                wins          INTEGER DEFAULT 0,
                picks         INTEGER DEFAULT 0,
                bans          INTEGER DEFAULT 0,
                total_games   INTEGER DEFAULT 0,
                updated_at    TEXT NOT NULL,
                PRIMARY KEY (champion_name, position, patch, rank_group)
            )
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS champion_stats_meta (
                patch       TEXT NOT NULL,
                rank_group  TEXT NOT NULL DEFAULT 'CHALLENGER',
                total_games INTEGER DEFAULT 0,
                updated_at  TEXT NOT NULL,
                PRIMARY KEY (patch, rank_group)
            )
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS champion_item_stats (
                champion_name TEXT    NOT NULL,
                position      TEXT    NOT NULL,
                patch         TEXT    NOT NULL,
                rank_group    TEXT    NOT NULL DEFAULT 'CHALLENGER',
                slot          INTEGER NOT NULL,
                item_id       INTEGER NOT NULL,
                item_count    INTEGER DEFAULT 0,
                total_picks   INTEGER DEFAULT 0,
                updated_at    TEXT    NOT NULL,
                PRIMARY KEY (champion_name, position, patch, rank_group, slot, item_id)
            )
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS patch_date_ranges (
                patch      TEXT    PRIMARY KEY,
                start_time BIGINT  NOT NULL,
                end_time   BIGINT  NOT NULL,
                updated_at TEXT    NOT NULL
            )
        """)

        # 旧PandaScore形式のleague_id（小さい整数）を削除
        # 現在のleague_idはlolesports形式（98767991...）で14桁以上
        await conn.execute("DELETE FROM esports_matches WHERE league_id < 1000000000000000")
        await conn.execute("DELETE FROM esports_sync_log WHERE league_id < 1000000000000000")

    logger.info("PostgreSQL DB 初期化完了")


async def close_db() -> None:
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


async def get_last_synced(league_id: int) -> datetime | None:
    pool = _pool_or_raise()
    row = await pool.fetchrow(
        "SELECT last_synced_at FROM esports_sync_log WHERE league_id = $1",
        league_id,
    )
    if row:
        return datetime.fromisoformat(row["last_synced_at"])
    return None


async def update_sync_log(league_id: int) -> None:
    now = datetime.now(timezone.utc).isoformat()
    pool = _pool_or_raise()
    await pool.execute(
        """
        INSERT INTO esports_sync_log (league_id, last_synced_at) VALUES ($1, $2)
        ON CONFLICT (league_id) DO UPDATE SET last_synced_at = EXCLUDED.last_synced_at
        """,
        league_id, now,
    )


async def upsert_matches(matches: list[dict[str, Any]]) -> None:
    now = datetime.now(timezone.utc).isoformat()
    pool = _pool_or_raise()
    rows = [
        (
            m["id"], m["league_id"], m["begin_at"], m["status"],
            m["number_of_games"], m["team1_id"], m["team1_name"],
            m["team1_acronym"], m["team1_image_url"], m["team1_score"],
            m["team2_id"], m["team2_name"], m["team2_acronym"],
            m["team2_image_url"], m["team2_score"],
            m.get("serie_name"), m.get("source", "leaguepedia"), now,
        )
        for m in matches
    ]
    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.executemany(
                """
                INSERT INTO esports_matches
                  (id, league_id, begin_at, status, number_of_games,
                   team1_id, team1_name, team1_acronym, team1_image_url, team1_score,
                   team2_id, team2_name, team2_acronym, team2_image_url, team2_score,
                   serie_name, source, updated_at)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
                ON CONFLICT (id) DO UPDATE SET
                  league_id       = EXCLUDED.league_id,
                  begin_at        = EXCLUDED.begin_at,
                  status          = EXCLUDED.status,
                  number_of_games = EXCLUDED.number_of_games,
                  team1_id        = EXCLUDED.team1_id,
                  team1_name      = EXCLUDED.team1_name,
                  team1_acronym   = EXCLUDED.team1_acronym,
                  team1_image_url = EXCLUDED.team1_image_url,
                  team1_score     = EXCLUDED.team1_score,
                  team2_id        = EXCLUDED.team2_id,
                  team2_name      = EXCLUDED.team2_name,
                  team2_acronym   = EXCLUDED.team2_acronym,
                  team2_image_url = EXCLUDED.team2_image_url,
                  team2_score     = EXCLUDED.team2_score,
                  serie_name      = EXCLUDED.serie_name,
                  source          = EXCLUDED.source,
                  updated_at      = EXCLUDED.updated_at
                """,
                rows,
            )


async def upsert_game(game: dict[str, Any]) -> None:
    pool = _pool_or_raise()
    await pool.execute(
        """
        INSERT INTO esports_games
          (id, match_id, game_number, duration, winner_team_id, blue_team_id, red_team_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT (id) DO UPDATE SET
          match_id       = EXCLUDED.match_id,
          game_number    = EXCLUDED.game_number,
          duration       = EXCLUDED.duration,
          winner_team_id = EXCLUDED.winner_team_id,
          blue_team_id   = EXCLUDED.blue_team_id,
          red_team_id    = EXCLUDED.red_team_id
        """,
        game["id"], game["match_id"], game.get("game_number", 1),
        game.get("duration"), game.get("winner_team_id"),
        game.get("blue_team_id"), game.get("red_team_id"),
    )


async def upsert_game_players(game_id: int, players: list[dict[str, Any]]) -> None:
    pool = _pool_or_raise()
    rows = []
    for p in players:
        player_info = p.get("player") or {}
        team_info   = p.get("team") or {}
        champ_info  = p.get("champion") or {}
        rows.append((
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
        ))
    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute("DELETE FROM esports_game_players WHERE game_id = $1", game_id)
            await conn.executemany(
                """
                INSERT INTO esports_game_players
                  (game_id, player_name, team_id, team_name, champion_name, champion_image,
                   kills, deaths, assists, total_gold, damage_dealt)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
                """,
                rows,
            )


async def upsert_league_icon(league_name: str, icon_url: str) -> None:
    now = datetime.now(timezone.utc).isoformat()
    pool = _pool_or_raise()
    await pool.execute(
        """
        INSERT INTO esports_league_icons (league_name, icon_url, updated_at) VALUES ($1, $2, $3)
        ON CONFLICT (league_name) DO UPDATE SET
          icon_url   = EXCLUDED.icon_url,
          updated_at = EXCLUDED.updated_at
        """,
        league_name, icon_url, now,
    )


async def get_league_icons() -> dict[str, str]:
    pool = _pool_or_raise()
    rows = await pool.fetch("SELECT league_name, icon_url FROM esports_league_icons")
    return {row["league_name"]: row["icon_url"] for row in rows}


async def get_match_by_id(match_id: int) -> dict[str, Any] | None:
    pool = _pool_or_raise()
    row = await pool.fetchrow("SELECT * FROM esports_matches WHERE id = $1", match_id)
    return dict(row) if row else None


async def get_match_games(match_id: int) -> list[dict[str, Any]]:
    pool = _pool_or_raise()
    game_rows = await pool.fetch(
        "SELECT * FROM esports_games WHERE match_id = $1 ORDER BY game_number ASC",
        match_id,
    )
    games = [dict(r) for r in game_rows]
    for game in games:
        player_rows = await pool.fetch(
            "SELECT * FROM esports_game_players WHERE game_id = $1 ORDER BY total_gold DESC",
            game["id"],
        )
        game["players"] = [dict(r) for r in player_rows]
    return games


async def get_matches(league_id: int, limit: int = 15) -> list[dict[str, Any]]:
    """
    時系列順で返す: 過去10件（古→新） + 進行中 + 未開始5件（早→遅）
    初期スクロール位置を「直近の予定試合」に合わせるための並び順。
    """
    pool = _pool_or_raise()
    cutoff = (datetime.now(timezone.utc) - timedelta(days=365)).isoformat()

    # 完了: 直近10件を古い順で返す（時系列表示用）、1年以内のみ
    # status が running/not_started のまま放置された過去試合も完了扱いで含める
    finished_rows = await pool.fetch(
        """
        SELECT * FROM esports_matches
        WHERE league_id = $1 AND begin_at >= $2
          AND (status IN ('finished','canceled')
               OR begin_at < NOW() - INTERVAL '6 hours')
        ORDER BY begin_at DESC LIMIT 10
        """,
        league_id, cutoff,
    )
    finished = [{**dict(r), "status": "finished" if r["status"] in ("running", "not_started") else r["status"]}
                for r in reversed(finished_rows)]

    # 進行中 + 未開始: 5件（開始日時昇順）
    upcoming_rows = await pool.fetch(
        """
        SELECT * FROM esports_matches
        WHERE league_id = $1 AND status IN ('running','not_started')
          AND begin_at > NOW() - INTERVAL '6 hours'
        ORDER BY begin_at ASC LIMIT 5
        """,
        league_id,
    )
    upcoming = [dict(r) for r in upcoming_rows]

    running = [m for m in upcoming if m["status"] == "running"]
    pending = [m for m in upcoming if m["status"] == "not_started"]
    # 時系列: 過去(古→新) → 進行中 → 未開始
    return finished + running + pending


# ─── チャンピオン統計集計 ──────────────────────────────────────────

async def upsert_champion_stats(rows: list[dict[str, Any]]) -> None:
    pool = _pool_or_raise()
    data = [
        (
            r["champion_name"], r["position"], r["patch"],
            r.get("rank_group", "CHALLENGER"),
            r["wins"], r["picks"], r["bans"], r["total_games"], r["updated_at"],
        )
        for r in rows
    ]
    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.executemany(
                """
                INSERT INTO champion_stats_aggregate
                  (champion_name, position, patch, rank_group, wins, picks, bans, total_games, updated_at)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
                ON CONFLICT (champion_name, position, patch, rank_group) DO UPDATE SET
                  wins        = EXCLUDED.wins,
                  picks       = EXCLUDED.picks,
                  bans        = EXCLUDED.bans,
                  total_games = EXCLUDED.total_games,
                  updated_at  = EXCLUDED.updated_at
                """,
                data,
            )


async def upsert_champion_stats_meta(patch: str, total_games: int, updated_at: str, rank_group: str = "CHALLENGER") -> None:
    pool = _pool_or_raise()
    await pool.execute(
        """
        INSERT INTO champion_stats_meta (patch, rank_group, total_games, updated_at) VALUES ($1,$2,$3,$4)
        ON CONFLICT (patch, rank_group) DO UPDATE SET
          total_games = EXCLUDED.total_games,
          updated_at  = EXCLUDED.updated_at
        """,
        patch, rank_group, total_games, updated_at,
    )


async def get_latest_patch(rank_group: str = "CHALLENGER") -> str | None:
    pool = _pool_or_raise()
    val = await pool.fetchval(
        "SELECT patch FROM champion_stats_meta WHERE rank_group = $1 ORDER BY updated_at DESC LIMIT 1",
        rank_group,
    )
    return val


async def get_rank_game_counts() -> list[dict[str, Any]]:
    """各ランク帯の最新パッチにおける total_games を返す"""
    pool = _pool_or_raise()
    rows = await pool.fetch(
        """
        SELECT rank_group, total_games, patch
        FROM champion_stats_meta
        WHERE (rank_group, updated_at) IN (
            SELECT rank_group, MAX(updated_at)
            FROM champion_stats_meta
            GROUP BY rank_group
        )
        """
    )
    return [dict(r) for r in rows]


async def get_available_patches(rank_group: str = "CHALLENGER") -> list[str]:
    pool = _pool_or_raise()
    rows = await pool.fetch(
        "SELECT DISTINCT patch FROM champion_stats_meta WHERE rank_group = $1 ORDER BY patch DESC",
        rank_group,
    )
    return [r["patch"] for r in rows]


async def get_champion_stats_latest(
    rank_group: str = "CHALLENGER",
    patch: str | None = None,
    position: str | None = None,
) -> list[dict[str, Any]]:
    if patch is None:
        patch = await get_latest_patch(rank_group)
    if not patch:
        return []
    pool = _pool_or_raise()
    if position and position != "ALL":
        rows = await pool.fetch(
            "SELECT * FROM champion_stats_aggregate WHERE patch = $1 AND rank_group = $2 AND position = $3",
            patch, rank_group, position,
        )
    else:
        rows = await pool.fetch(
            "SELECT * FROM champion_stats_aggregate WHERE patch = $1 AND rank_group = $2",
            patch, rank_group,
        )
    return [dict(r) for r in rows]


async def upsert_champion_item_stats(rows: list[dict[str, Any]]) -> None:
    pool = _pool_or_raise()
    data = [
        (
            r["champion_name"], r["position"], r["patch"],
            r.get("rank_group", "CHALLENGER"),
            r["slot"], r["item_id"], r["item_count"],
            r["total_picks"], r["updated_at"],
        )
        for r in rows
    ]
    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.executemany(
                """
                INSERT INTO champion_item_stats
                  (champion_name, position, patch, rank_group, slot, item_id, item_count, total_picks, updated_at)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
                ON CONFLICT (champion_name, position, patch, rank_group, slot, item_id) DO UPDATE SET
                  item_count  = EXCLUDED.item_count,
                  total_picks = EXCLUDED.total_picks,
                  updated_at  = EXCLUDED.updated_at
                """,
                data,
            )


async def get_champion_item_stats(
    champion_name: str,
    rank_group: str = "CHALLENGER",
    patch: str | None = None,
    position: str | None = None,
) -> list[dict[str, Any]]:
    if patch is None:
        patch = await get_latest_patch(rank_group)
    if not patch:
        return []
    pool = _pool_or_raise()
    if position and position not in ("ALL", ""):
        rows = await pool.fetch(
            """
            SELECT slot, item_id, SUM(item_count) AS item_count, SUM(total_picks) AS total_picks
            FROM champion_item_stats
            WHERE champion_name = $1 AND patch = $2 AND rank_group = $3 AND position = $4
            GROUP BY slot, item_id
            ORDER BY slot ASC, item_count DESC
            """,
            champion_name, patch, rank_group, position,
        )
    else:
        rows = await pool.fetch(
            """
            SELECT slot, item_id, SUM(item_count) AS item_count, SUM(total_picks) AS total_picks
            FROM champion_item_stats
            WHERE champion_name = $1 AND patch = $2 AND rank_group = $3
            GROUP BY slot, item_id
            ORDER BY slot ASC, item_count DESC
            """,
            champion_name, patch, rank_group,
        )
    return [dict(r) for r in rows]


async def get_champion_patch_history(
    champion_name: str,
    rank_group: str = "CHALLENGER",
) -> list[dict[str, Any]]:
    """チャンピオンのパッチ別勝率履歴（全ポジション集計）"""
    pool = _pool_or_raise()
    rows = await pool.fetch(
        """
        SELECT
            a.patch,
            SUM(a.wins)  AS total_wins,
            SUM(a.picks) AS total_picks,
            MAX(a.bans)  AS bans,
            m.total_games
        FROM champion_stats_aggregate a
        JOIN champion_stats_meta m ON m.patch = a.patch AND m.rank_group = a.rank_group
        WHERE a.champion_name = $1 AND a.rank_group = $2
        GROUP BY a.patch, m.total_games
        ORDER BY a.patch ASC
        """,
        champion_name, rank_group,
    )
    return [dict(r) for r in rows]


async def get_champion_stats_single(champion_name: str, rank_group: str = "CHALLENGER", patch: str | None = None) -> list[dict[str, Any]]:
    if patch is None:
        patch = await get_latest_patch(rank_group)
    if not patch:
        return []
    pool = _pool_or_raise()
    rows = await pool.fetch(
        "SELECT * FROM champion_stats_aggregate WHERE champion_name = $1 AND patch = $2 AND rank_group = $3 ORDER BY picks DESC",
        champion_name, patch, rank_group,
    )
    return [dict(r) for r in rows]


async def get_patch_date_range(patch: str) -> dict[str, int] | None:
    """パッチの収集済み期間（start_time / end_time）を返す。未登録なら None。"""
    # major.minor のみで検索（"16.9.1" → "16.9"）
    parts = patch.split(".")
    major_minor = f"{parts[0]}.{parts[1]}"
    pool = _pool_or_raise()
    row = await pool.fetchrow(
        "SELECT start_time, end_time FROM patch_date_ranges WHERE patch = $1",
        major_minor,
    )
    return dict(row) if row else None


async def upsert_patch_date_range(patch: str, start_time: int, end_time: int) -> None:
    """パッチ期間を upsert する。既存より広い範囲なら拡張する。"""
    parts = patch.split(".")
    major_minor = f"{parts[0]}.{parts[1]}"
    now = datetime.now(timezone.utc).isoformat()
    pool = _pool_or_raise()
    await pool.execute(
        """
        INSERT INTO patch_date_ranges (patch, start_time, end_time, updated_at)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (patch) DO UPDATE SET
          start_time = LEAST(patch_date_ranges.start_time, EXCLUDED.start_time),
          end_time   = GREATEST(patch_date_ranges.end_time, EXCLUDED.end_time),
          updated_at = EXCLUDED.updated_at
        """,
        major_minor, start_time, end_time, now,
    )


async def get_teams_missing_logos() -> list[str]:
    """team1_image_url または team2_image_url が空のチーム名一覧"""
    pool = _pool_or_raise()
    rows1 = await pool.fetch(
        "SELECT DISTINCT team1_name FROM esports_matches WHERE team1_image_url = '' OR team1_image_url IS NULL"
    )
    rows2 = await pool.fetch(
        "SELECT DISTINCT team2_name FROM esports_matches WHERE team2_image_url = '' OR team2_image_url IS NULL"
    )
    names = {r["team1_name"] for r in rows1} | {r["team2_name"] for r in rows2}
    return list(names)


async def bulk_update_team_logos(logos: dict[str, str]) -> None:
    """チームロゴURLを一括UPDATE"""
    pool = _pool_or_raise()
    async with pool.acquire() as conn:
        async with conn.transaction():
            for name, url in logos.items():
                await conn.execute(
                    "UPDATE esports_matches SET team1_image_url = $1 WHERE team1_name = $2 AND (team1_image_url = '' OR team1_image_url IS NULL)",
                    url, name,
                )
                await conn.execute(
                    "UPDATE esports_matches SET team2_image_url = $1 WHERE team2_name = $2 AND (team2_image_url = '' OR team2_image_url IS NULL)",
                    url, name,
                )
