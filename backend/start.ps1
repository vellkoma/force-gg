Write-Host "Killing old Python/uvicorn processes..."
Get-Process python*, uvicorn* -ErrorAction SilentlyContinue | Stop-Process -Force

Start-Sleep -Milliseconds 500

Write-Host "Starting backend..."
uvicorn main:app --reload --host 0.0.0.0 --port 8000
