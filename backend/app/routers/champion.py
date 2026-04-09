"""
チャンピオン関連エンドポイント
GET /api/champions         - 全チャンピオン一覧（日本語名付き）
GET /api/champions/{id}   - チャンピオン詳細
"""
from typing import Annotated

from fastapi import APIRouter, Depends, Path

from app.deps import get_champion_service
from app.models.champion import ChampionDetail, ChampionListResponse
from app.services.champion import ChampionService

router = APIRouter(prefix="/api/champions", tags=["champion"])

# チャンピオンIDのバリデーションパターン（英字始まり、英数字のみ、最大31文字）
_CHAMPION_ID_PATTERN = r"^[A-Za-z][A-Za-z0-9]{1,30}$"


@router.get(
    "",
    response_model=ChampionListResponse,
    summary="チャンピオン一覧取得",
    description=(
        "Data Dragon から全チャンピオン一覧を取得します。"
        "日本語名・タグ・アイコン画像URLを含みます。"
        "結果は1時間Redisにキャッシュされます。"
    ),
)
async def list_champions(
    service: Annotated[ChampionService, Depends(get_champion_service)],
) -> ChampionListResponse:
    return await service.get_all_champions()


@router.get(
    "/{champion_id}",
    response_model=ChampionDetail,
    summary="チャンピオン詳細取得",
    description=(
        "指定した英語IDのチャンピオン詳細データを取得します。"
        "（例: Aatrox, Jinx, MissFortune）"
    ),
)
async def get_champion(
    champion_id: Annotated[str, Path(pattern=_CHAMPION_ID_PATTERN, description="チャンピオン英語ID")],
    service: Annotated[ChampionService, Depends(get_champion_service)],
) -> ChampionDetail:
    return await service.get_champion_by_id(champion_id)
