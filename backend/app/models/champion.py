"""
チャンピオン関連 Pydantic v2 モデル定義
"""
from pydantic import BaseModel, Field, computed_field
from typing import Optional


class ChampionSummary(BaseModel):
    """チャンピオン一覧用の軽量モデル"""

    id: str = Field(..., description="チャンピオン英語ID（例: Aatrox）")
    key: str = Field(..., description="チャンピオン数値キー（例: 266）")
    name: str = Field(..., description="チャンピオン日本語名（例: アートロックス）")
    title: str = Field(..., description="チャンピオンの肩書き（日本語）")
    image_url: str = Field(..., description="チャンピオンアイコン画像URL")
    tags: list[str] = Field(default_factory=list, description="ロールタグ（例: Fighter, Tank）")


class ChampionStats(BaseModel):
    """チャンピオンの基本スペック"""

    hp: float
    hp_per_level: float = Field(..., alias="hpperlevel")
    mp: float
    mp_per_level: float = Field(..., alias="mpperlevel")
    armor: float
    armor_per_level: float = Field(..., alias="armorperlevel")
    spell_block: float = Field(..., alias="spellblock")
    spell_block_per_level: float = Field(..., alias="spellblockperlevel")
    attack_damage: float = Field(..., alias="attackdamage")
    attack_damage_per_level: float = Field(..., alias="attackdamageperlevel")
    attack_speed: float = Field(..., alias="attackspeed")
    move_speed: float = Field(..., alias="movespeed")
    attack_range: float = Field(..., alias="attackrange")
    crit: float
    crit_per_level: float = Field(..., alias="critperlevel")

    model_config = {"populate_by_name": True}


class ChampionDetail(BaseModel):
    """チャンピオン詳細モデル（単体取得用）"""

    id: str = Field(..., description="チャンピオン英語ID")
    key: str = Field(..., description="チャンピオン数値キー")
    name: str = Field(..., description="チャンピオン日本語名")
    title: str = Field(..., description="チャンピオンの肩書き")
    image_url: str = Field(..., description="チャンピオンアイコン画像URL")
    tags: list[str] = Field(default_factory=list)
    blurb: str = Field(..., description="チャンピオンの短い説明文")
    stats: ChampionStats
    partype: str = Field(..., description="リソースタイプ（Mana, Energy 等）")


class ChampionListResponse(BaseModel):
    """GET /api/champions のレスポンス"""

    version: str = Field(..., description="Data Dragon バージョン（例: 14.24.1）")
    total: int = Field(..., description="チャンピオン総数")
    champions: list[ChampionSummary]


class ChampionStatsSummary(BaseModel):
    """GET /api/champions/stats の1件分"""

    champion_id: str = Field(..., description="チャンピオン英語ID")
    tier: str = Field(..., description="ティア（S+/S/A/B/C）")
    rank: int = Field(..., description="ティアリスト内順位")
    win_rate: float = Field(..., description="勝率 (0.0〜1.0)")
    pick_rate: float = Field(..., description="ピック率")
    ban_rate: float = Field(..., description="バン率")
    best_position: str = Field(..., description="最多採用ポジション")
    games_played: int = Field(..., description="ゲーム数")


class PositionStats(BaseModel):
    """GET /api/champions/{id}/stats の1ポジション分"""

    position: str = Field(..., description="ポジション（TOP/JUNGLE/MID/ADC/SUPPORT）")
    win_rate: float = Field(..., description="勝率")
    pick_rate: float = Field(..., description="ピック率")
    ban_rate: float = Field(..., description="バン率")
    games_played: int = Field(..., description="ゲーム数")


class PatchWinRate(BaseModel):
    """パッチ別勝率履歴の1ポイント"""
    patch:        str   = Field(..., description="パッチ番号（例: 16.9.1）")
    win_rate:     float = Field(..., description="勝率")
    pick_rate:    float = Field(..., description="ピック率")
    games_played: int   = Field(..., description="ゲーム数")


class ItemPickRate(BaseModel):
    """アイテム別ピック率"""
    item_id:   int   = Field(..., description="DDragon アイテムID")
    pick_rate: float = Field(..., description="そのスロットでのピック率")
    count:     int   = Field(..., description="ピック数")


class ItemSlotStats(BaseModel):
    """スロット別アイテム統計"""
    slot:  int           = Field(..., description="インベントリスロット番号（0〜5）")
    items: list[ItemPickRate] = Field(default_factory=list)
