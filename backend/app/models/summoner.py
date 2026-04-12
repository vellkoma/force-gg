"""
サモナー関連 Pydantic v2 モデル
Riot Account API / Summoner API / League API のレスポンスを型安全に扱う
"""
from pydantic import BaseModel, computed_field


class AccountInfo(BaseModel):
    """Riot Account API レスポンス（PUUID・Riot ID）"""

    puuid: str
    game_name: str
    tag_line: str


class SummonerInfo(BaseModel):
    """Summoner API レスポンス（サモナーID・レベル・アイコン等）"""

    id: str = ""  # 新APIでは省略される場合がある
    account_id: str = ""
    puuid: str
    profile_icon_id: int
    summoner_level: int


class RankedEntry(BaseModel):
    """League API の1エントリ（ソロキューまたはフレックス）"""

    queue_type: str   # "RANKED_SOLO_5x5" or "RANKED_FLEX_SR"
    tier: str         # "IRON" / "BRONZE" / ... / "CHALLENGER"
    rank: str         # "I" / "II" / "III" / "IV"（マスター以上は空文字列の場合あり）
    league_points: int
    wins: int
    losses: int

    @computed_field
    @property
    def win_rate(self) -> float:
        """勝率を小数点第1位まで返す。試合数0の場合は0.0"""
        total = self.wins + self.losses
        return round(self.wins / total * 100, 1) if total > 0 else 0.0


class SummonerProfile(BaseModel):
    """
    サモナーエンドポイントのレスポンスモデル
    アカウント情報・サモナー情報・ランク情報を統合する
    """

    account: AccountInfo
    summoner: SummonerInfo
    ranked_stats: list[RankedEntry]
