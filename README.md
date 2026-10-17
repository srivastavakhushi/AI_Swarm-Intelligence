# AEGIS: Maritime Fleet Defense & Pure ACO Route Optimizer

### Experiment 4 Prototype • Autonomous Maritime Swarm Intelligence & Risk-Aware Navigation

Autonomous maritime fleet defense and dynamic route planning system for high-risk maritime corridors (Strait of Malacca). This project implements the core foundational architecture and all swimlanes from the **Software Engineering Experiment 4 UML Activity Diagram**:

- **External Maritime Data Feeds**: Real-time integration of historical piracy intelligence (996 incidents), Southwest Monsoon current drift, bathymetric navigational shoals, and restricted TSS chokepoints.
- **Multi-Role Authentication & Security**: Role-based dispatch (Fleet Commander, Vessel Crew, System Admin) with a 3-attempt account lockout mechanism.
- **Threat Monitoring & AI Risk Analysis**: Real-time threat zone detection and piracy cluster alerts.
- **Pure Ant Colony Optimization (ACO) Engine**: Probabilistic ant swarm path construction with synthetic pheromone evaporation and heuristic desirability.
- **Fleet Commander Review Loop**: Tactical route approval and dynamic recalculation trigger.
- **Vessel Crew Voyage Transit**: Step-by-step route transit simulation and deviation reporting.
- **Operational Audit Logging**: Complete immutable event logging and JSON record export.

---

## Base Model Screenshots & UI Previews

### 1. Interactive Command Dashboard & ACO Route Synthesis
The primary base dashboard showcasing the 7-stage UML Activity Diagram progress stepper, external telemetry feeds, threat detection alerts, and the synthesized water-navigable ACO safe route on the interactive maritime map.

![Base Model Dashboard](docs/screenshots/base_dashboard.png)

### 2. Ant Colony Optimization (ACO) Parameter Tuner & Convergence
Interactive tuner interface allowing real-time parameter configuration (Ant Population $N_{\text{ants}}$, Max Iterations, Pheromone Sensitivity $\alpha$, Heuristic Desirability $\beta$, Evaporation Rate $\rho$) along with live Colony Route Cost Convergence curves.

![ACO Parameter Tuner](docs/screenshots/base_aco_tuner.png)

### 3. Operational Audit & Event Logging
Immutable audit log recording every automated transition, ACO candidate evaluations, risk score computations, and commander approvals.

![Base Operational Audit Logs](docs/screenshots/base_audit_logs.png)

---

## Algorithmic Prototype & Machine Learning Visualizations

### 1. Pure ACO Maritime Route Optimization & Cost Minimization
Autonomous Ant Colony Optimization pathfinding across the Strait of Malacca displaying the primary safe corridor (395.3 NM), alternate route (404.1 NM), and iterative composite route cost minimization over 35 iterations.

![ACO Malacca Prototype](aco_malacca_prototype.png)

### 2. Machine Learning Piracy Risk Classifier & Confusion Matrix
Random Forest classification predicting maritime cell risk levels from historical incident data, showing the model-predicted risk heatmap alongside the test-set confusion matrix (843 true risky, 93 true safe).

![ML Risk Classifier Prototype](ml_risk_prototype.png)

### 3. Multi-Algorithm Candidate Route Evaluation
Candidate route comparison across real-data risk heatmaps evaluating shortest path (Dijkstra), heuristic risk penalty (A*), and probabilistic swarm optimization (ACO).

![Route Comparison](route_comparison.png)

---

## Repository Structure & Core Modules

| File | Description |
| :--- | :--- |
| [`aco_engine.py`](aco_engine.py) | Pure Ant Colony Optimization (ACO) probabilistic engine and pheromone update rules |
| [`risk_classifier_ai.py`](risk_classifier_ai.py) | Random Forest ML piracy risk model trained on historical incident data |
| [`maritime_environment.py`](maritime_environment.py) | Discrete coordinate grid, nautical distance calculations, and hazard maps |
| [`workflow_system.py`](workflow_system.py) | State-machine workflow engine coordinating all Experiment 4 swimlanes |
| [`app.py`](app.py) | Flask web backend serving the interactive command dashboard |
| [`pirate_attacks.csv`](pirate_attacks.csv) | Historical maritime piracy incidents dataset |
| [`operational_records.json`](operational_records.json) | Exported audit telemetry and completed voyage records |
| [`SE_EXP4_N068.pdf`](SE_EXP4_N068.pdf) | Software Engineering Experiment 4 academic lab report (Roll No: N068) |
| [`run_prototype.py`](run_prototype.py) | Standalone end-to-end command-line simulation pipeline |
| [`ai.py`](ai.py) | Standalone ACO routing and risk evaluation prototype |
| [`templates/`](templates/) | HTML templates for the base web application |
| [`static/`](static/) | CSS styling and JavaScript logic for the base web application |

---

## Installation & Running the Base Application

### 1. Environment Setup

```bash
# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install required dependencies
pip install flask numpy pandas scikit-learn matplotlib
```

### 2. Run the Web Dashboard

```bash
python app.py
```

Open your browser and navigate to:
```text
http://127.0.0.1:5050
```

### 3. Run Standalone Prototypes

- **Complete Workflow Pipeline with Route Plots:**
  ```bash
  python run_prototype.py
  ```

- **Trained AI Risk Classifier Evaluation:**
  ```bash
  python risk_classifier_ai.py
  ```

- **Standalone ACO Route Optimization:**
  ```bash
  python ai.py
  ```
