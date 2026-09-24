# AI Swarm Intelligence

Maritime fleet defense dashboard for the Strait of Malacca. The web app plans water-only routes with Ant Colony Optimization (ACO), A*, and Dijkstra, and includes threat monitoring, commander review, and voyage tracking.

Run these commands from the repository root.

## Prerequisites

- Python 3.10 or newer
- Git

Check Python:

```bash
python --version
```

On some systems the command is `python3` instead of `python`. Use that name in every command below if `python` is not found.

## Clone the repository

```bash
git clone https://github.com/srivastavakhushi/AI_Swarm-Intelligence.git
cd AI_Swarm-Intelligence
```

## Create a virtual environment

Windows (PowerShell):

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

If PowerShell blocks the activate script, run this once, then activate again:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
```

macOS and Linux:

```bash
python -m venv .venv
source .venv/bin/activate
```

## Install dependencies

Dashboard:

```bash
python -m pip install --upgrade pip
python -m pip install fastapi uvicorn numpy pandas global-land-mask
```

Optional scripts (`run_prototype.py`, `risk_classifier_ai.py`, `ai.py`) also need plotting and the risk classifier:

```bash
python -m pip install matplotlib scikit-learn
```

## Start the dashboard

```bash
python -m uvicorn app.main:app --reload --port 5050
```

The same app can be started without reload:

```bash
python -m uvicorn app.main:app --host 0.0.0.0 --port 5050
```

Or:

```bash
python -m app.main
```

Open the dashboard:

```text
http://127.0.0.1:5050
```

Stop the server with `Ctrl+C` in the terminal where it is running.

## Sign in

Default accounts are created in `users.db` on first startup. Password for all three is `test123`.

| Operator ID | Password | Role |
| --- | --- | --- |
| `commander` | `test123` | Fleet Commander |
| `crew` | `test123` | Vessel Crew |
| `admin` | `test123` | System Administrator |

On the home page, choose an origin and destination in the Strait of Malacca, then run the solver. The Fleet Commander home view shows vessel status, the planned corridor, and the Malacca map.

## Optional command-line prototypes

Full workflow in the terminal, including route plots:

```bash
python run_prototype.py
```

Trained risk classifier prototype:

```bash
python risk_classifier_ai.py
```

Standalone routing prototype:

```bash
python ai.py
```
