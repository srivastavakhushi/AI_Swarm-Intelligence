"""
Maritime Fleet Defense & Risk-Aware Route Optimization System
---------------------------------------------------------------
BASIC AI PROTOTYPE - REAL-WORLD DATA VERSION

Covers the "AI-based Risk Analysis + Route Optimization + Alternate
Route Finding" block from the activity diagram, using:
    - Dijkstra's Algorithm      -> guaranteed shortest, risk-weighted path
    - A* Algorithm              -> faster informed search (heuristic-guided)
    - Ant Colony Optimization   -> nature-inspired route optimizer that
                                    balances distance AND risk together
    - Risk Analysis module      -> scores any route for safety
    - Alternate Route module    -> reroutes if a path is rejected / unsafe

WHAT CHANGED FROM THE FIRST PROTOTYPE
--------------------------------------
The map is no longer a random 20x20 grid with randomly scattered land
cells and threat centers. It is now a real latitude/longitude grid over
the Gulf of Aden / Horn of Africa corridor - one of the world's most
heavily reported piracy corridors (Bab-el-Mandeb, the Gulf of Aden, and
the Somali Basin off Eyl and Hobyo). Sources for the coordinates below:

  - Coastline reference points: approximate real coastal positions of
    Djibouti, Yemen (Aden/Mukalla) and Somalia (Berbera/Bosaso/Eyl/Hobyo).
  - Port positions: publicly known port coordinates (Djibouti, Aden,
    Berbera, Bosaso, Mukalla).
  - Threat/piracy hotspot positions: approximate locations repeatedly
    named in 2025-2026 maritime security advisories (US MARAD Advisory
    2026-002, IMB/ICC reporting, UKMTO) as active piracy/armed-robbery
    zones - Bab-el-Mandeb, the waters off Eyl, and the waters off Hobyo.
  - Restricted zone: the Bab-el-Mandeb strait chokepoint (mandatory
    UKMTO registration zone / narrow high-traffic strait).

This is still a coarse-grid prototype (each cell is a rough
lat/lon patch, not a nautical chart), but every coordinate below refers
to a real place instead of `random.randint(...)`. The next step for a
production system is to swap this hand-placed data for a real
coastline shapefile (e.g. Natural Earth / NOAA ENC), live AIS feeds,
and a live piracy-incident feed (see "what's next" notes at the bottom
of the chat response this file was generated in).
"""

import heapq
import math

import numpy as np
import matplotlib.pyplot as plt

# ----------------------------------------------------------------------
# 1. REAL-WORLD MAP: Gulf of Aden / Horn of Africa corridor
# ----------------------------------------------------------------------

# Geographic bounding box of the study area (degrees).
# (Kept to the Gulf of Aden corridor itself - Djibouti to Bosaso - so a
# single simple coastline function stays geographically valid. The
# Somali Basin further south, e.g. off Hobyo, curves back westward
# around Cape Guardafui and needs a real coastline polygon rather than
# a single lat(lon) function; see "what's next" notes.)
LAT_MIN, LAT_MAX = 8.0, 15.0      # south -> north
LON_MIN, LON_MAX = 42.0, 51.5     # west -> east

# Grid resolution: ~0.25 degrees per cell (~28km at this latitude).
GRID_H = 46   # rows  (latitude direction)
GRID_W = 38   # cols  (longitude direction)

RISK_THRESHOLD = 7.0  # any cell above this = "high risk"

# --- real port locations (lat, lon) ---
PORTS = {
    "Djibouti":        (11.8251, 42.5903),
    "Aden (Yemen)":    (12.7855, 45.0187),
    "Berbera":         (10.4396, 45.0143),
    "Mukalla (Yemen)": (14.5425, 49.1242),
    "Bosaso":          (11.2842, 49.1816),
}

