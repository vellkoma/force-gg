# LoL データ → Railway PostgreSQL 同期
# 使い方: プロジェクトルートで .\sync_railway.ps1

Set-Location "$PSScriptRoot\backend"
python sync_railway.py
Set-Location $PSScriptRoot
