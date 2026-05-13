"""
ローカル LOL.db → Railway PostgreSQL 同期スクリプト

使い方:
  cd backend
  python sync_railway.py

.env の RAILWAY_DATABASE_URL を使って migrate_sqlite_to_postgres.py を実行します。
"""
import asyncio
import logging
import os
import sys

sys.path.insert(0, ".")
from dotenv import dotenv_values

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)


def main() -> None:
    # .env を直接パースして RAILWAY_DATABASE_URL を取得
    # （load_dotenv を使うと Pydantic Settings がフィールドを拒否するため）
    env = dotenv_values(".env")
    railway_url = env.get("RAILWAY_DATABASE_URL")
    if not railway_url:
        logger.error("RAILWAY_DATABASE_URL が .env に設定されていません")
        sys.exit(1)

    logger.info("Railway PostgreSQL に同期します...")
    logger.info("接続先: %s", railway_url.split("@")[-1])

    # Pydantic Settings が .env より os.environ を優先するため先に上書き
    os.environ["DATABASE_URL"] = railway_url

    # 実際に設定された DATABASE_URL を表示して確認
    from app.core.config import settings
    actual = settings.database_url
    if "railway" not in actual and "rlwy" not in actual:
        logger.error("DATABASE_URL がローカルを向いています: %s", actual.split("@")[-1])
        logger.error("ローカルの .env の DATABASE_URL が上書きされていません")
        sys.exit(1)
    logger.info("接続確認OK: %s", actual.split("@")[-1])

    from migrate_sqlite_to_postgres import migrate
    asyncio.run(migrate())


if __name__ == "__main__":
    main()
