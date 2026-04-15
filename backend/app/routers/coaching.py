"""
AI コーチング関連エンドポイント
POST /api/coaching/analyze - チャンピオン統計から日本語コーチングアドバイスを生成
"""
import logging
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator

from app.deps import get_current_user
from app.models.user import UserResponse
from app.services.coaching_service import CoachingService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/coaching", tags=["coaching"])


# -------------------------------------------------------------------
# Pydantic v2 リクエスト / レスポンスモデル
# -------------------------------------------------------------------

class CoachingRequest(BaseModel):
    """コーチング分析リクエスト"""

    champion_name: str = Field(
        ...,
        min_length=1,
        max_length=50,
        description="チャンピオン名（例: 'Jinx'）",
        examples=["Jinx"],
    )
    role: str = Field(
        ...,
        min_length=1,
        max_length=20,
        description="ロール（例: 'ADC', 'JUNGLE', 'MID', 'TOP', 'SUPPORT'）",
        examples=["ADC"],
    )
    recent_stats: dict[str, Any] = Field(
        ...,
        description="直近の統計データ（kda, win_rate, cs_per_min など）",
        examples=[{"kda": 3.2, "win_rate": 55.0, "cs_per_min": 6.8, "games": 20}],
    )
    rank: str = Field(
        default="UNRANKED",
        max_length=30,
        description="プレイヤーのランク文字列（例: 'GOLD IV'）",
        examples=["GOLD IV"],
    )

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        allowed = {"TOP", "JUNGLE", "MID", "ADC", "SUPPORT", "FILL"}
        normalized = v.upper()
        if normalized not in allowed:
            raise ValueError(
                f"ロールは次のいずれかを指定してください: {', '.join(sorted(allowed))}"
            )
        return normalized

    @field_validator("recent_stats")
    @classmethod
    def validate_recent_stats(cls, v: dict[str, Any]) -> dict[str, Any]:
        if not v:
            raise ValueError("recent_stats は空にできません")
        if len(v) > 50:
            raise ValueError("recent_stats のキー数が多すぎます（最大50）")
        return v


class CoachingAdvice(BaseModel):
    """コーチングアドバイスレスポンス"""

    champion_name: str = Field(description="分析対象のチャンピオン名")
    role: str = Field(description="ロール")
    summary: str = Field(description="一言まとめ")
    strengths: list[str] = Field(description="強み（2〜3項目）")
    improvements: list[str] = Field(description="改善点（2〜3項目）")
    tips: list[str] = Field(description="実践的なチップス（3〜5項目）")
    is_mock: bool = Field(
        description="モックデータかどうか（True: 開発用モック, False: Claude APIによる実分析）"
    )


# -------------------------------------------------------------------
# 依存性注入
# -------------------------------------------------------------------

def get_coaching_service() -> CoachingService:
    """CoachingService のインスタンスを返す"""
    return CoachingService()


# -------------------------------------------------------------------
# エンドポイント
# -------------------------------------------------------------------

@router.post(
    "/analyze",
    response_model=CoachingAdvice,
    summary="AI コーチング分析",
    description=(
        "チャンピオン名・ロール・直近統計を元に日本語コーチングアドバイスを生成します。"
        "ANTHROPIC_API_KEY が設定されている場合は Claude API で実分析を行い、"
        "未設定の場合はモックデータを返します（is_mock: true）。"
        "ログイン必須・プレミアム会員限定機能です。"
    ),
    responses={
        200: {"description": "コーチングアドバイスを返却"},
        422: {"description": "リクエストバリデーションエラー"},
        500: {"description": "コーチング分析中に内部エラーが発生"},
    },
)
async def analyze_coaching(
    body: CoachingRequest,
    service: Annotated[CoachingService, Depends(get_coaching_service)],
    current_user: Annotated[UserResponse, Depends(get_current_user)],
) -> CoachingAdvice:
    if not current_user.is_premium:
        raise HTTPException(status_code=403, detail="この機能はプレミアム会員限定です")
    """
    チャンピオン統計データから AI コーチングアドバイスを生成する。

    - **champion_name**: チャンピオン名（例: "Jinx"）
    - **role**: ロール（TOP / JUNGLE / MID / ADC / SUPPORT / FILL）
    - **recent_stats**: KDA・勝率・CS/min 等の統計辞書
    - **rank**: プレイヤーランク（例: "GOLD IV"、省略時 UNRANKED）
    """
    logger.info(
        "コーチング分析リクエスト受信: champion=%s, role=%s, rank=%s",
        body.champion_name,
        body.role,
        body.rank,
    )

    try:
        result = await service.analyze_champion_coaching(
            champion_name=body.champion_name,
            role=body.role,
            recent_stats=body.recent_stats,
            rank=body.rank,
        )
    except Exception as exc:
        logger.exception(
            "コーチング分析中にエラーが発生しました: champion=%s, role=%s",
            body.champion_name,
            body.role,
        )
        raise HTTPException(
            status_code=500,
            detail="コーチング分析中にエラーが発生しました。しばらくしてから再度お試しください。",
        ) from exc

    return CoachingAdvice(
        champion_name=body.champion_name,
        role=body.role,
        summary=result["summary"],
        strengths=result.get("strengths", []),
        improvements=result.get("improvements", []),
        tips=result.get("tips", []),
        is_mock=result.get("is_mock", True),
    )
