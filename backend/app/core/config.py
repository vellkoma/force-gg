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

    # JWT / 認証
    jwt_secret_key: str = ""
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 15   # アクセストークン: 15分
    jwt_refresh_token_expire_days: int = 90     # リフレッシュトークン: 90日

    @field_validator("jwt_secret_key")
    @classmethod
    def jwt_secret_key_must_be_set(cls, v: str) -> str:
        import os
        # 開発環境では警告のみ、本番環境では起動を拒否
        if not v:
            env = os.getenv("ENV", "development")
            if env == "production":
                raise ValueError(
                    "JWT_SECRET_KEY を設定してください（例: openssl rand -hex 32）"
                )
            # 開発環境用のデフォルト値
            return "dev-only-secret-key-do-not-use-in-production-32chars"
        if len(v) < 32:
            raise ValueError("JWT_SECRET_KEY は32文字以上にしてください")
        return v

    # Google OAuth
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:5173/oauth/callback"

    # Discord OAuth
    discord_client_id: str = ""
    discord_client_secret: str = ""
    discord_redirect_uri: str = "http://localhost:5173/oauth/callback"

    # Stripe 課金
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_monthly_price_id: str = ""
    stripe_yearly_price_id: str = ""

    # Anthropic (Claude API) — AI コーチング機能用
    # 未設定の場合はモックレスポンスを返す（開発環境でもサービスは起動可能）
    anthropic_api_key: str = ""

    # PandaScore API — チームアイコン取得用
    pandascore_api_key: str = ""

    # 日次更新トリガー用シークレット（GitHub Actions → /api/esports/admin/update）
    update_secret: str = ""

    # SQLite DB パス（esports スケジュールキャッシュ用）
    esports_db_path: str = "esports.db"

    # フロントエンドURL（Stripeリダイレクト用）
    frontend_url: str = "http://localhost:5173"

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
