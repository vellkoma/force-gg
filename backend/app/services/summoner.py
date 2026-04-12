"""
サモナーサービス
Riot Account / Summoner / League API を組み合わせてサモナープロフィールを構築する
Redisキャッシュ（TTL: settings.cache_ttl_summoner）を使用する
"""
import logging

from fastapi import HTTPException

from app.cache.redis import CacheClient
from app.core.config import settings
from app.models.summoner import AccountInfo, RankedEntry, SummonerInfo, SummonerProfile
from app.services.riot_client import RiotClient

logger = logging.getLogger(__name__)

# キャッシュキープレフィックス
CACHE_KEY_SUMMONER = "summoner:{game_name}#{tag_line}"


class SummonerService:
    """
    サモナープロフィール取得サービス
    account → summoner → ranked_stats の順に Riot API を呼び出し、
    結果をキャッシュに保存して SummonerProfile として返す
    """

    def __init__(self, riot: RiotClient, cache: CacheClient) -> None:
        self._riot = riot
        self._cache = cache

    async def get_summoner_profile(self, game_name: str, tag_line: str) -> SummonerProfile:
        """
        Riot ID（ゲーム名 + タグライン）からサモナープロフィールを取得する

        キャッシュキー: "summoner:{game_name}#{tag_line}"
        TTL: settings.cache_ttl_summoner（デフォルト600秒）

        手順:
        1. アカウント情報（PUUID）取得
        2. PUUID でサモナー情報取得
        3. サモナーID でランク情報取得
        """
        cache_key = CACHE_KEY_SUMMONER.format(game_name=game_name, tag_line=tag_line)

        # キャッシュヒット確認
        cached = await self._cache.get(cache_key)
        if cached and isinstance(cached, dict):
            logger.debug("サモナープロフィールをキャッシュから返却: %s#%s", game_name, tag_line)
            return SummonerProfile.model_validate(cached)

        # 1. アカウント情報（PUUID）取得
        logger.info("Riot Account API 呼び出し: %s#%s", game_name, tag_line)
        account_raw = await self._riot.get_account_by_riot_id(game_name, tag_line)
        account = AccountInfo(
            puuid=account_raw["puuid"],
            game_name=account_raw["gameName"],
            tag_line=account_raw["tagLine"],
        )

        # 2. PUUID でサモナー情報取得
        logger.info("Summoner API 呼び出し: puuid=%s", account.puuid)
        summoner_raw = await self._riot.get_summoner_by_puuid(account.puuid)
        summoner = SummonerInfo(
            id=summoner_raw.get("id", ""),
            account_id=summoner_raw.get("accountId", ""),
            puuid=summoner_raw.get("puuid", account.puuid),
            profile_icon_id=summoner_raw["profileIconId"],
            summoner_level=summoner_raw["summonerLevel"],
        )

        # 3. ランク情報取得（PUUIDベースの新APIを優先、fallbackでsummonerId）
        logger.info("League API 呼び出し: puuid=%s", account.puuid)
        ranked_raw: list = await self._riot.get_ranked_stats_by_puuid(account.puuid)
        ranked_stats = [
            RankedEntry(
                queue_type=entry["queueType"],
                tier=entry["tier"],
                rank=entry["rank"],
                league_points=entry["leaguePoints"],
                wins=entry["wins"],
                losses=entry["losses"],
            )
            for entry in ranked_raw
            # RANKED_SOLO_5x5 と RANKED_FLEX_SR のみ対象
            if entry.get("queueType") in ("RANKED_SOLO_5x5", "RANKED_FLEX_SR")
        ]

        profile = SummonerProfile(
            account=account,
            summoner=summoner,
            ranked_stats=ranked_stats,
        )

        # キャッシュに保存
        await self._cache.set(
            cache_key,
            profile.model_dump(),
            settings.cache_ttl_summoner,
        )
        logger.info(
            "サモナープロフィールをキャッシュに保存: %s#%s (TTL=%ds)",
            game_name,
            tag_line,
            settings.cache_ttl_summoner,
        )

        return profile