# --- real piracy / threat hotspots (lat, lon), named per 2025-2026
#     maritime security advisories (MARAD 2026-002, IMB/UKMTO). Off
#     Hobyo, Somalia is a real, currently-reported hotspot too, but it
#     sits south of Cape Guardafui where the coastline curves back
#     westward - outside this corridor's simplified bounding box. ---
THREAT_ZONES = {
    "Bab-el-Mandeb strait":  (12.60, 43.40),
    "Off Eyl, Somalia":      (8.20, 49.60),
}

# --- restricted / mandatory-reporting zone (Bab-el-Mandeb chokepoint) ---
RESTRICTED_ZONES = {
    "Bab-el-Mandeb chokepoint": (12.60, 43.40),
}


def latlon_to_cell(lat, lon):
    row = int((lat - LAT_MIN) / (LAT_MAX - LAT_MIN) * (GRID_H - 1))
    col = int((lon - LON_MIN) / (LON_MAX - LON_MIN) * (GRID_W - 1))
    row = min(max(row, 0), GRID_H - 1)
    col = min(max(col, 0), GRID_W - 1)
    return (row, col)


def cell_to_latlon(row, col):
    lat = LAT_MIN + (row / (GRID_H - 1)) * (LAT_MAX - LAT_MIN)
    lon = LON_MIN + (col / (GRID_W - 1)) * (LON_MAX - LON_MIN)
    return lat, lon


def _yemen_coast_lat(lon):
    """Approximate southern coastline of Yemen (land is NORTH of this
    latitude), built from real reference points along the coast."""
    lons = [42.5, 43.4, 45.0, 47.0, 49.1, 51.5]
    lats = [12.0, 12.7, 13.0, 13.8, 14.5, 15.0]
    return float(np.interp(lon, lons, lats))


def _somalia_coast_lat(lon):
    """Approximate northern coastline of Somalia + Djibouti along the
    Gulf of Aden (land is SOUTH of this latitude), built from real
    reference points (Djibouti, Berbera, Bosaso, and the coast curving
    north again toward Cape Guardafui)."""
    lons = [42.5, 43.0, 45.0, 47.0, 49.18, 51.0, 51.5]
    lats = [11.6, 11.8, 10.4, 10.6, 11.0, 11.8, 12.0]
    return float(np.interp(lon, lons, lats))


def generate_real_world_map():
    """Builds terrain (land/restricted) and risk grids from the real
    coastline references and threat/port coordinates above, instead of
    randomly scattered cells."""
    terrain = np.zeros((GRID_H, GRID_W), dtype=int)
    risk = np.zeros((GRID_H, GRID_W), dtype=float)

    for row in range(GRID_H):
        for col in range(GRID_W):
            lat, lon = cell_to_latlon(row, col)

            # --- land mask from real coastlines ---
            if lat >= _yemen_coast_lat(lon):
                terrain[row][col] = 1        # Arabian peninsula landmass
                continue
            if lat <= _somalia_coast_lat(lon):
                terrain[row][col] = 1        # Horn of Africa landmass
                continue

            # --- baseline open-water risk (low, small real variability) ---
            risk[row][col] = 1.5

    # --- risk contribution from real piracy hotspots ---
    for name, (t_lat, t_lon) in THREAT_ZONES.items():
        for row in range(GRID_H):
            for col in range(GRID_W):
                if terrain[row][col] == 1:
                    continue
                lat, lon = cell_to_latlon(row, col)
                # distance in degrees, converted roughly to grid-cell units
                dist_deg = math.hypot(lat - t_lat, lon - t_lon)
                dist_cells = dist_deg / ((LAT_MAX - LAT_MIN) / GRID_H)
                risk[row][col] += max(0, 9 - dist_cells * 0.6)

    # --- risk contribution from the restricted chokepoint ---
    for name, (r_lat, r_lon) in RESTRICTED_ZONES.items():
        for row in range(GRID_H):
            for col in range(GRID_W):
                if terrain[row][col] == 1:
                    continue
                lat, lon = cell_to_latlon(row, col)
                dist_deg = math.hypot(lat - r_lat, lon - r_lon)
                dist_cells = dist_deg / ((LAT_MAX - LAT_MIN) / GRID_H)
                risk[row][col] += max(0, 4 - dist_cells * 0.8)

    risk = np.clip(risk, 0, 10)
    return terrain, risk


