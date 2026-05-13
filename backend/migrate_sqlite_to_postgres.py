"""
SQLite (LOL.db) → PostgreSQL 移行スクリプト

使い方:
  1. PostgreSQL をインストール・起動する
  2. データベースを作成する:
       createdb forcegg
  3. .env に DATABASE_URL を設定する:
       DATABASE_URL=postgresql://postgres:your_password@localhost:5432/forcegg
  4. このスクリプトを実行する:
       cd backend
       python migrate_sqlite_to_postgres.py

注意:
  - 移行先 PostgreSQL のテーブルは init_db() で自動作成されます
  - 既存データは ON CONFLICT DO UPDATE でマージされます（冪等）
"""
import asyncio
import logging
import sqlite3
import sys

sys.path.insert(0, ".")
from dotenv import load_dotenv
load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

SQLITE_PATH = "LOL.db"


def read_sqlite(table: str, columns: list[str]) -> list[dict]:
    conn = sqlite3.connect(SQLITE_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    try:
        cur.execute(f"SELECT {', '.join(columns)} FROM {table}")
        return [dict(row) for row in cur.fetchall()]
    except sqlite3.OperationalError as e:
        logger.warning("テーブル読み込みスキップ (%s): %s", table, e)
        return []
    finally:
        conn.close()


async def migrate() -> None:
    from app.services import esports_db as db

    logger.info("=== SQLite → PostgreSQL 移行 開始 ===")
    logger.info("SQLite: %s", SQLITE_PATH)

    # PostgreSQL 初期化（テーブル作成）
    await db.init_db()
    pool = db._pool_or_raise()

    # ─── esports_matches ──────────────────────────────────────
    rows = read_sqlite("esports_matches", [
        "id", "league_id", "begin_at", "status", "number_of_games",
        "team1_id", "team1_name", "team1_acronym", "team1_image_url", "team1_score",
        "team2_id", "team2_name", "team2_acronym", "team2_image_url", "team2_score",
        "serie_name", "source", "updated_at",
    ])
    if rows:
        async with pool.acquire() as conn:
            async with conn.transaction():
                await conn.executemany(
                    """
                    INSERT INTO esports_matches (
                        id, league_id, begin_at, status, number_of_games,
                        team1_id, team1_name, team1_acronym, team1_image_url, team1_score,
                        team2_id, team2_name, team2_acronym, team2_image_url, team2_score,
                        serie_name, source, updated_at
                    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
                    ON CONFLICT (id) DO UPDATE SET
                        status       = EXCLUDED.status,
                        team1_score  = EXCLUDED.team1_score,
                        team2_score  = EXCLUDED.team2_score,
                        updated_at   = EXCLUDED.updated_at
                    """,
                    [(
                        r["id"], r["league_id"], r["begin_at"], r["status"], r["number_of_games"],
                        r["team1_id"], r["team1_name"], r["team1_acronym"], r["team1_image_url"], r["team1_score"],
                        r["team2_id"], r["team2_name"], r["team2_acronym"], r["team2_image_url"], r["team2_score"],
                        r["serie_name"], r["source"], r["updated_at"],
                    ) for r in rows],
                )
        logger.info("esports_matches: %d件 移行完了", len(rows))

    # ─── esports_sync_log ─────────────────────────────────────
    rows = read_sqlite("esports_sync_log", ["league_id", "last_synced_at"])
    if rows:
        async with pool.acquire() as conn:
            async with conn.transaction():
                await conn.executemany(
                    """
                    INSERT INTO esports_sync_log (league_id, last_synced_at) VALUES ($1, $2)
                    ON CONFLICT (league_id) DO UPDATE SET last_synced_at = EXCLUDED.last_synced_at
                    """,
                    [(r["league_id"], r["last_synced_at"]) for r in rows],
                )
        logger.info("esports_sync_log: %d件 移行完了", len(rows))

    # ─── esports_league_icons ─────────────────────────────────
    rows = read_sqlite("esports_league_icons", ["league_name", "icon_url", "updated_at"])
    if rows:
        async with pool.acquire() as conn:
            async with conn.transaction():
                await conn.executemany(
                    """
                    INSERT INTO esports_league_icons (league_name, icon_url, updated_at) VALUES ($1, $2, $3)
                    ON CONFLICT (league_name) DO UPDATE SET
                        icon_url = EXCLUDED.icon_url, updated_at = EXCLUDED.updated_at
                    """,
                    [(r["league_name"], r["icon_url"], r["updated_at"]) for r in rows],
                )
        logger.info("esports_league_icons: %d件 移行完了", len(rows))

    # ─── champion_stats_meta ──────────────────────────────────
    rows = read_sqlite("champion_stats_meta", ["patch", "rank_group", "total_games", "updated_at"])
    if rows:
        async with pool.acquire() as conn:
            async with conn.transaction():
                await conn.executemany(
                    """
                    INSERT INTO champion_stats_meta (patch, rank_group, total_games, updated_at)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (patch, rank_group) DO UPDATE SET
                        total_games = EXCLUDED.total_games, updated_at = EXCLUDED.updated_at
                    """,
                    [(r["patch"], r.get("rank_group", "CHALLENGER"), r["total_games"], r["updated_at"]) for r in rows],
                )
        logger.info("champion_stats_meta: %d件 移行完了", len(rows))

    # ─── champion_stats_aggregate ─────────────────────────────
    rows = read_sqlite("champion_stats_aggregate", [
        "champion_name", "position", "patch", "rank_group",
        "wins", "picks", "bans", "total_games", "updated_at",
    ])
    if rows:
        CHUNK = 1000
        total = 0
        async with pool.acquire() as conn:
            for i in range(0, len(rows), CHUNK):
                chunk = rows[i : i + CHUNK]
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
                        [(
                            r["champion_name"], r["position"], r["patch"],
                            r.get("rank_group", "CHALLENGER"),
                            r["wins"], r["picks"], r["bans"], r["total_games"], r["updated_at"],
                        ) for r in chunk],
                    )
                total += len(chunk)
                logger.info("  champion_stats_aggregate: %d / %d件", total, len(rows))
        logger.info("champion_stats_aggregate: %d件 移行完了", len(rows))

    # ─── champion_item_stats ──────────────────────────────────
    rows = read_sqlite("champion_item_stats", [
        "champion_name", "position", "patch", "rank_group",
        "slot", "item_id", "item_count", "total_picks", "updated_at",
    ])
    if rows:
        CHUNK = 2000
        total = 0
        async with pool.acquire() as conn:
            for i in range(0, len(rows), CHUNK):
                chunk = rows[i : i + CHUNK]
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
                        [(
                            r["champion_name"], r["position"], r["patch"],
                            r.get("rank_group", "CHALLENGER"),
                            r["slot"], r["item_id"], r["item_count"], r["total_picks"], r["updated_at"],
                        ) for r in chunk],
                    )
                total += len(chunk)
                logger.info("  champion_item_stats: %d / %d件", total, len(rows))
        logger.info("champion_item_stats: %d件 移行完了", len(rows))

    # ─── patch_date_ranges ────────────────────────────────────
    rows = read_sqlite("patch_date_ranges", ["patch", "start_time", "end_time", "updated_at"])
    if rows:
        async with pool.acquire() as conn:
            async with conn.transaction():
                await conn.executemany(
                    """
                    INSERT INTO patch_date_ranges (patch, start_time, end_time, updated_at)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (patch) DO UPDATE SET
                        start_time = LEAST(patch_date_ranges.start_time, EXCLUDED.start_time),
                        end_time   = GREATEST(patch_date_ranges.end_time, EXCLUDED.end_time),
                        updated_at = EXCLUDED.updated_at
                    """,
                    [(r["patch"], r["start_time"], r["end_time"], r["updated_at"]) for r in rows],
                )
        logger.info("patch_date_ranges: %d件 移行完了", len(rows))

    await db.close_db()
    logger.info("=== 移行完了 ===")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--target-url",
        default=None,
        help="移行先 PostgreSQL の接続URL（省略時は .env の DATABASE_URL を使用）",
    )
    args = parser.parse_args()

    if args.target_url:
        # .env より引数を優先するため環境変数に上書き
        import os
        os.environ["DATABASE_URL"] = args.target_url

    asyncio.run(migrate())
