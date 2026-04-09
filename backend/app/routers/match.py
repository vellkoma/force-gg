"""
マッチ履歴関連エンドポイント（スケルトン）
GET /api/matches/{puuid}           - マッチID一覧
GET /api/matches/{puuid}/{match_id} - マッチ詳細
"""
from fastapi import APIRouter

router = APIRouter(prefix="/api/matches", tags=["match"])


@router.get(
    "/{puuid}",
    summary="マッチID一覧取得",
    description="PUUIDからマッチID一覧を取得します（未実装）",
)
async def list_matches(puuid: str, count: int = 20) -> dict:
    # TODO: Phase 2で実装
    # matchIdは JP1_ プレフィックス付きで返ってくる
    # queue=420 (ランク戦) でフィルタリングする
    return {
        "message": "このエンドポイントはPhase 2で実装予定です",
        "puuid": puuid,
        "count": count,
    }


@router.get(
    "/{puuid}/{match_id}",
    summary="マッチ詳細取得",
    description="マッチIDから試合詳細を取得します（未実装）",
)
async def get_match(puuid: str, match_id: str) -> dict:
    # TODO: Phase 2で実装
    # matchIdは JP1_ プレフィックス付き（例: JP1_1234567890）
    # キャッシュTTL: 86400秒（試合結果は不変）
    return {
        "message": "このエンドポイントはPhase 2で実装予定です",
        "puuid": puuid,
        "match_id": match_id,
    }
