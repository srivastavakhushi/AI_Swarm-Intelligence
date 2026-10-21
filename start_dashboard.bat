@echo off
title Vessel Crew Maritime Dashboard
echo ============================================================
echo   VESSEL CREW & FLEET DEFENSE DASHBOARD LAUNCHER
echo ============================================================
echo.

if not exist .venv (
    echo Creating Python virtual environment...
    python -m venv .venv
)

echo Activating virtual environment...
call .venv\Scripts\activate.bat

echo Checking and installing dependencies...
python -m pip install --quiet --upgrade pip
python -m pip install --quiet -r requirements.txt

echo.
echo ============================================================
echo Starting Vessel Crew Command Server on http://localhost:5050
echo Default Login Credentials:
echo   - Role: Vessel Crew
echo   - Username: crew
echo   - Password: test123
echo ============================================================
echo.

python -m uvicorn app.main:app --host 0.0.0.0 --port 5050 --reload
pause
