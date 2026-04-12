"""
マッチ履歴関連 Pydantic v2 モデル
Riot Match v5 API のレスポンスを型安全に扱う
"""
from pydantic import BaseModel


class ParticipantStats(BaseModel):
    """
    試合参加者1人分の統計情報
    Match v5 API の info.participants[*] に対応する
    """

    puuid: str
    champion_name: str
    champion_id: int
    kills: int
    deaths: int
    assists: int
    win: bool
    total_damage_dealt_to_champions: int
    gold_earned: int
    cs: int                  # totalMinionsKilled + neutralMinionsKilled の合算値
    vision_score: int
    summoner1_id: int
    summoner2_id: int
    item0: int
    item1: int
    item2: int
    item3: int
    item4: int
    item5: int
    item6: int               # トリンケットスロット
    individual_position: str  # "TOP" / "JUNGLE" / "MIDDLE" / "BOTTOM" / "UTILITY"
    champ_level: int = 1       # 試合終了時のチャンピオンレベル
    team_id: int = 100         # 100: ブルーサイド / 200: レッドサイド
    participant_id: int = 0    # Riot内部ID (1〜10)
    riot_id_game_name: str = ""
    riot_id_tag_line: str = ""

    @property
    def kda(self) -> float:
        """KDAを小数点第2位まで返す。デス0の場合はデス=1として計算"""
        return round((self.kills + self.assists) / max(self.deaths, 1), 2)


class MatchInfo(BaseModel):
    """試合メタ情報（Match v5 API の info 直下フィールド）"""

    match_id: str
    game_duration: int       # 秒単位
    game_mode: str           # "CLASSIC" 等
    queue_id: int            # 420: ランク戦
    game_end_timestamp: int  # UNIXミリ秒


class MatchDetail(BaseModel):
    """
    1試合分の詳細情報
    info（試合メタ）+ participants（全参加者統計）+ my_stats（検索対象者の統計）を含む
    """

    info: MatchInfo
    participants: list[ParticipantStats]
    my_stats: ParticipantStats | None = None  # 検索したPUUIDの参加者統計（一致しない場合はNone）


class MatchListResponse(BaseModel):
    """マッチ履歴エンドポイントのレスポンスモデル"""

    matches: list[MatchDetail]
    puuid: str


# --- タイムライン関連モデル ---

class ParticipantFrameData(BaseModel):
    """1フレーム内の1参加者データ"""
    participant_id: int
    total_gold: int
    xp: int
    level: int


class TimelineFrame(BaseModel):
    """全参加者の1フレームスナップショット"""
    timestamp_ms: int   # フレームのタイムスタンプ（ミリ秒）
    second: int         # timestamp_ms // 1000
    data: list[ParticipantFrameData]


class ParticipantMeta(BaseModel):
    """タイムライン参加者のメタ情報"""
    participant_id: int
    puuid: str
    champion_name: str
    team_id: int


class ItemEvent(BaseModel):
    """アイテム購入イベント（検索対象プレイヤーのみ）"""
    timestamp_ms: int   # 購入タイムスタンプ（ミリ秒）
    second: int         # timestamp_ms // 1000
    item_id: int


class MatchTimeline(BaseModel):
    """タイムラインエンドポイントのレスポンスモデル"""
    match_id: str
    my_participant_id: int              # 検索プレイヤーのparticipant_id
    participant_metas: list[ParticipantMeta]   # 全参加者メタ
    frames: list[TimelineFrame]         # 全参加者の時系列フレーム
    item_purchases: list[ItemEvent]     # 検索プレイヤーのアイテム購入履歴
