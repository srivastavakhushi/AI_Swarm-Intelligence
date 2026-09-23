"""
Maritime Fleet Defense & Risk-Aware Route Optimization System
---------------------------------------------------------------
PROTOTYPE 2: TRAINED RISK CLASSIFIER (Supervised ML)

This upgrades the "AI-based risk analysis" block from a hand-written
formula (prototype 1) to an actual TRAINED model.

Workflow implemented here (matches the 6-stage pipeline diagram):
  1. Problem definition   -> predict SAFE(0) / RISKY(1) for a grid cell
                              given navigation features.
  2. Data collection      -> simulate a labeled "historical incident"
                              dataset (stand-in for real AIS/weather/
                              threat logs you'd collect later).
  3. Feature engineering  -> distance to nearest threat, distance to
                              restricted zone, weather severity,
                              vessel proximity density.
  4. Model training       -> Random Forest classifier, train/test split.
  5. Evaluation           -> accuracy, precision, recall, F1, confusion
                              matrix.
  6. Integration          -> use the TRAINED model's predicted risk
                              probability as the new risk map, then feed
                              it into A* to compute the safest route.

Only needs: numpy, scikit-learn, matplotlib.
"""

import heapq
import math
import random

import numpy as np
import matplotlib.pyplot as plt
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import (accuracy_score, precision_score, recall_score,
                              f1_score, confusion_matrix, classification_report)

GRID_SIZE = 20
RNG_SEED = 42

# Same threat / restricted-zone layout as prototype 1, so the two
# prototypes are directly comparable.
THREAT_CENTERS = [(5, 5), (12, 14), (16, 4)]


def build_environment(seed=RNG_SEED):
    rng = random.Random(seed)
    terrain = np.zeros((GRID_SIZE, GRID_SIZE), dtype=int)
    for _ in range(18):
        x, y = rng.randint(0, GRID_SIZE - 1), rng.randint(0, GRID_SIZE - 1)
        terrain[y][x] = 1
    return terrain


# ----------------------------------------------------------------------
# 1 & 2. PROBLEM DEFINITION + DATA COLLECTION (simulated historical data)
# ----------------------------------------------------------------------

def dist_to_nearest(y, x, points):
    return min(math.hypot(x - px, y - py) for (px, py) in points)


def dist_to_nearest_restricted(y, x, terrain):
    restricted = np.argwhere(terrain == 1)
    if len(restricted) == 0:
        return GRID_SIZE
    return min(math.hypot(x - rx, y - ry) for (ry, rx) in restricted)


def simulate_dataset(terrain, n_samples=4000, seed=RNG_SEED):
    """Simulates historical voyage-log style records: for random
    positions + random weather conditions, computes navigation
    features and a ground-truth incident label (as if pulled from
    real logbooks of near-misses / safe transits)."""
    rng = np.random.default_rng(seed)
    rows = []

    for _ in range(n_samples):
        y = rng.uniform(0, GRID_SIZE - 1)
        x = rng.uniform(0, GRID_SIZE - 1)
        weather_severity = rng.uniform(0, 10)          # storm intensity etc.
        vessel_density = rng.uniform(0, 10)             # nearby traffic/congestion

        d_threat = dist_to_nearest(y, x, THREAT_CENTERS)
        d_restricted = dist_to_nearest_restricted(y, x, terrain)

        # --- ground-truth "real world" risk process (unknown to the model) ---
        true_risk = (
            max(0, 8 - d_threat) * 1.2
            + max(0, 5 - d_restricted) * 1.0
            + weather_severity * 0.5
            + vessel_density * 0.3
            + rng.normal(0, 1.0)      # noise, like real incident data has
        )
        label = 1 if true_risk > 7.0 else 0  # 1 = risky / incident, 0 = safe

        rows.append([d_threat, d_restricted, weather_severity, vessel_density, label])

    data = np.array(rows)
    X, y_labels = data[:, :4], data[:, 4].astype(int)
    return X, y_labels


