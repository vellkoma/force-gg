"""
サモナー関連エンドポイント
GET /api/summoner/{game_name}/{tag_line} - サモナー情報・ランク取得
"""
from typing import Annotated

from fastapi import APIRouter, Depends, Path

from app.deps import get_summoner_service
from app.models.summoner import SummonerProfile
from app.services.summoner import SummonerService

router = APIRouter(prefix="/api/summoner", tags=["summoner"])


@router.get(
    "/{game_name}/{tag_line}",
    response_model=SummonerProfile,
    summary="サモナー情報取得",
    description=(
        "Riot ID（ゲーム名#タグライン）からサモナー情報・ランク情報を取得します。"
        "結果は10分間キャッシュされます。"
    ),
)
async def get_summoner(
    game_name: Annotated[
        str,
        Path(
            min_length=1,
            max_length=50,
            description="ゲーム名（例: Faker、ぷりん）",
            examples=["Faker"],
        ),
    ],
    tag_line: Annotated[
        str,
        Path(
            pattern=r"^[A-Za-z0-9]{1,10}$",
            description="タグライン（例: JP1）",
            examples=["JP1"],
        ),
    ],
    service: Annotated[SummonerService, Depends(get_summoner_service)],
) -> SummonerProfile:
    """
    Riot ID からサモナープロフィールを返す

    - account: PUUID・Riot ID
    - summoner: サモナーレベル・プロフィールアイコンID
    - ranked_stats: ソロキュー・フレックスのランク情報（未配置の場合は空リスト）
    """
    return await service.get_summoner_profile(game_name, tag_line)
