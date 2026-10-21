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

## AI Syllabus Modules (Units 2 & 6)

The platform incorporates comprehensive Artificial Intelligence curriculum algorithms integrated into both the backend FastAPI service and the interactive cybernetic HUD dashboard:

### 1. Option 1: Genetic Algorithm (GA) for Fleet Patrol / Multi-Port Optimization (Unit 2)
- **Syllabus Topic**: Informed Search: Genetic Algorithm.
- **Project Role**: Encodes multi-vessel waypoint routes and regional port delivery tours as permutation chromosomes across strategic Malacca stations (Penang Anchorage, One Fathom Bank, Port Klang, Dumai Straits, Phillips Channel, Singapore Roads, Belawan, Sabang).
- **Genetic Operators**:
  - **Tournament Selection** ($k=3$): Selects parent chromosomes probabilistically based on inverse tour distance fitness.
  - **Order Crossover (OX1)**: Preserves legitimate travelling-salesperson permutation sequences without duplicate waypoints.
  - **Inversion (2-opt) & Swap Mutation**: Prevents premature local optima convergence.
  - **Elitism**: Retains the fittest individual across generations.
- **Interactive UI**:
  - Live Generation Evolution Graph tracking best tour distance convergence vs. population mean distance.
  - Real-time fitness scoring and population diversity metric.
  - Interactive tour sequence inspector and "Plot Tour on Map" spatial overlay.
- **Endpoints**:
  - `GET /api/ai/genetic-algorithm/waypoints`: Strategic waypoint catalog.
  - `POST /api/ai/genetic-algorithm/run`: Triggers evolutionary optimization.

### 2. Option 2: Adversarial Search — Minimax with Alpha-Beta Pruning (Unit 2)
- **Syllabus Topic**: Adversarial Search: Optimal decisions in games, Minimax algorithm, Alpha-beta pruning.
- **Project Role**: Transforms the tactical maritime sector into a dynamic 2-player zero-sum pursuit-evasion duel:
  - **MAX Player**: Our Fleet Vessel attempting to navigate safely through coral shoals to an extraction gateway.
  - **MIN Player**: Hostile Drone / Fast Patrol Interceptor calculating pursuit vectors.
- **Alpha-Beta Pruning**:
  - Computes depth-limited minimax game trees with $\alpha$-cutoff and $\beta$-cutoff pruning.
  - Eliminates suboptimal subtrees whenever $\beta \le \alpha$, dramatically accelerating decision throughput.
- **Interactive UI**:
  - 8x8 tactical grid board with interactive water, coral reefs, extraction gateway, vessel, and interceptor tokens.
  - Step-by-step Minimax execution, Auto-Duel playback, and manual helm directional keypad (N, S, E, W, NW, NE, SW, SE, HOLD).
  - Alpha-Beta pruning telemetry displaying evaluated nodes, branches pruned, utility evaluation, and pruning efficiency %.
  - Visual Decision Tree viewer illustrating evaluated branches vs pruned cutoffs.
- **Endpoints**:
  - `GET /api/ai/minimax/state`: Active game board state and pruning telemetry.
  - `POST /api/ai/minimax/move`: Executes one Minimax turn or manual helm action.
  - `POST /api/ai/minimax/reset`: Resets tactical grid to initial sector layout.

### 3. Option 7: Rule-Based Maritime Expert System with "Why/How" Explanations (Unit 6)
- **Syllabus Topic**: Expert System: Architecture (Knowledge base, inference engine, working memory), development process, explanation facility.
- **Project Role**: Embedded navigation advisory intelligence ensuring IMO COLREGs compliance and shallow-water under-keel clearance along the Strait of Malacca.
- **Architecture**:
  - **Knowledge Base (KB)**: Priority-ranked production rules (`RULE-01` to `RULE-06`) governing squat effects, transit deviations, bottleneck chokepoints, monsoonal squalls, and exclusion zones.
  - **Working Memory (WM)**: Active facts derived from live vessel AIS telemetry (depth, speed, heading, position, drift, chokepoint proximity).
  - **Inference Engine (IE)**: Forward-chaining pattern matcher with priority dominance conflict resolution.
  - **Explanation Facility (EF)**:
    - **"WHY" Explanation**: Explains exactly why an advisory was issued, detailing matched antecedent premises, actual sensor values, regulatory rationale, and governing COLREGs rule.
    - **"HOW" Explanation**: Visualizes the step-by-step forward-chaining derivation chain and asserted actions.
- **Interactive UI**:
  - Embedded AI Expert Advisory cockpit widget directly on the Vessel Position Command Deck.
  - Live "⚡ RUN INFERENCE" and "❓ EXPLAIN ADVISORY (WHY / HOW)" quick-launch modal.
  - Working Memory live facts table and interactive "What-If Sensor Test Lab" (slider override for depth, speed, weather, drift).
  - Knowledge Base rule explorer with antecedent/consequent inspections.
- **Endpoints**:
  - `GET /api/ai/expert-system/rules`: Inspects complete Knowledge Base production rules.
  - `POST /api/ai/expert-system/evaluate`: Runs forward-chaining inference on vessel telemetry or custom sandbox facts.
