# force.gg バックエンド

FastAPI + SQLite + Redis で動く force.gg の API サーバー。

---

## 起動方法

### 開発サーバー（推奨）

```powershell
cd backend
.\start.ps1
```

既存の Python/uvicorn プロセスを終了してから `http://localhost:8000` で起動する。

### 手動起動

```powershell
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

---

## 初回セットアップ

```powershell
cd backend
pip install -r requirements.txt
copy .env.example .env   # .env を編集して各キーを設定
```

### 必須環境変数（`.env`）

| 変数 | 説明 |
|------|------|
| `RIOT_API_KEY` | Riot Games 開発者ポータルで取得（24時間ごとに再生成） |
| `REDIS_URL` | Redis 接続先（例: `redis://localhost:6379`） |
| `JWT_SECRET_KEY` | 32文字以上のランダム文字列 |
| `PANDASCORE_API_KEY` | Esports スケジュール取得用 |

---

## データ更新

チャンピオン統計・esports スケジュールを手動更新する。

```powershell
cd backend

# チャンピオン統計のみ（最新パッチ・チャレンジャー）
python update.py -c

# パッチ指定
python update.py -c -p 16.9

# 全ランク帯 × パッチ指定
python update.py -c --rank-all -p 16.9

# esports スケジュールのみ
python update.py -S
```

> **注意**: Riot API の開発キーは 24 時間で失効する。`.env` の `RIOT_API_KEY` を毎日更新すること。

### パッチ指定時の除外数について

`-p 16.2` のように古いパッチを指定すると、ログに大量の「除外」が出る場合がある。

```
マッチ詳細取得完了: 7752件
パッチ 16.2 のマッチ: 75件（除外: 7677件）
```

**これは正常な動作**。仕組みは以下の通り:

1. プレイヤーの直近マッチID（最大100件）を取得
2. マッチ詳細を取得してパッチ番号を確認
3. 指定パッチ以外のマッチを除外

プレイヤーの最近の試合は最新パッチが大半のため、古いパッチを指定するほど除外率が高くなる（16.2 の場合、直近に 16.2 のマッチがほぼ残っていないため 99% 除外される）。

**推奨運用**: パッチがリリースされた当日〜翌日に実行すれば除外が少なく効率的にデータが集まる。

### DIAMOND 以下が 403 になる場合

開発キー（dev key）では DIAMOND 以下のランク帯エントリ取得 API が禁止されている。  
CHALLENGER / GRANDMASTER / MASTER の 3 ランク帯のみ収集可能。

```powershell
# 開発キーで収集できるランク帯のみ
python update.py -c -p 16.9
python update.py -c -p 16.9 -r GRANDMASTER
python update.py -c -p 16.9 -r MASTER
```

---

## API ドキュメント

サーバー起動後にアクセス:

- Swagger UI: http://localhost:8000/docs
- ReDoc:      http://localhost:8000/redoc