# ----------------------------------------------------------------------
# 2. SHARED HELPERS
# ----------------------------------------------------------------------

def neighbors(node, terrain):
    """8-directional movement, skipping land/restricted cells."""
    h, w = terrain.shape
    y, x = node
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            if dy == 0 and dx == 0:
                continue
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and terrain[ny][nx] == 0:
                yield (ny, nx)


def step_cost(a, b, risk, alpha=1.0, beta=2.5):
    """Cost of moving from cell a -> b.
    alpha weights raw distance, beta weights risk avoidance.
    (beta > alpha means the system strongly prefers safety over speed)"""
    dist = math.hypot(a[0] - b[0], a[1] - b[1])
    return alpha * dist + beta * risk[b[0]][b[1]]


def path_total_cost(path, risk, alpha=1.0, beta=2.5):
    return sum(step_cost(path[i], path[i + 1], risk, alpha, beta)
               for i in range(len(path) - 1))


# ----------------------------------------------------------------------
# 3. DIJKSTRA'S ALGORITHM  (guaranteed optimal, risk-weighted)
# ----------------------------------------------------------------------

def dijkstra(start, goal, terrain, risk):
    dist = {start: 0}
    prev = {}
    visited = set()
    pq = [(0, start)]

    while pq:
        d, node = heapq.heappop(pq)
        if node in visited:
            continue
        visited.add(node)
        if node == goal:
            break
        for nxt in neighbors(node, terrain):
            nd = d + step_cost(node, nxt, risk)
            if nxt not in dist or nd < dist[nxt]:
                dist[nxt] = nd
                prev[nxt] = node
                heapq.heappush(pq, (nd, nxt))

    return _reconstruct(prev, start, goal), dist.get(goal, float("inf"))


# ----------------------------------------------------------------------
# 4. A* ALGORITHM  (faster, heuristic-guided)
# ----------------------------------------------------------------------

def heuristic(a, b):
    return math.hypot(a[0] - b[0], a[1] - b[1])


def astar(start, goal, terrain, risk):
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
            ng = g_score[node] + step_cost(node, nxt, risk)
            if nxt not in g_score or ng < g_score[nxt]:
                g_score[nxt] = ng
                prev[nxt] = node
                f = ng + heuristic(nxt, goal)
                heapq.heappush(open_set, (f, nxt))

    return _reconstruct(prev, start, goal), g_score.get(goal, float("inf"))


def _reconstruct(prev, start, goal):
    if goal not in prev and goal != start:
        return []
    path = [goal]
    while path[-1] != start:
        path.append(prev[path[-1]])
    path.reverse()
    return path


# ----------------------------------------------------------------------
# 5. ANT COLONY OPTIMIZATION (ACO)
#    Explores many candidate routes in parallel and lets the
#    lowest-risk / shortest ones reinforce themselves via pheromone.
# ----------------------------------------------------------------------

import random as _random