FEATURE_NAMES = ["dist_to_threat", "dist_to_restricted_zone",
                  "weather_severity", "vessel_density"]


# ----------------------------------------------------------------------
# 3 & 4. FEATURE ENGINEERING + MODEL TRAINING
# ----------------------------------------------------------------------

def train_risk_model(X, y_labels):
    X_train, X_test, y_train, y_test = train_test_split(
        X, y_labels, test_size=0.25, random_state=RNG_SEED, stratify=y_labels
    )

    model = RandomForestClassifier(
        n_estimators=200, max_depth=8, random_state=RNG_SEED, class_weight="balanced"
    )
    model.fit(X_train, y_train)

    return model, X_test, y_test


# ----------------------------------------------------------------------
# 5. EVALUATION
# ----------------------------------------------------------------------

def evaluate_model(model, X_test, y_test):
    y_pred = model.predict(X_test)
    metrics = {
        "accuracy": accuracy_score(y_test, y_pred),
        "precision": precision_score(y_test, y_pred),
        "recall": recall_score(y_test, y_pred),
        "f1": f1_score(y_test, y_pred),
    }
    cm = confusion_matrix(y_test, y_pred)
    report = classification_report(y_test, y_pred, target_names=["Safe", "Risky"])
    feature_importance = dict(zip(FEATURE_NAMES, model.feature_importances_.round(3)))
    return metrics, cm, report, feature_importance


# ----------------------------------------------------------------------
# 6. INTEGRATION: use trained model to build a learned risk map,
#    then feed it into A* for route optimization.
# ----------------------------------------------------------------------

def predict_grid_risk(model, terrain, weather_severity=4.0, vessel_density=3.0):
    """Runs the TRAINED model over every grid cell to build a risk map,
    replacing the hand-written formula from prototype 1."""
    risk_map = np.zeros((GRID_SIZE, GRID_SIZE))
    for y in range(GRID_SIZE):
        for x in range(GRID_SIZE):
            if terrain[y][x] == 1:
                risk_map[y][x] = 10  # impassable, treat as max risk visually
                continue
            d_threat = dist_to_nearest(y, x, THREAT_CENTERS)
            d_restricted = dist_to_nearest_restricted(y, x, terrain)
            features = [[d_threat, d_restricted, weather_severity, vessel_density]]
            risk_prob = model.predict_proba(features)[0][1]   # P(risky)
            risk_map[y][x] = risk_prob * 10                    # scale to 0-10
    return risk_map


def neighbors(node, terrain):
    y, x = node
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            if dy == 0 and dx == 0:
                continue
            ny, nx = y + dy, x + dx
            if 0 <= ny < GRID_SIZE and 0 <= nx < GRID_SIZE and terrain[ny][nx] == 0:
                yield (ny, nx)


def step_cost(a, b, risk_map, alpha=1.0, beta=2.5):
    dist = math.hypot(a[0] - b[0], a[1] - b[1])
    return alpha * dist + beta * risk_map[b[0]][b[1]]


def heuristic(a, b):
    return math.hypot(a[0] - b[0], a[1] - b[1])


def astar(start, goal, terrain, risk_map):
    g_score = {start: 0}
    prev = {}
    open_set = [(heuristic(start, goal), start)]
    visited = set()

    while open_set:
        _, node = heapq.heappop(open_set)
        if node in visited:
            continue
        visited.add(node)
        if node == goal:
            break
        for nxt in neighbors(node, terrain):
            ng = g_score[node] + step_cost(node, nxt, risk_map)
            if nxt not in g_score or ng < g_score[nxt]:
                g_score[nxt] = ng
                prev[nxt] = node
                heapq.heappush(open_set, (ng + heuristic(nxt, goal), nxt))

    if goal not in prev and goal != start:
        return [], float("inf")
    path = [goal]
    while path[-1] != start:
        path.append(prev[path[-1]])
    path.reverse()
    return path, g_score.get(goal, float("inf"))


