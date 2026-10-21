#!/usr/bin/env bash
set -e

echo "============================================================"
echo "  VESSEL CREW & FLEET DEFENSE DASHBOARD LAUNCHER"
echo "============================================================"
echo ""

if [ ! -d ".venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv .venv
fi

echo "Activating virtual environment..."
source .venv/bin/activate

echo "Checking and installing dependencies..."
python -m pip install --quiet --upgrade pip
python -m pip install --quiet -r requirements.txt

echo ""
echo "============================================================"
echo "Starting Vessel Crew Command Server on http://localhost:5050"
echo "Default Login Credentials:"
echo "  - Role: Vessel Crew"
echo "  - Username: crew"
echo "  - Password: test123"
echo "============================================================"
echo ""

python -m uvicorn app.main:app --host 0.0.0.0 --port 5050 --reload
