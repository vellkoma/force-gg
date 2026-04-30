"""
ロゴ事前取得スクリプト（PandaScore のみ）
imgフォルダ内の古いアイコンを削除してPandaScoreから再取得する。
チーム名はローカルの esports.db から取得（Leaguepediaは使用しない）。
実行: python fetch_logos.py  (backend/ ディレクトリで実行)
"""
import asyncio
import os
import shutil
import sqlite3
import sys

import httpx

sys.path.insert(0, ".")

from app.core.config import settings

PANDASCORE_API = "https://api.pandascore.co"
LEAGUE_IDS     = ["LJL", "LCK", "LCS", "LEC", "LPL", "CBLOL", "LCP", "PCS"]


def _ext_from_response(r: httpx.Response) -> str:
    ct = r.headers.get("content-type", "")
    if "webp" in ct:
        return ".webp"
    if "jpeg" in ct or "jpg" in ct:
        return ".jpg"
    return ".png"


def _safe_name(name: str) -> str:
    return name.replace(" ", "_").replace("/", "-").replace(":", "").replace("*", "")


def get_teams_from_db() -> set[str]:
    """ローカルの esports.db から既知チーム名を取得"""
    db_path = settings.esports_db_path
    if not os.path.exists(db_path):
        print(f"  DB not found: {db_path}")
        return set()
    conn = sqlite3.connect(db_path)
    try:
        cur = conn.execute(
            "SELECT DISTINCT team1_name FROM esports_matches WHERE team1_name != '' "
            "UNION "
            "SELECT DISTINCT team2_name FROM esports_matches WHERE team2_name != ''"
        )
        return {row[0] for row in cur.fetchall()}
    finally:
        conn.close()


async def fetch_pandascore_league_icon(
    api: httpx.AsyncClient, league_name: str
) -> str | None:
    try:
        r = await api.get(
            f"{PANDASCORE_API}/lol/leagues",
            params={"search[name]": league_name, "per_page": "5"},
        )
        r.raise_for_status()
        for lg in r.json():
            ps_name = (lg.get("name") or "").strip()
            img_url = (lg.get("image_url") or "").strip()
            if img_url and league_name.lower() in ps_name.lower():
                return img_url
    except Exception as e:
        print(f"    PandaScore league error ({league_name}): {e}")
    return None


async def fetch_pandascore_team_icon(
    api: httpx.AsyncClient, team_name: str
) -> str | None:
    try:
        r = await api.get(
            f"{PANDASCORE_API}/lol/teams",
            params={"search[name]": team_name, "per_page": "5"},
        )
        r.raise_for_status()
        for t in r.json():
            ps_name = (t.get("name") or "").strip()
            img_url = (t.get("image_url") or "").strip()
            if img_url and ps_name.lower() == team_name.lower():
                return img_url
    except Exception as e:
        print(f"    PandaScore team error ({team_name}): {e}")
    return None


async def download_image(
    dl: httpx.AsyncClient, url: str, save_path_base: str, label: str
) -> str | None:
    """認証なしクライアントで画像をダウンロード"""
    try:
        r = await dl.get(url, follow_redirects=True, timeout=15)
        if r.status_code == 200 and len(r.content) > 200:
            ext  = _ext_from_response(r)
            path = f"{save_path_base}{ext}"
            with open(path, "wb") as f:
                f.write(r.content)
            print(f"  OK   {label:<45} {len(r.content)//1024}KB → {path}")
            return path
        print(f"  NG   {label:<45} status={r.status_code}")
    except Exception as e:
        print(f"  ERR  {label:<45} {e}")
    return None


async def main() -> None:
    token = settings.pandascore_api_key
    if not token:
        print("ERROR: PANDASCORE_API_KEY が設定されていません (.env を確認してください)")
        return

    # ─── 古いアイコンを削除 ──────────────────────────────────
    for folder in ("img/leagues", "img/teams"):
        if os.path.exists(folder):
            shutil.rmtree(folder)
            print(f"Cleared: {folder}/")
        os.makedirs(folder, exist_ok=True)

    # API用（認証あり）と画像DL用（認証なし）でクライアントを分ける
    api_headers = {"Authorization": f"Bearer {token}"}

    async with (
        httpx.AsyncClient(headers=api_headers, timeout=15) as api,
        httpx.AsyncClient(timeout=15) as dl,
    ):
        # ─── リーグアイコン（PandaScore）────────────────────
        print("\n=== リーグアイコン (PandaScore) ===")
        league_ok = 0
        for league in LEAGUE_IDS:
            img_url = await fetch_pandascore_league_icon(api, league)
            if img_url:
                path = await download_image(dl, img_url, f"img/leagues/{league}", league)
                if path:
                    league_ok += 1
            else:
                print(f"  --   {league:<45} 未検出")
            await asyncio.sleep(0.3)
        print(f"\nリーグ: {league_ok}/{len(LEAGUE_IDS)} 件取得")

        # ─── チーム名を esports.db から取得 ──────────────────
        print("\n=== チーム名取得 (esports.db) ===")
        team_names = get_teams_from_db()
        if not team_names:
            print("  DB にチームデータがありません。バックエンドを一度起動して同期してから再実行してください。")
            return
        print(f"  {len(team_names)} 件取得: {sorted(team_names)[:5]}... (他省略)")

        # ─── チームアイコン（PandaScore）────────────────────
        print(f"\n=== チームアイコン (PandaScore) ===")
        team_ok   = 0
        team_miss = 0
        for team_name in sorted(team_names):
            safe    = _safe_name(team_name)
            img_url = await fetch_pandascore_team_icon(api, team_name)
            await asyncio.sleep(0.3)
            if img_url:
                path = await download_image(dl, img_url, f"img/teams/{safe}", team_name)
                if path:
                    team_ok += 1
                    continue
            print(f"  --   {team_name:<45} 未検出")
            team_miss += 1

    # ─── 結果サマリー ────────────────────────────────────────
    print("\n=== 完了 ===")
    print(f"リーグ  : {league_ok}/{len(LEAGUE_IDS)} 件")
    print(f"チーム  : {team_ok} 件取得 / {team_miss} 件未取得")
    print(f"img/leagues/ : {os.listdir('img/leagues')}")
    print(f"img/teams/   : {len(os.listdir('img/teams'))} ファイル")


if __name__ == "__main__":
    asyncio.run(main())
