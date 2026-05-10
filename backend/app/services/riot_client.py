"""
Riot Games API 共有非同期HTTPクライアント
JP1（日本サーバー）と ASIA リージョンの両方に対応する
レート制限（429）ハンドリングとリトライロジックを含む
"""
import asyncio
import logging

import httpx
from fastapi import HTTPException

from app.core.config import settings

logger = logging.getLogger(__name__)

# リトライ設定
MAX_RETRIES = 3
DEFAULT_RETRY_AFTER = 1  # Retry-After ヘッダーがない場合のデフォルト待機秒数


class RiotClient:
    """
    Riot Games API への非同期HTTPクライアント
    - 429レート制限: Retry-After ヘッダーを読んで asyncio.sleep 後にリトライ（最大3回）
    - 404: HTTPException(404) で日本語メッセージ
    - 403: HTTPException(403) でAPIキー無効メッセージ
    - タイムアウト: HTTPException(504)
    """

    def __init__(self) -> None:
        self._headers = {"X-Riot-Token": settings.riot_api_key}
        self._jp1 = settings.jp1_base_url
        self._asia = settings.asia_base_url

    async def _get(self, url: str) -> dict | list:
        """
        レート制限・リトライ付きGETリクエスト
        429が来た場合は Retry-After 秒待機後にリトライする（最大 MAX_RETRIES 回）
        """
        last_error: Exception | None = None

        for attempt in range(1, MAX_RETRIES + 1):
            try:
                async with httpx.AsyncClient(timeout=15.0) as client:
                    resp = await client.get(url, headers=self._headers)

                if resp.status_code == 429:
                    retry_after = int(resp.headers.get("Retry-After", DEFAULT_RETRY_AFTER))
                    logger.warning(
                        "Riot API レート制限 (429): %d秒後にリトライ [%d/%d] URL=%s",
                        retry_after,
                        attempt,
                        MAX_RETRIES,
                        url,
                    )
                    if attempt < MAX_RETRIES:
                        await asyncio.sleep(retry_after)
                        continue
                    # 最終リトライでも429の場合
                    raise HTTPException(
                        status_code=429,
                        detail="Riot APIのレート制限に達しました。しばらく時間をおいてから再試行してください",
                    )

                if resp.status_code == 404:
                    raise HTTPException(
                        status_code=404,
                        detail="指定されたデータが見つかりません",
                    )

                if resp.status_code == 403:
                    raise HTTPException(
                        status_code=403,
                        detail="Riot APIキーが無効または期限切れです",
                    )

                if resp.status_code == 401:
                    raise HTTPException(
                        status_code=401,
                        detail="Riot APIキーが設定されていません",
                    )

                resp.raise_for_status()
                return resp.json()

            except HTTPException:
                # HTTPException はそのまま上位に伝播させる
                raise
            except httpx.TimeoutException:
                last_error = HTTPException(
                    status_code=504,
                    detail="Riot APIへの接続がタイムアウトしました",
                )
                logger.warning("Riot APIタイムアウト [%d/%d] URL=%s", attempt, MAX_RETRIES, url)
                if attempt < MAX_RETRIES:
                    await asyncio.sleep(1)
                    continue
            except httpx.RequestError as e:
                last_error = HTTPException(
                    status_code=503,
                    detail=f"Riot APIへの接続に失敗しました: {str(e)}",
                )
                logger.warning(
                    "Riot API接続エラー [%d/%d] URL=%s: %s", attempt, MAX_RETRIES, url, str(e)
                )
                if attempt < MAX_RETRIES:
                    await asyncio.sleep(1)
                    continue

        # すべてのリトライが失敗した場合
        if last_error is not None:
            raise last_error
        raise HTTPException(status_code=503, detail="Riot APIへの接続に失敗しました")

    # ------------------------------------------------------------------
    # Account API (ASIA)
    # ------------------------------------------------------------------

    async def get_account_by_riot_id(self, game_name: str, tag_line: str) -> dict:
        """
        Riot ID（ゲーム名#タグライン）からアカウント情報（PUUID等）を取得する
        エンドポイント: GET {ASIA}/riot/account/v1/accounts/by-riot-id/{gameName}/{tagLine}
        """
        url = f"{self._asia}/riot/account/v1/accounts/by-riot-id/{game_name}/{tag_line}"
        result = await self._get(url)
        return result  # type: ignore[return-value]

    # ------------------------------------------------------------------
    # Summoner API (JP1)
    # ------------------------------------------------------------------

    async def get_summoner_by_puuid(self, puuid: str) -> dict:
        """
        PUUIDからサモナー情報を取得する
        エンドポイント: GET {JP1}/lol/summoner/v4/summoners/by-puuid/{puuid}
        """
        url = f"{self._jp1}/lol/summoner/v4/summoners/by-puuid/{puuid}"
        result = await self._get(url)
        return result  # type: ignore[return-value]

    # ------------------------------------------------------------------
    # League API (JP1)
    # ------------------------------------------------------------------

    async def get_summoner_by_id(self, summoner_id: str) -> dict:
        """
        サモナーIDからサモナー情報（PUUID含む）を取得する
        エンドポイント: GET {JP1}/lol/summoner/v4/summoners/{summonerId}
        """
        url = f"{self._jp1}/lol/summoner/v4/summoners/{summoner_id}"
        result = await self._get(url)
        return result  # type: ignore[return-value]

    async def get_challenger_league(self, queue: str = "RANKED_SOLO_5x5") -> dict:
        """
        チャレンジャーリーグのエントリ一覧を取得する
        エンドポイント: GET {JP1}/lol/league/v4/challengerleagues/by-queue/{queue}
        戻り値: {tier, leagueId, queue, name, entries: [{summonerId, leaguePoints, ...}]}
        """
        url = f"{self._jp1}/lol/league/v4/challengerleagues/by-queue/{queue}"
        result = await self._get(url)
        return result  # type: ignore[return-value]

    async def get_grandmaster_league(self, queue: str = "RANKED_SOLO_5x5") -> dict:
        """
        グランドマスターリーグのエントリ一覧を取得する
        エンドポイント: GET {JP1}/lol/league/v4/grandmasterleagues/by-queue/{queue}
        """
        url = f"{self._jp1}/lol/league/v4/grandmasterleagues/by-queue/{queue}"
        result = await self._get(url)
        return result  # type: ignore[return-value]

    async def get_master_league(self, queue: str = "RANKED_SOLO_5x5") -> dict:
        """
        マスターリーグのエントリ一覧を取得する
        エンドポイント: GET {JP1}/lol/league/v4/masterleagues/by-queue/{queue}
        """
        url = f"{self._jp1}/lol/league/v4/masterleagues/by-queue/{queue}"
        result = await self._get(url)
        return result  # type: ignore[return-value]

    async def get_league_entries(
        self, tier: str, division: str = "I", queue: str = "RANKED_SOLO_5x5", page: int = 1
    ) -> list:
        """
        指定ティア・ディビジョンのランクエントリ一覧を取得する
        エンドポイント: GET {JP1}/lol/league/v4/entries/{tier}/{division}
        tier: DIAMOND, EMERALD, PLATINUM, GOLD, SILVER, BRONZE, IRON
        """
        url = f"{self._jp1}/lol/league/v4/entries/{tier}/{division}?queue={queue}&page={page}"
        result = await self._get(url)
        return result  # type: ignore[return-value]

    async def get_ranked_stats(self, summoner_id: str) -> list:
        """
        サモナーIDからランク情報一覧を取得する
        エンドポイント: GET {JP1}/lol/league/v4/entries/by-summoner/{summonerId}
        戻り値: ソロキュー・フレックスを含む list[dict]
        """
        url = f"{self._jp1}/lol/league/v4/entries/by-summoner/{summoner_id}"
        result = await self._get(url)
        return result  # type: ignore[return-value]

    async def get_ranked_stats_by_puuid(self, puuid: str) -> list:
        """
        PUUIDからランク情報一覧を取得する（新API・summonerId不要）
        エンドポイント: GET {JP1}/lol/league/v4/entries/by-puuid/{puuid}
        """
        url = f"{self._jp1}/lol/league/v4/entries/by-puuid/{puuid}"
        result = await self._get(url)
        return result  # type: ignore[return-value]

    # ------------------------------------------------------------------
    # Match API (ASIA)
    # ------------------------------------------------------------------

    async def get_match_ids(
        self,
        puuid: str,
        count: int = 20,
        queue: int | None = None,
        start_time: int | None = None,
        end_time: int | None = None,
    ) -> list:
        """
        PUUIDからマッチID一覧を取得する
        エンドポイント: GET {ASIA}/lol/match/v5/matches/by-puuid/{puuid}/ids
        queue=None: 全ゲームモード
        queue=420: ランク戦ソロ, 440: フレックス, 450: ARAM, 900: URF
        start_time/end_time: Unixタイム（秒）で期間絞り込み
        """
        params: dict[str, str | int] = {"count": count}
        if queue is not None:
            params["queue"] = queue
        if start_time is not None:
            params["startTime"] = start_time
        if end_time is not None:
            params["endTime"] = end_time
        qs = "&".join(f"{k}={v}" for k, v in params.items())
        url = f"{self._asia}/lol/match/v5/matches/by-puuid/{puuid}/ids?{qs}"
        result = await self._get(url)
        return result  # type: ignore[return-value]

    async def get_match(self, match_id: str) -> dict:
        """
        マッチIDから試合詳細を取得する
        エンドポイント: GET {ASIA}/lol/match/v5/matches/{matchId}
        matchId形式: JP1_XXXXXXXXXX
        """
        url = f"{self._asia}/lol/match/v5/matches/{match_id}"
        result = await self._get(url)
        return result  # type: ignore[return-value]

    async def get_match_timeline(self, match_id: str) -> dict:
        """
        マッチタイムラインを取得する
        エンドポイント: GET {ASIA}/lol/match/v5/matches/{matchId}/timeline
        ゴールド・経験値・レベルの時系列データとアイテム購入イベントを含む
        """
        url = f"{self._asia}/lol/match/v5/matches/{match_id}/timeline"
        result = await self._get(url)
        return result  # type: ignore[return-value]
