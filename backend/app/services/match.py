"""
マッチサービス
Riot Match v5 API を呼び出してマッチ履歴を構築する
マッチID一覧と試合詳細を並列取得し、Redisキャッシュを使用する
"""
import asyncio
import logging

from fastapi import HTTPException
from app.cache.redis import CacheClient
from app.core.config import settings
from app.models.match import (
    ItemEvent, MatchDetail, MatchInfo, MatchListResponse, MatchTimeline,
    ParticipantFrameData, ParticipantMeta, ParticipantStats, TimelineFrame,
)
from app.services.riot_client import RiotClient

logger = logging.getLogger(__name__)

# キャッシュキープレフィックス
CACHE_KEY_MATCH_LIST = "match_list:{puuid}:{count}"
CACHE_KEY_MATCH_DETAIL = "match_detail:{match_id}"

# Riot API への同時リクエスト数上限（dev key: 20 req/sec, 100 req/2min）
# キャッシュヒット分は消費しないため 5 で十分余裕を持てる
_RIOT_SEMAPHORE = asyncio.Semaphore(5)


class MatchService:
    """
    マッチ履歴取得サービス
    - match_ids: キャッシュTTL = settings.cache_ttl_match_list（3600秒）
    - match_detail: キャッシュTTL = settings.cache_ttl_match_detail（86400秒・不変）
    - 試合詳細は asyncio.gather で並列取得する
    """

    def __init__(self, riot: RiotClient, cache: CacheClient) -> None:
        self._riot = riot
        self._cache = cache

    def _parse_participant(self, raw: dict) -> ParticipantStats:
        """Match v5 API の participants[*] 生データを ParticipantStats に変換する"""
        return ParticipantStats(
            puuid=raw["puuid"],
            champion_name=raw["championName"],
            champion_id=raw["championId"],
            kills=raw["kills"],
            deaths=raw["deaths"],
            assists=raw["assists"],
            win=raw["win"],
            total_damage_dealt_to_champions=raw["totalDamageDealtToChampions"],
            gold_earned=raw["goldEarned"],
            # CS = ミニオン + ジャングルモンスター
            cs=raw["totalMinionsKilled"] + raw["neutralMinionsKilled"],
            vision_score=raw["visionScore"],
            summoner1_id=raw["summoner1Id"],
            summoner2_id=raw["summoner2Id"],
            item0=raw["item0"],
            item1=raw["item1"],
            item2=raw["item2"],
            item3=raw["item3"],
            item4=raw["item4"],
            item5=raw["item5"],
            item6=raw["item6"],
            player_augment1=raw.get("playerAugment1", 0),
            player_augment2=raw.get("playerAugment2", 0),
            player_augment3=raw.get("playerAugment3", 0),
            player_augment4=raw.get("playerAugment4", 0),
            individual_position=raw.get("individualPosition", ""),
            champ_level=raw.get("champLevel", 1),
            team_id=raw.get("teamId", 100),
            participant_id=raw.get("participantId", 0),
            riot_id_game_name=raw.get("riotIdGameName", ""),
            riot_id_tag_line=raw.get("riotIdTagline", ""),
        )

    def _parse_match_detail(self, match_raw: dict, puuid: str) -> MatchDetail:
        """Match v5 API のレスポンス全体を MatchDetail に変換する"""
        info_raw = match_raw["info"]
        metadata = match_raw["metadata"]

        match_info = MatchInfo(
            match_id=metadata["matchId"],
            game_duration=info_raw["gameDuration"],
            game_mode=info_raw["gameMode"],
            queue_id=info_raw["queueId"],
            game_end_timestamp=info_raw.get("gameEndTimestamp", 0),
        )

        participants = [self._parse_participant(p) for p in info_raw["participants"]]

        # 検索対象のPUUIDと一致する参加者を my_stats として設定
        my_stats = next((p for p in participants if p.puuid == puuid), None)

        return MatchDetail(
            info=match_info,
            participants=participants,
            my_stats=my_stats,
        )

    async def _get_match_detail_cached(self, match_id: str, puuid: str) -> MatchDetail:
        """
        1試合分の詳細を取得する（キャッシュ付き）
        キャッシュキー: "match_detail:{match_id}"
        TTL: settings.cache_ttl_match_detail（86400秒）
        キャッシュヒット時はセマフォを消費しない
        """
        cache_key = CACHE_KEY_MATCH_DETAIL.format(match_id=match_id)

        cached = await self._cache.get(cache_key)
        if cached and isinstance(cached, dict):
            logger.debug("マッチ詳細をキャッシュから返却: %s", match_id)
            detail = MatchDetail.model_validate(cached)
            # my_stats は puuid によって変わるためキャッシュ後に再設定する
            if detail.my_stats is None:
                detail.my_stats = next(
                    (p for p in detail.participants if p.puuid == puuid), None
                )
            return detail

        # キャッシュミス: セマフォで同時リクエスト数を制限してから API 呼び出し
        async with _RIOT_SEMAPHORE:
            # ダブルチェック: セマフォ待ち中に別タスクがキャッシュを埋めた可能性がある
            cached = await self._cache.get(cache_key)
            if cached and isinstance(cached, dict):
                logger.debug("マッチ詳細をキャッシュから返却（セマフォ後）: %s", match_id)
                detail = MatchDetail.model_validate(cached)
                if detail.my_stats is None:
                    detail.my_stats = next(
                        (p for p in detail.participants if p.puuid == puuid), None
                    )
                return detail

            logger.info("Match API 呼び出し: %s", match_id)
            match_raw = await self._riot.get_match(match_id)
            detail = self._parse_match_detail(match_raw, puuid)

            # 試合結果は不変なので長期キャッシュ（my_stats は除外して保存）
            cacheable = MatchDetail(
                info=detail.info,
                participants=detail.participants,
                my_stats=None,  # puuid依存のフィールドはキャッシュしない
            )
            await self._cache.set(
                cache_key,
                cacheable.model_dump(),
                settings.cache_ttl_match_detail,
            )

        return detail

    async def get_match_history(
        self, puuid: str, count: int = 50, queue: int | None = None
    ) -> MatchListResponse:
        """
        PUUIDからマッチ履歴を取得する

        キャッシュキー: "match_list:{puuid}:{queue}:{count}"
        TTL: settings.cache_ttl_match_list（3600秒）

        手順:
        1. match_ids 取得（queue=None の場合は全ゲームモード）
        2. asyncio.gather で各試合詳細を並列取得
        3. my_stats に puuid が一致する参加者を設定
        """
        list_cache_key = CACHE_KEY_MATCH_LIST.format(puuid=puuid, count=count) + f":{queue}"

        # マッチID一覧のキャッシュ確認
        cached_ids = await self._cache.get(list_cache_key)
        if cached_ids and isinstance(cached_ids, list):
            logger.debug("マッチID一覧をキャッシュから取得: puuid=%s count=%d queue=%s", puuid, count, queue)
            match_ids: list[str] = cached_ids
        else:
            logger.info("Match IDs API 呼び出し: puuid=%s count=%d queue=%s", puuid, count, queue)
            match_ids = await self._riot.get_match_ids(puuid, count=count, queue=queue)
            await self._cache.set(list_cache_key, match_ids, settings.cache_ttl_match_list)
            logger.info(
                "マッチID一覧をキャッシュに保存: %d件 (TTL=%ds)",
                len(match_ids),
                settings.cache_ttl_match_list,
            )

        # 各試合詳細を並列取得（1件失敗しても他の結果を返す）
        tasks = [self._get_match_detail_cached(mid, puuid) for mid in match_ids]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        matches: list[MatchDetail] = [r for r in results if isinstance(r, MatchDetail)]

        return MatchListResponse(matches=matches, puuid=puuid)

    async def _get_match_detail_safe(self, match_id: str, puuid: str) -> MatchDetail | None:
        """
        1試合分の詳細を取得する（エラー時は None を返す）
        Riot API が未対応のキュー（queue 2400 等）は 404 になるためスキップする
        """
        try:
            return await self._get_match_detail_cached(match_id, puuid)
        except HTTPException as e:
            if e.status_code == 404:
                logger.debug("マッチ詳細が見つかりません（Riot API未対応）: %s", match_id)
                return None
            raise
        except Exception as e:
            logger.warning("マッチ詳細取得エラー（スキップ）: %s %s", match_id, str(e))
            return None

    async def get_matches_by_ids(self, puuid: str, match_ids: list[str]) -> MatchListResponse:
        """
        指定したマッチIDリストの試合詳細を一括取得する

        LCU API から取得したマッチIDを Riot API で一括照会するために使用する。
        Riot API が未対応のキュー（queue 2400 等）は 404 になりスキップされる。
        """
        tasks = [self._get_match_detail_safe(mid, puuid) for mid in match_ids]
        results = await asyncio.gather(*tasks)
        matches = [r for r in results if r is not None]
        return MatchListResponse(matches=matches, puuid=puuid)

    async def get_match_timeline(self, match_id: str, puuid: str) -> MatchTimeline:
        """
        マッチタイムラインを取得する（キャッシュ付き）
        全参加者のフレームデータ＋検索プレイヤーのアイテム購入を返す

        キャッシュキー: "match_timeline_v2:{match_id}"
        TTL: settings.cache_ttl_match_detail（86400秒・不変）
        """
        cache_key = f"match_timeline_v2:{match_id}"

        cached = await self._cache.get(cache_key)
        if cached and isinstance(cached, dict) and cached.get("puuid") == puuid:
            logger.debug("タイムラインをキャッシュから返却: %s", match_id)
            return MatchTimeline.model_validate(cached["timeline"])

        logger.info("Timeline API 呼び出し: %s", match_id)
        raw = await self._riot.get_match_timeline(match_id)

        metadata = raw["metadata"]
        info = raw["info"]

        # PUUID → participant_id マッピング（0-indexed → 1-indexed）
        puuids: list[str] = metadata.get("participants", [])
        try:
            my_participant_id = puuids.index(puuid) + 1
        except ValueError:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="タイムラインにPUUIDが見つかりません")

        # 参加者メタ情報（championNameはmatch detailから来るため空文字で初期化）
        participant_metas: list[ParticipantMeta] = [
            ParticipantMeta(
                participant_id=idx + 1,
                puuid=p_puuid,
                champion_name="",  # フロントエンド側でParticipantStatsと突合
                team_id=100 if (idx + 1) <= 5 else 200,
            )
            for idx, p_puuid in enumerate(puuids)
        ]

        frames: list[TimelineFrame] = []
        item_purchases: list[ItemEvent] = []

        for frame in info.get("frames", []):
            ts: int = frame["timestamp"]
            second = ts // 1000

            # 全参加者のフレームデータを収集
            pf_map: dict = frame.get("participantFrames", {})
            frame_data: list[ParticipantFrameData] = []
            for pid_str, pf in pf_map.items():
                pid = int(pid_str)
                frame_data.append(ParticipantFrameData(
                    participant_id=pid,
                    total_gold=pf.get("totalGold", 0),
                    xp=pf.get("xp", 0),
                    level=pf.get("level", 1),
                ))

            frames.append(TimelineFrame(
                timestamp_ms=ts,
                second=second,
                data=sorted(frame_data, key=lambda d: d.participant_id),
            ))

            # 検索プレイヤーのアイテム購入イベント
            for event in frame.get("events", []):
                if (
                    event.get("type") == "ITEM_PURCHASED"
                    and event.get("participantId") == my_participant_id
                ):
                    evt_ts: int = event["timestamp"]
                    item_purchases.append(ItemEvent(
                        timestamp_ms=evt_ts,
                        second=evt_ts // 1000,
                        item_id=event["itemId"],
                    ))

        timeline = MatchTimeline(
            match_id=match_id,
            my_participant_id=my_participant_id,
            participant_metas=participant_metas,
            frames=frames,
            item_purchases=sorted(item_purchases, key=lambda e: e.timestamp_ms),
        )

        await self._cache.set(
            cache_key,
            {"puuid": puuid, "timeline": timeline.model_dump()},
            settings.cache_ttl_match_detail,
        )

        return timeline