# ----------------------------------------------------------------------
# VISUALIZATION
# ----------------------------------------------------------------------

def visualize(terrain, risk_map, cm, path, start, goal, filename="ml_risk_prototype.png"):
    fig, axes = plt.subplots(1, 2, figsize=(13, 6))

    # --- left: learned risk map + route ---
    ax = axes[0]
    display = np.ma.masked_where(terrain == 1, risk_map)
    im = ax.imshow(display, cmap="YlOrRd", origin="upper", vmin=0, vmax=10)
    ax.imshow(np.ma.masked_where(terrain == 0, terrain), cmap="Greys", origin="upper")
    if path:
        ys = [p[0] for p in path]
        xs = [p[1] for p in path]
        ax.plot(xs, ys, color="blue", linewidth=2, label="A* route (ML risk)")
    ax.scatter([start[1]], [start[0]], c="black", marker="o", s=80, label="Start")
    ax.scatter([goal[1]], [goal[0]], c="black", marker="*", s=150, label="Goal")
    plt.colorbar(im, ax=ax, label="Predicted risk (0-10)")
    ax.set_title("Model-predicted risk map + optimized route")
    ax.legend(loc="upper left", fontsize=8)

    # --- right: confusion matrix ---
    ax2 = axes[1]
    im2 = ax2.imshow(cm, cmap="Blues")
    ax2.set_xticks([0, 1]); ax2.set_xticklabels(["Safe", "Risky"])
    ax2.set_yticks([0, 1]); ax2.set_yticklabels(["Safe", "Risky"])
    ax2.set_xlabel("Predicted"); ax2.set_ylabel("Actual")
    ax2.set_title("Confusion matrix (test set)")
    for i in range(2):
        for j in range(2):
            ax2.text(j, i, str(cm[i][j]), ha="center", va="center",
                      color="white" if cm[i][j] > cm.max() / 2 else "black", fontsize=14)
    plt.colorbar(im2, ax=ax2)

    plt.tight_layout()
    plt.savefig(filename, dpi=150)
    print(f"[saved] {filename}")


# ----------------------------------------------------------------------
# MAIN
# ----------------------------------------------------------------------

def main():
    print("=" * 65)
    print("RISK CLASSIFIER PROTOTYPE (Supervised ML)")
    print("=" * 65)

    terrain = build_environment()

    print("\n[1] Problem: predict SAFE(0) / RISKY(1) per navigation point")

    print("[2] Simulating labeled historical dataset...")
    X, y_labels = simulate_dataset(terrain, n_samples=4000)
    print(f"    -> {len(X)} samples, {y_labels.sum()} risky / {len(y_labels)-y_labels.sum()} safe")

    print("[3] Features:", FEATURE_NAMES)

    print("[4] Training RandomForestClassifier...")
    model, X_test, y_test = train_risk_model(X, y_labels)

    print("[5] Evaluating on held-out test set...")
    metrics, cm, report, importance = evaluate_model(model, X_test, y_test)
    print(f"    Accuracy : {metrics['accuracy']:.3f}")
    print(f"    Precision: {metrics['precision']:.3f}")
    print(f"    Recall   : {metrics['recall']:.3f}")
    print(f"    F1 score : {metrics['f1']:.3f}")
    print("    Confusion matrix [ [TN FP] [FN TP] ]:\n", cm)
    print("    Feature importance:", importance)
    print("\n", report)

    print("[6] Integrating trained model into route optimizer...")
    risk_map = predict_grid_risk(model, terrain)
    start, goal = (0, 0), (GRID_SIZE - 1, GRID_SIZE - 1)
    path, cost = astar(start, goal, terrain, risk_map)
    print(f"    A* route using ML-predicted risk: steps={len(path)}, cost={cost:.2f}")

    visualize(terrain, risk_map, cm, path, start, goal)


if __name__ == "__main__":
    main()
