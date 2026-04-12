FROM python:3.11-slim

WORKDIR /app

# 依存関係を先にインストール（キャッシュ最適化）
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# アプリケーションコードをコピー
COPY . .

# Railway が自動的に PORT 環境変数を設定する
EXPOSE 8000

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
