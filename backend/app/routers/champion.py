"""
チャンピオン関連エンドポイント
GET /api/champions              - 全チャンピオン一覧（日本語名付き）
GET /api/champions/stats        - 全チャンピオン統計（ティアリスト）
GET /api/champions/{id}         - チャンピオン詳細
GET /api/champions/{id}/stats   - チャンピオン単体ポジション別統計
GET /api/champions/{id}/builds  - チャンピオンビルド推奨
"""
import logging
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Path, Query, UploadFile, File

from app.core.config import settings
from app.deps import get_cache, get_champion_service
from app.models.build import BuildRecommendation
from app.models.champion import (
    ChampionDetail,
    ChampionListResponse,
    ChampionStatsSummary,
    PositionStats,
    PatchWinRate,
    ItemSlotStats,
)
from app.services.champion import ChampionService
from app.services.champion_stats import (
    get_all_champion_stats,
    get_single_champion_stats,
    get_available_patches,
    get_rank_quality,
    get_champion_patch_history,
    get_champion_item_stats,
)

logger = logging.getLogger(__name__)
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
    "/patches",
    response_model=list[str],
    summary="利用可能なパッチ一覧",
    description="指定ランク帯でデータが存在するパッチ番号の一覧を返します（新しい順）。",
)
async def list_champion_patches(
    rank: Annotated[str, Query(description="ランク帯")] = "CHALLENGER",
    cache=Depends(get_cache),
) -> list[str]:
    return await get_available_patches(rank, cache)


@router.get(
    "/rank-quality",
    response_model=list[dict],
    summary="ランク帯別データ品質",
    description="各ランク帯の最新パッチにおける試合数を返します。1000件未満はデータ不足の目安です。",
)
async def list_rank_quality(cache=Depends(get_cache)) -> list[dict]:
    return await get_rank_quality(cache)


@router.get(
    "/stats",
    response_model=list[ChampionStatsSummary],
    summary="全チャンピオン統計（ティアリスト）",
    description=(
        "全チャンピオンの勝率・ピック率・バン率・ティアを取得します。"
        "rank でランク帯、patch でパッチ番号を指定可能（省略時は最新パッチ）。"
        "結果は1時間Redisにキャッシュされます。"
    ),
)
async def list_champion_stats(
    rank:     Annotated[str, Query(description="ランク帯")] = "CHALLENGER",
    patch:    Annotated[str | None, Query(description="パッチ番号（例: 16.9）")] = None,
    position: Annotated[str | None, Query(description="ポジション（TOP/JUNGLE/MID/ADC/SUPPORT）")] = None,
    cache=Depends(get_cache),
) -> list[ChampionStatsSummary]:
    data = await get_all_champion_stats(rank, cache, patch, position)
    return [ChampionStatsSummary(**d) for d in data]


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


@router.get(
    "/{champion_id}/stats",
    response_model=list[PositionStats],
    summary="チャンピオン単体ポジション別統計",
    description=(
        "指定チャンピオンの全ポジション別勝率・ピック率・バン率を返します。"
        "rank パラメータでランク帯を指定可能。"
        "結果は1時間Redisにキャッシュされます。"
    ),
)
async def get_champion_stats(
    champion_id: Annotated[str, Path(pattern=_CHAMPION_ID_PATTERN, description="チャンピオン英語ID")],
    rank: Annotated[str, Query(description="ランク帯")] = "PLATINUM_PLUS",
    cache=Depends(get_cache),
) -> list[PositionStats]:
    data = await get_single_champion_stats(champion_id, rank, cache)
    return [PositionStats(**d) for d in data]


@router.get(
    "/{champion_id}/history",
    response_model=list[PatchWinRate],
    summary="チャンピオンパッチ別勝率履歴",
    description="指定チャンピオンのパッチ別勝率推移を返します（全ポジション合計）。",
)
async def get_champion_history(
    champion_id: Annotated[str, Path(pattern=_CHAMPION_ID_PATTERN, description="チャンピオン英語ID")],
    rank:        Annotated[str, Query(description="ランク帯")] = "CHALLENGER",
    cache=Depends(get_cache),
) -> list[PatchWinRate]:
    data = await get_champion_patch_history(champion_id, rank, cache)
    return [PatchWinRate(**d) for d in data]


@router.get(
    "/{champion_id}/items",
    response_model=list[ItemSlotStats],
    summary="チャンピオンアイテム購入統計",
    description="指定チャンピオンのスロット別人気アイテムを返します。",
)
async def get_champion_item_stats_endpoint(
    champion_id: Annotated[str, Path(pattern=_CHAMPION_ID_PATTERN, description="チャンピオン英語ID")],
    rank:     Annotated[str, Query(description="ランク帯")]         = "CHALLENGER",
    patch:    Annotated[str | None, Query(description="パッチ番号")] = None,
    position: Annotated[str | None, Query(description="ポジション")] = None,
    cache=Depends(get_cache),
) -> list[ItemSlotStats]:
    data = await get_champion_item_stats(champion_id, rank, cache, patch, position)
    return [ItemSlotStats(**d) for d in data]


_ALLOWED_TABLES = {"champion_stats_meta", "champion_stats_aggregate", "champion_item_stats"}


def _filter_sql_lines(sql_text: str) -> list[str]:
    """許可テーブルへのDELETE/INSERTのみを抽出する"""
    result = []
    for line in sql_text.splitlines():
        line = line.strip()
        if not line or line.startswith("--"):
            continue
        if line.upper().startswith(("PRAGMA", "BEGIN", "COMMIT", "ROLLBACK")):
            continue
        for tbl in _ALLOWED_TABLES:
            if tbl in line:
                result.append(line)
                break
    return result



@router.post(
    "/admin/cache-clear",
    summary="チャンピオン統計キャッシュクリア（一時管理用）",
    include_in_schema=False,
)
async def clear_champion_cache(
    x_update_secret: str = Header(...),
    cache=Depends(get_cache),
) -> dict:
    if not settings.update_secret or x_update_secret != settings.update_secret:
        raise HTTPException(status_code=401, detail="Unauthorized")
    prefixes = [
        "champion_stats_all:",
        "champion_stats_single:",
        "champion_history:",
        "champion_items:",
        "champion_patches:",
        "champion_rank_quality",
    ]
    cleared = 0
    for prefix in prefixes:
        try:
            cleared += await cache.delete_pattern(f"{prefix}*")
        except Exception:
            pass
    logger.info("キャッシュクリア完了: %d件", cleared)
    return {"status": "ok", "cleared": cleared}


@router.get(
    "/{champion_id}/builds",
    response_model=BuildRecommendation,
    summary="チャンピオンビルド推奨取得",
    description=(
        "指定チャンピオンのロール（Fighter/Mage等）に基づくビルド推奨を返します。"
        "コアアイテム・キーストーン・サブスタイルルーンを含みます。"
        "Data Dragon 公式データを元にした推奨であり、マッチ統計ではありません。"
        "結果は24時間Redisにキャッシュされます。"
    ),
)
async def get_champion_builds(
    champion_id: Annotated[str, Path(pattern=_CHAMPION_ID_PATTERN, description="チャンピオン英語ID（例: Aatrox）")],
    service: Annotated[ChampionService, Depends(get_champion_service)],
) -> BuildRecommendation:
    return await service.get_champion_builds(champion_id)