class AntColonyRouteOptimizer:
    def __init__(self, terrain, risk, n_ants=25, n_iterations=60,
                 evaporation=0.4, alpha=1.0, beta=3.0):
        self.terrain = terrain
        self.risk = risk
        self.n_ants = n_ants
        self.n_iterations = n_iterations
        self.evaporation = evaporation
        self.alpha = alpha
        self.beta = beta
        self.pheromone = {}

    def _pher(self, a, b):
        return self.pheromone.get((a, b), 1.0)

    def _desirability(self, a, b, goal):
        risk_penalty = self.risk[b[0]][b[1]] + 0.1
        progress = heuristic(a, goal) - heuristic(b, goal)
        progress_bonus = max(0.1, 1 + progress)
        return progress_bonus / risk_penalty

    def _construct_route(self, start, goal, max_steps=300):
        path = [start]
        current = start
        for _ in range(max_steps):
            if current == goal:
                break
            options = [n for n in neighbors(current, self.terrain) if n not in path]
            if not options:
                return None
            weights = []
            for opt in options:
                tau = self._pher(current, opt) ** self.alpha
                eta = self._desirability(current, opt, goal) ** self.beta
                weights.append(tau * eta)
            total = sum(weights)
            if total == 0:
                return None
            probs = [w / total for w in weights]
            current = _random.choices(options, weights=probs, k=1)[0]
            path.append(current)
        return path if path[-1] == goal else None

    def run(self, start, goal):
        best_path, best_cost = None, float("inf")

        for _ in range(self.n_iterations):
            iteration_routes = []
            for _ in range(self.n_ants):
                route = self._construct_route(start, goal)
                if route:
                    cost = path_total_cost(route, self.risk)
                    iteration_routes.append((route, cost))
                    if cost < best_cost:
                        best_path, best_cost = route, cost

            for edge in list(self.pheromone):
                self.pheromone[edge] *= (1 - self.evaporation)

            for route, cost in iteration_routes:
                deposit = 1.0 / (cost + 1e-6)
                for i in range(len(route) - 1):
                    edge = (route[i], route[i + 1])
                    self.pheromone[edge] = self.pheromone.get(edge, 1.0) + deposit

        return best_path, best_cost


# ----------------------------------------------------------------------
# 6. RISK ANALYSIS MODULE
# ----------------------------------------------------------------------

def analyze_route_risk(path, risk, threshold=RISK_THRESHOLD):
    if not path:
        return {"valid": False}

    risk_values = [risk[y][x] for (y, x) in path]
    high_risk_cells = [(y, x) for (y, x) in path if risk[y][x] >= threshold]

    return {
        "valid": True,
        "path_length": len(path),
        "avg_risk": round(float(np.mean(risk_values)), 2),
        "max_risk": round(float(np.max(risk_values)), 2),
        "high_risk_cell_count": len(high_risk_cells),
        "high_risk_cells": high_risk_cells,
        "is_safe": len(high_risk_cells) == 0,
    }


# ----------------------------------------------------------------------
# 7. ALTERNATE ROUTE FINDER
# ----------------------------------------------------------------------

def find_alternate_route(start, goal, terrain, risk, rejected_path, penalty=6.0):
    adjusted_risk = risk.copy()
    for (y, x) in rejected_path:
        adjusted_risk[y][x] = min(10, adjusted_risk[y][x] + penalty)
    return astar(start, goal, terrain, adjusted_risk)


# ----------------------------------------------------------------------
# 8. VISUALIZATION (with real lat/lon axes and named ports/hotspots)
# ----------------------------------------------------------------------

