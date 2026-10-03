@echo off
title DriftGuard - Behavioral-Drift Fraud Detection
cd /d "%~dp0"

if not exist "frontend\dist\index.html" (
  echo [setup] Building the web UI for the first time...
  pushd frontend
  call npm install || goto :fail
  call npm run build || goto :fail
  popd
)

echo.
echo   DriftGuard - Behavioral-Drift Fraud Detection
echo   Opening http://localhost:8000  (the model trains for ~5 seconds on start)
echo   Press Ctrl+C in this window to stop.
echo.

start "" cmd /c "timeout /t 3 >nul & start http://localhost:8000"
cd backend
python -m uvicorn app.main:app --port 8000
goto :eof

:fail
echo.
echo [error] Frontend build failed. Make sure Node.js 18+ is installed.
pause
