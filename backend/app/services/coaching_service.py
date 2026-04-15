"""
AI コーチングサービス
ANTHROPIC_API_KEY が設定されていれば Claude API を呼び出し、
未設定の場合はモックレスポンスを返す。
"""
import logging
from typing import Any

from app.core.config import settings

logger = logging.getLogger(__name__)

# チャンピオン・ロール別のモックアドバイス（日本語）
# ANTHROPIC_API_KEY が未設定の開発環境で使用する
_MOCK_ADVICE = {
    "summary": "このデータに基づいた分析です（モックデータ）。",
    "strengths": [
        "序盤のレーン戦での安定したCSコントロール",
        "チームファイトでの安定したダメージ出力",
    ],
    "improvements": [
        "死亡数を減らしてゴールドロスを最小化する",
        "ビジョンコントロール（ワード設置・破壊）を強化する",
    ],
    "tips": [
        "ミニマップを常に確認し、敵ジャングラーの動きを予測してください。",
        "CS/minを7.0以上を目標に、ラストヒットの精度を上げましょう。",
        "オブジェクト（ドラゴン・バロン）のスポーン前にウェーブをクリアして合流する習慣をつけましょう。",
        "勝っているレーンを積極的にローミングでサポートし、スノーボールを加速させてください。",
        "KDAよりもオブジェクト取得数を意識したプレイを心がけましょう。",
    ],
}


def _build_prompt(
    champion_name: str,
    role: str,
    recent_stats: dict[str, Any],
    rank: str,
) -> str:
    """
    Claude API に送信するプロンプトを組み立てる。

    # TODO: Claude API
    実際の呼び出しを実装する際はこのプロンプトを使用すること。
    モデル: claude-sonnet-4-6 (または claude-3-5-sonnet-20241022)
    max_tokens: 1024
    temperature: 0.7
    """
    stats_lines = "\n".join(
        f"  - {key}: {value}" for key, value in recent_stats.items()
    )
    return f"""あなたはLeague of Legendsの日本語コーチです。
以下のプレイヤーデータを分析し、具体的なコーチングアドバイスを日本語で提供してください。

## プレイヤー情報
- チャンピオン: {champion_name}
- ロール: {role}
- ランク: {rank}

## 直近の統計
{stats_lines}

## 回答形式（JSON）
{{
  "summary": "一言での評価（30文字以内）",
  "strengths": ["強み1", "強み2", "強み3"],
  "improvements": ["改善点1", "改善点2", "改善点3"],
  "tips": ["実践的なアドバイス1", "アドバイス2", "アドバイス3", "アドバイス4", "アドバイス5"]
}}

データに基づいた具体的なアドバイスを返してください。"""


class CoachingService:
    """
    AI コーチングサービス

    ANTHROPIC_API_KEY が設定済み: Claude API でリアルタイム分析
    ANTHROPIC_API_KEY が未設定: モックデータを返却（開発・テスト用）
    """

    @property
    def _has_api_key(self) -> bool:
        return bool(settings.anthropic_api_key)

    async def analyze_champion_coaching(
        self,
        champion_name: str,
        role: str,
        recent_stats: dict[str, Any],
        rank: str = "UNRANKED",
    ) -> dict[str, Any]:
        """
        チャンピオン・統計データを基にコーチングアドバイスを生成する。

        Parameters
        ----------
        champion_name:
            分析対象のチャンピオン名（例: "Jinx"）
        role:
            ロール（例: "ADC", "JUNGLE", "MID", "TOP", "SUPPORT"）
        recent_stats:
            直近の統計辞書（kda, win_rate, cs_per_min など任意のキー）
        rank:
            プレイヤーのランク文字列（例: "GOLD IV"）

        Returns
        -------
        dict:
            summary / strengths / improvements / tips / is_mock を含む辞書
        """
        if self._has_api_key:
            return await self._call_claude_api(champion_name, role, recent_stats, rank)

        logger.info(
            "ANTHROPIC_API_KEY が未設定のためモックコーチングを返却: %s (%s)",
            champion_name,
            role,
        )
        return await self._mock_response(champion_name, role, recent_stats, rank)

    async def _mock_response(
        self,
        champion_name: str,
        role: str,
        recent_stats: dict[str, Any],
        rank: str,
    ) -> dict[str, Any]:
        """
        開発用モックレスポンス。
        固定の日本語アドバイスを返す（チャンピオン名・ロールを文字列に埋め込む）。
        """
        win_rate = recent_stats.get("win_rate", recent_stats.get("winRate", None))
        if win_rate is not None:
            win_rate_pct = f"{win_rate:.1f}%" if isinstance(win_rate, float) else str(win_rate)
            summary = f"{champion_name}（{role}）の勝率は {win_rate_pct} です（モックデータ）。"
        else:
            summary = f"{champion_name}（{role}）の分析結果です（モックデータ）。"

        return {
            "summary": summary,
            "strengths": [
                f"{champion_name} の序盤レーン戦での安定したCSコントロール",
                "チームファイトでの一貫した役割遂行",
            ],
            "improvements": [
                "死亡数を減らしてゴールドロスを最小化する",
                "ビジョンコントロール（ワード設置・破壊）を強化する",
            ],
            "tips": [
                "ミニマップを常に確認し、敵ジャングラーの動きを予測してください。",
                "CS/minを7.0以上を目標に、ラストヒットの精度を上げましょう。",
                "オブジェクト（ドラゴン・バロン）のスポーン前にウェーブをクリアして合流する習慣をつけましょう。",
                "勝っているレーンを積極的にローミングでサポートし、スノーボールを加速させてください。",
                f"【{rank}帯向け】KDAよりもオブジェクト取得数を意識したプレイを心がけましょう。",
            ],
            "is_mock": True,
        }

    async def _call_claude_api(
        self,
        champion_name: str,
        role: str,
        recent_stats: dict[str, Any],
        rank: str,
    ) -> dict[str, Any]:
        """
        Claude API を呼び出してコーチングアドバイスを生成する。

        # TODO: Claude API
        現在は ANTHROPIC_API_KEY が設定されていても呼び出しは未実装。
        anthropic>=0.20.0 のインストール後、以下の手順で実装すること:

        1. `import anthropic` を追加
        2. `client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)`
        3. `response = await client.messages.create(...)` でプロンプトを送信
        4. レスポンスのJSONをパースして返却

        実装例:
            import json
            import anthropic

            client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
            prompt = _build_prompt(champion_name, role, recent_stats, rank)
            message = await client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=1024,
                messages=[{"role": "user", "content": prompt}],
            )
            raw = message.content[0].text
            parsed = json.loads(raw)
            parsed["is_mock"] = False
            return parsed
        """
        logger.warning(
            "Claude API 呼び出しは未実装です。モックレスポンスを返却します: %s (%s)",
            champion_name,
            role,
        )
        result = await self._mock_response(champion_name, role, recent_stats, rank)
        # API キーは設定済みだが実装が未完成であることを示すフラグ
        result["is_mock"] = True
        return result