def visualize(terrain, risk, routes, start, goal, filename="route_comparison.png"):
    fig, ax = plt.subplots(figsize=(9, 9))
    display = np.ma.masked_where(terrain == 1, risk)
    im = ax.imshow(display, cmap="YlOrRd", origin="lower", vmin=0, vmax=10)
    ax.imshow(np.ma.masked_where(terrain == 0, terrain), cmap="Greys", origin="lower")

    colors = {"Dijkstra": "blue", "A*": "lime", "ACO": "cyan", "Alternate": "magenta"}
    for name, path in routes.items():
        if not path:
            continue
        ys = [p[0] for p in path]
        xs = [p[1] for p in path]
        ax.plot(xs, ys, color=colors.get(name, "white"), linewidth=2, label=name)

    ax.scatter([start[1]], [start[0]], c="black", marker="o", s=90, zorder=5, label="Start")
    ax.scatter([goal[1]], [goal[0]], c="black", marker="*", s=180, zorder=5, label="Goal")

    for name, (lat, lon) in THREAT_ZONES.items():
        r, c = latlon_to_cell(lat, lon)
        ax.scatter([c], [r], marker="x", c="darkred", s=60, zorder=5)
        ax.annotate(name, (c, r), fontsize=7, color="darkred", xytext=(4, 4),
                    textcoords="offset points")

    for name, (lat, lon) in PORTS.items():
        r, c = latlon_to_cell(lat, lon)
        ax.scatter([c], [r], marker="s", c="black", s=25, zorder=5)
        ax.annotate(name, (c, r), fontsize=7, color="black", xytext=(4, -8),
                    textcoords="offset points")

    # real lat/lon tick labels instead of raw grid indices
    n_ticks = 6
    row_ticks = np.linspace(0, GRID_H - 1, n_ticks)
    col_ticks = np.linspace(0, GRID_W - 1, n_ticks)
    ax.set_yticks(row_ticks)
    ax.set_yticklabels([f"{cell_to_latlon(r, 0)[0]:.1f}N" for r in row_ticks])
    ax.set_xticks(col_ticks)
    ax.set_xticklabels([f"{cell_to_latlon(0, c)[1]:.1f}E" for c in col_ticks])

    plt.colorbar(im, label="Risk Level (0-10)")
    ax.set_title("Gulf of Aden / Horn of Africa: Real-Data Risk Map & Candidate Routes")
    ax.legend(loc="upper left", fontsize=8)
    plt.tight_layout()
    plt.savefig(filename, dpi=150)
    print(f"[saved] {filename}")


# ----------------------------------------------------------------------
# 9. DEMO / MAIN
# ----------------------------------------------------------------------

def main():
    terrain, risk = generate_real_world_map()

    # Real voyage scenario: depart Djibouti and transit the full length
    # of the Gulf of Aden to Bosaso, Somalia - a route that realistically
    # must consider the Bab-el-Mandeb chokepoint near the start and the
    # Eyl piracy hotspot along the Somali coast further east.
    start = latlon_to_cell(*PORTS["Djibouti"])
    goal = latlon_to_cell(*PORTS["Bosaso"])

    print("=" * 65)
    print("MARITIME ROUTE AI PROTOTYPE - REAL-WORLD DATA (Gulf of Aden)")
    print("=" * 65)
    print(f"Start: Djibouti  {PORTS['Djibouti']}  -> grid {start}")
    print(f"Goal:  Bosaso    {PORTS['Bosaso']}  -> grid {goal}")

    dpath, dcost = dijkstra(start, goal, terrain, risk)
    print(f"\n[Dijkstra] cost={dcost:.2f}  steps={len(dpath)}")
    print("  Risk analysis:", analyze_route_risk(dpath, risk))

    apath, acost = astar(start, goal, terrain, risk)
    print(f"\n[A*] cost={acost:.2f}  steps={len(apath)}")
    print("  Risk analysis:", analyze_route_risk(apath, risk))

    aco = AntColonyRouteOptimizer(terrain, risk)
    aco_path, aco_cost = aco.run(start, goal)
    print(f"\n[ACO] cost={aco_cost:.2f}  steps={len(aco_path) if aco_path else 0}")
    aco_analysis = analyze_route_risk(aco_path, risk)
    print("  Risk analysis:", aco_analysis)

    routes = {"Dijkstra": dpath, "A*": apath, "ACO": aco_path}

    if aco_path and not aco_analysis["is_safe"]:
        print("\n[Fleet Commander] Route REJECTED (unsafe). Recalculating...")
        alt_path, alt_cost = find_alternate_route(start, goal, terrain, risk, aco_path)
        print(f"[Alternate Route] cost={alt_cost:.2f}  steps={len(alt_path)}")
        print("  Risk analysis:", analyze_route_risk(alt_path, risk))
        routes["Alternate"] = alt_path
    else:
        print("\n[Fleet Commander] Route APPROVED.")

    visualize(terrain, risk, routes, start, goal)


if __name__ == "__main__":
    main()
