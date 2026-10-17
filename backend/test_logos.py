"""
リーグ・チームロゴ取得テスト
※ バックエンド（uvicorn）を停止してから実行してください（レートリミット競合を避けるため）
実行: python test_logos.py
結果: img/ フォルダに保存
"""
import asyncio, os, sys
import httpx

sys.path.insert(0, ".")

LEAGUE_PREFIXES = ["LJL", "LCK", "LCS", "LEC", "LPL", "CBLOL", "LCP", "PCS"]

TEST_TEAMS = [
    "NOVEX", "V3 Esports", "DetonatioN FocusMe", "Uwinks",
    "Fast8", "Sengoku Gaming",
    "T1", "Gen.G", "Cloud9", "G2 Esports", "Team Liquid",
]

WIKI_API = "https://lol.fandom.com/api.php"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept":  "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    "Referer": "https://lol.fandom.com/",
}


async def search_league_logo(client: httpx.AsyncClient, prefix: str) -> tuple[str, str] | None:
    """allimages API でリーグロゴのファイル名を検索"""
    r = await client.get(WIKI_API, params={
        "action":    "query",
        "list":      "allimages",
        "aifrom":    f"{prefix}_logo",
        "aito":      f"{prefix}_logo_z",
        "ailimit":   "5",
        "aiprop":    "url|size",
        "format":    "json",
    }, timeout=15)
    r.raise_for_status()
    images = r.json().get("query", {}).get("allimages", [])
    # 最大サイズのものを選択（アイコンより大きいロゴを優先）
    valid = [img for img in images if img.get("size", 0) > 1000]
    if valid:
        best = max(valid, key=lambda x: x.get("size", 0))
        return best["name"], best["url"]
    return None


async def get_imageinfo(client: httpx.AsyncClient, filenames: list[str]) -> dict[str, str]:
    """imageinfo API で複数ファイルのCDN URLを一括取得"""
    titles = "|".join(f"File:{f}" for f in filenames[:50])
    r = await client.get(WIKI_API, params={
        "action": "query",
        "titles": titles,
        "prop":   "imageinfo",
        "iiprop": "url",
        "format": "json",
    }, timeout=20)
    r.raise_for_status()
    pages = r.json().get("query", {}).get("pages", {})
    result: dict[str, str] = {}
    for page in pages.values():
        name = page.get("title", "").replace("File:", "")
        ii   = page.get("imageinfo", [])
        if ii and ii[0].get("url"):
            result[name] = ii[0]["url"]
    return result


async def download(client: httpx.AsyncClient, url: str, path: str, label: str) -> bool:
    try:
        r = await client.get(url, follow_redirects=True, timeout=20)
        if r.status_code == 200 and len(r.content) > 500:
            with open(path, "wb") as f:
                f.write(r.content)
            print(f"  OK   {label:<45} {len(r.content)//1024}KB")
            return True
        print(f"  NG   {label:<45} status={r.status_code}")
        return False
    except Exception as e:
        print(f"  ERR  {label:<45} {e}")
        return False


async def main():
    os.makedirs("img/leagues", exist_ok=True)
    os.makedirs("img/teams",   exist_ok=True)

    async with httpx.AsyncClient(headers=HEADERS) as client:

        # ─── リーグロゴ: ファイル名を検索してCDN URLを取得 ─
        print("\n=== リーグロゴ ===")
        league_ok = 0
        for prefix in LEAGUE_PREFIXES:
            result = await search_league_logo(client, prefix)
            if result:
                filename, cdn_url = result
                print(f"  found: {prefix} → {filename}")
                ok = await download(client, cdn_url, f"img/leagues/{prefix}.png", prefix)
                if ok:
                    league_ok += 1
            else:
                print(f"  --   {prefix:<45} ファイル未検出")
            await asyncio.sleep(1)
        print(f"\nリーグ: {league_ok}/{len(LEAGUE_PREFIXES)} 件取得")

        # ─── チームロゴ: Cargo API + imageinfo ────────────
        print("\n=== チームロゴ ===")
        from app.services.leaguepedia import _cargo_query

        print("  Cargo API でチーム画像ファイル名を取得中...")
        await asyncio.sleep(3)
        team_files: dict[str, str] = {}
        try:
            names_clause = ",".join(f'"{n}"' for n in TEST_TEAMS)
            rows = await _cargo_query({
                "tables": "Teams",
                "fields": "Name,Image",
                "where":  f"Name IN ({names_clause})",
                "limit":  "30",
            })
            team_files = {
                row["Name"].strip(): row["Image"].strip()
                for row in rows if row.get("Name") and row.get("Image")
            }
            print(f"  {len(team_files)} チーム検出: {list(team_files.keys())}")
        except Exception as e:
            print(f"  Cargo API 失敗: {e}")

        if team_files:
            print("  imageinfo API で CDN URL 取得中...")
            await asyncio.sleep(1)
            cdn = await get_imageinfo(client, list(team_files.values()))
            print(f"  CDN URL取得: {len(cdn)}/{len(team_files)} 件")

            team_ok = 0
            for team_name, filename in team_files.items():
                url = cdn.get(filename)
                if not url:
                    print(f"  --   {team_name:<45} URL未取得")
                    continue
                safe = team_name.replace(" ", "_").replace("/", "-")
                ok = await download(client, url, f"img/teams/{safe}.png", team_name)
                if ok:
                    team_ok += 1
                await asyncio.sleep(0.5)
            print(f"\nチーム: {team_ok}/{len(team_files)} 件取得")

    # ─── 結果 ────────────────────────────────────────────
    print("\n=== 完了 ===")
    league_files = os.listdir("img/leagues")
    team_files_  = os.listdir("img/teams")
    print(f"img/leagues/ ({len(league_files)}) : {league_files}")
    print(f"img/teams/   ({len(team_files_)}) : {team_files_}")


if __name__ == "__main__":
    asyncio.run(main())
