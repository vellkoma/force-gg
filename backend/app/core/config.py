"""
アプリケーション設定管理
pydantic-settings を使って環境変数を型安全に管理する
"""
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator
from typing import List


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Riot Games API
    riot_api_key: str = "RGAPI-dummy-key"

    # Redis
    redis_url: str = "redis://localhost:6379"

    # CORS
    cors_origins: str = "http://localhost:5173"

    # アプリ設定
    env: str = "development"
    log_level: str = "INFO"

    # Data Dragon ベースURL
    ddragon_base_url: str = "https://ddragon.leagueoflegends.com"

    # Riot API ベースURL
    jp1_base_url: str = "https://jp1.api.riotgames.com"
    asia_base_url: str = "https://asia.api.riotgames.com"

    # キャッシュTTL（秒）
    cache_ttl_summoner: int = 600
    cache_ttl_match_list: int = 3600
    cache_ttl_match_detail: int = 86400
    cache_ttl_champion_list: int = 3600    # チャンピオン一覧（1時間）
    cache_ttl_champion_detail: int = 86400  # チャンピオン詳細（24時間、パッチまで不変）
    cache_ttl_champion_stats: int = 3600   # ランク別統計（1時間）
    cache_ttl_ranked_stats: int = 300

    @property
    def cors_origins_list(self) -> List[str]:
        """カンマ区切りのCORS設定をリストに変換する"""
        return [origin.strip() for origin in self.cors_origins.split(",")]

    @property
    def is_development(self) -> bool:
        return self.env.lower() == "development"


# シングルトンインスタンス
settings = Settings()
