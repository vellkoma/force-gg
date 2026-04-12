"""
マッチ履歴関連エンドポイント
GET /api/matches/{puuid}?count=20&queue=420 - マッチ履歴一覧取得
"""
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Path, Query

from app.deps import get_match_service
from app.models.match import MatchListResponse, MatchTimeline
from app.services.match import MatchService

router = APIRouter(prefix="/api/matches", tags=["match"])

# サポートするキューID（None = 全モード）
SUPPORTED_QUEUES = {420, 440, 450, 480, 700, 900, 1020, 1300, 1400, 1700, 1710, 1810, 1820, 1830, 1840, 1900}


@router.get(
    "/{puuid}",
    response_model=MatchListResponse,
    summary="マッチ履歴取得",
    description=(
        "PUUIDからマッチ履歴を取得します。"
        "queue を省略すると全ゲームモードを取得します。"
        "queue=420: ランク戦ソロ, 440: ランク戦フレックス, "
        "450: ARAM（ランダムミッド）, 900: URF（ランダムミッドメイヘム）。"
        "マッチID一覧は1時間、試合詳細は24時間キャッシュされます。"
    ),
)
async def get_match_history(
    puuid: Annotated[
        str,
        Path(
            description="プレイヤーのPUUID",
        ),
    ],
    service: Annotated[MatchService, Depends(get_match_service)],
    count: Annotated[
        int,
        Query(
            ge=1,
            le=100,
            description="取得するマッチ数（1〜100、デフォルト: 50）",
        ),
    ] = 50,
    queue: Annotated[
        Optional[int],
        Query(
            description="キューID（420: ランク戦ソロ, 440: フレックス, 450: ARAM, 900: URF, 省略: 全モード）",
        ),
    ] = None,
) -> MatchListResponse:
    """
    PUUID からマッチ履歴を返す

    - matches: 各試合の詳細情報一覧
      - info: 試合時間・ゲームモード・キューID
      - participants: 全参加者（10人）の統計
      - my_stats: 検索したPUUIDの参加者統計（KDA・CS・ダメージ等）
    - puuid: 検索に使用したPUUID
    """
    return await service.get_match_history(puuid, count=count, queue=queue)


@router.get(
    "/{match_id}/timeline",
    response_model=MatchTimeline,
    summary="マッチタイムライン取得",
    description=(
        "マッチIDとPUUIDからゴールド・経験値・レベルの時系列データと"
        "アイテム購入履歴を取得します。結果は24時間キャッシュされます。"
    ),
)
async def get_match_timeline(
    match_id: Annotated[str, Path(description="マッチID（例: JP1_XXXXXXXXXX）")],
    puuid: Annotated[str, Query(description="プレイヤーのPUUID")],
    service: Annotated[MatchService, Depends(get_match_service)],
) -> MatchTimeline:
    return await service.get_match_timeline(match_id, puuid)
