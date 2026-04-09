"""
サモナー関連エンドポイント（スケルトン）
GET /api/summoner/{game_name}/{tag_line} - サモナー情報・ランク取得
"""
from fastapi import APIRouter

router = APIRouter(prefix="/api/summoner", tags=["summoner"])


@router.get(
    "/{game_name}/{tag_line}",
    summary="サモナー情報取得",
    description="Riot IDからサモナー情報とランク情報を取得します（未実装）",
)
async def get_summoner(game_name: str, tag_line: str) -> dict:
    # TODO: Phase 2で実装
    # 1. RiotClient.get_account(game_name, tag_line) でPUUID取得
    # 2. RiotClient.get_summoner_by_puuid(puuid) でサモナー情報取得
    # 3. RiotClient.get_ranked_stats(summoner_id) でランク情報取得
    return {
        "message": "このエンドポイントはPhase 2で実装予定です",
        "game_name": game_name,
        "tag_line": tag_line,
    }
