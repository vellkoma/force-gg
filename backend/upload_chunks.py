"""
チャンピオン統計DBを本番にチャンク分割アップロードするスクリプト
使用方法: python upload_chunks.py --secret <UPDATE_SECRET>
"""
import argparse
import sys
import time
import urllib.request
import urllib.parse

ENDPOINT = "https://api.forcegg.io/api/champions/admin/import-db-chunk"
DUMP_FILE = "champ_stats_dump.sql"
CHUNK_SIZE = 3000  # INSERT文の件数/チャンク


def filter_lines(path: str) -> list[str]:
    allowed = {"champion_stats_meta", "champion_stats_aggregate", "champion_item_stats"}
    result = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("--"):
                continue
            if line.upper().startswith(("PRAGMA", "BEGIN", "COMMIT", "ROLLBACK")):
                continue
            for tbl in allowed:
                if tbl in line:
                    result.append(line)
                    break
    return result


def send_chunk(lines: list[str], secret: str, chunk_num: int) -> bool:
    boundary = "----ChunkBoundary" + str(chunk_num)
    body_text = "\n".join(lines)
    body_parts = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="chunk_{chunk_num}.sql"\r\n'
        "Content-Type: text/plain\r\n"
        "\r\n"
        + body_text
        + f"\r\n--{boundary}--\r\n"
    )
    body_bytes = body_parts.encode("utf-8")

    req = urllib.request.Request(
        ENDPOINT,
        data=body_bytes,
        headers={
            "X-Update-Secret": secret,
            "Content-Type": f"multipart/form-data; boundary={boundary}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            result = resp.read().decode("utf-8")
            print(f"  チャンク {chunk_num}: {result}")
            return True
    except Exception as e:
        print(f"  チャンク {chunk_num} エラー: {e}", file=sys.stderr)
        return False


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--secret", required=True, help="UPDATE_SECRET の値")
    args = parser.parse_args()

    print("SQLダンプを読み込み中...")
    lines = filter_lines(DUMP_FILE)
    print(f"対象行数: {len(lines)}")

    total_chunks = (len(lines) + CHUNK_SIZE - 1) // CHUNK_SIZE
    print(f"チャンク数: {total_chunks} ({CHUNK_SIZE}行/チャンク)")

    success = 0
    for i in range(0, len(lines), CHUNK_SIZE):
        chunk = lines[i : i + CHUNK_SIZE]
        chunk_num = i // CHUNK_SIZE + 1
        print(f"チャンク {chunk_num}/{total_chunks} 送信中...", end=" ", flush=True)
        if send_chunk(chunk, args.secret, chunk_num):
            success += 1
        time.sleep(0.5)

    print(f"\n完了: {success}/{total_chunks} チャンク成功")


if __name__ == "__main__":
    main()
