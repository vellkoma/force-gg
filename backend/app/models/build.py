"""
ビルド推奨関連 Pydantic v2 モデル定義
"""
from pydantic import BaseModel, Field


class ItemInfo(BaseModel):
    """アイテム情報モデル"""

    id: int = Field(..., description="アイテムID")
    name: str = Field(..., description="アイテム日本語名")
    description: str = Field(..., description="アイテムの説明文（HTMLタグ除去済み）")
    image_url: str = Field(..., description="アイテム画像URL")
    gold_total: int = Field(..., description="アイテム合計コスト（ゴールド）")


class RuneInfo(BaseModel):
    """ルーン情報モデル"""

    id: int = Field(..., description="ルーンID")
    name: str = Field(..., description="ルーン日本語名")
    icon: str = Field(..., description="Data Dragon の icon パス")
    description: str = Field(..., description="ルーンの説明文（HTMLタグ除去済み）")


class BuildRecommendation(BaseModel):
    """チャンピオンビルド推奨レスポンス"""

    champion_id: str = Field(..., description="チャンピオン英語ID（例: Aatrox）")
    version: str = Field(..., description="Data Dragon バージョン（例: 14.24.1）")
    core_items: list[ItemInfo] = Field(
        ...,
        description="推奨コアアイテム（スターター含む最大5件）",
    )
    rune_primary: RuneInfo = Field(..., description="推奨キーストーンルーン")
    rune_secondary: RuneInfo = Field(..., description="推奨サブスタイルのパスルーン")
    source: str = Field(default="data_dragon", description="データソース識別子")
