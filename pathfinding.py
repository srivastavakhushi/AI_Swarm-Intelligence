"""
Risk-aware graph search routers for the Strait of Malacca grid.

Dijkstra: uniform-cost search, guaranteed optimal under the additive
          multi-hazard edge cost.
A*:       same edge cost with an admissible nautical-mile / transit-time
          heuristic for faster informed search.
"""

import heapq
import time

import numpy as np

from maritime_environment import cell_to_latlon, haversine_nm


# Distinct objective weights so Dijkstra (shortest water path) and A*
# (risk-aware water path) do not collapse to the same corridor.
SOLVER_PROFILES = {
    "dijkstra": {
        "weight_dist": 1.25,
        "weight_time": 0.12,
        "weight_risk": 0.08,
        "weight_restricted": 0.20,
    },
    "astar": {
        "weight_dist": 0.22,
        "weight_time": 0.18,
        "weight_risk": 4.40,
        "weight_restricted": 3.10,
    },
}


def evaluate_route_metrics(
    env,
    path,
    weight_dist=0.40,
    weight_time=0.25,
    weight_risk=3.50,
    weight_restricted=2.50,
    include_geo=False,
):
    """Scores a grid path with the same multi-objective metrics as ACO."""
    if not path or len(path) < 2:
        return None

    total_dist_nm = 0.0
    total_time_hrs = 0.0
    risks = []
    piracy_scores = []
    weather_scores = []
    restricted_scores = []

    for i in range(len(path) - 1):
        comps = env.get_cell_cost_components(path[i], path[i + 1])
        total_dist_nm += comps["dist_nm"]
        total_time_hrs += comps["travel_time_hrs"]
        risks.append(comps["risk"])
        piracy_scores.append(comps["piracy"])
        weather_scores.append(comps["weather"])
        restricted_scores.append(comps["restricted"])

    avg_risk = float(np.mean(risks))
    max_risk = float(np.max(risks))
    avg_piracy = float(np.mean(piracy_scores))
    max_piracy = float(np.max(piracy_scores))
    avg_weather = float(np.mean(weather_scores))
    total_restricted = float(np.sum(restricted_scores))

    cost = (
        weight_dist * (total_dist_nm / 10.0)
        + weight_time * total_time_hrs
        + weight_risk * (avg_risk * 2.0 + max_risk * 1.5)
        + weight_restricted * (total_restricted * 1.2)
    )

    metrics = {
        "path": path,
        "cost": cost,
        "total_dist_nm": round(total_dist_nm, 1),
        "total_time_hrs": round(total_time_hrs, 1),
        "avg_risk": round(avg_risk, 2),
        "max_risk": round(max_risk, 2),
        "avg_piracy": round(avg_piracy, 2),
        "max_piracy": round(max_piracy, 2),
        "avg_weather": round(avg_weather, 2),
        "restricted_penalty": round(total_restricted, 2),
        "is_safe": max_risk < 7.5 and max_piracy < 7.0,
        "waypoint_count": len(path),
    }
    if include_geo:
        metrics["geo_coordinates"] = env.path_to_water_geo(path)
    return metrics


def build_penalty_mask(primary_route_path, penalty_factor=6.0):
    """Inflates cost along a rejected / primary corridor so an alternate path diverges."""
    penalty_mask = {}
    for (r, c) in primary_route_path:
        penalty_mask[(r, c)] = penalty_factor
        for dr in (-1, 0, 1):
            for dc in (-1, 0, 1):
                nr, nc = r + dr, c + dc
                if (nr, nc) not in penalty_mask:
                    penalty_mask[(nr, nc)] = penalty_factor * 0.5
    return penalty_mask


class GraphSearchRouter:
    """Dijkstra and A* routers on the maritime environment grid."""

    def __init__(
        self,
        env,
        weight_dist=0.40,
        weight_time=0.25,
        weight_risk=3.50,
        weight_restricted=2.50,
        vessel_speed_knots=18.0,
    ):
        self.env = env
        self.weight_dist = weight_dist
        self.weight_time = weight_time
        self.weight_risk = weight_risk
        self.weight_restricted = weight_restricted
        self.vessel_speed_knots = vessel_speed_knots

    def _edge_cost(self, from_node, to_node, penalty_mask=None):
        comps = self.env.get_cell_cost_components(from_node, to_node, self.vessel_speed_knots)
        extra = 0.0
        if penalty_mask and to_node in penalty_mask:
            extra = penalty_mask[to_node]
        return (
            self.weight_dist * (comps["dist_nm"] / 10.0)
            + self.weight_time * comps["travel_time_hrs"]
            + self.weight_risk * comps["risk"]
            + self.weight_restricted * comps["restricted"]
            + extra
        )

    def _heuristic(self, node, goal):
        """
        Admissible lower bound on the remaining cost.

        Combines the great-circle distance and unimpeded transit time with the
        cheapest possible risk charge: reaching the goal needs at least as many
        moves as the Chebyshev cell distance, and every move is charged at least
        the minimum risk found anywhere in open water. Ignoring this term made A*
        degenerate into Dijkstra, because risk dominates the real edge cost.
        """
        lat1, lon1 = cell_to_latlon(*node)
        lat2, lon2 = cell_to_latlon(*goal)
        dist_nm = haversine_nm(lat1, lon1, lat2, lon2)
        min_time = dist_nm / self.vessel_speed_knots

        min_steps = max(abs(node[0] - goal[0]), abs(node[1] - goal[1]))
        min_risk = getattr(self.env, "min_water_risk", 0.0)

        return (
            self.weight_dist * (dist_nm / 10.0)
            + self.weight_time * min_time
            + self.weight_risk * min_risk * min_steps
        )

    def _reconstruct(self, prev, start, goal):
        if goal != start and goal not in prev:
            return []
        path = [goal]
        while path[-1] != start:
            path.append(prev[path[-1]])
        path.reverse()
        return path

    def _dijkstra(self, start, goal, penalty_mask=None):
        dist = {start: 0.0}
        prev = {}
        visited = set()
        pq = [(0.0, 0, start)]
        tie = 1

        while pq:
            d, _, node = heapq.heappop(pq)
            if node in visited:
                continue
            visited.add(node)
            if node == goal:
                break
            for nxt in self.env.get_valid_neighbors(node):
                nd = d + self._edge_cost(node, nxt, penalty_mask)
                if nxt not in dist or nd < dist[nxt]:
                    dist[nxt] = nd
                    prev[nxt] = node
                    heapq.heappush(pq, (nd, tie, nxt))
                    tie += 1

        return self._reconstruct(prev, start, goal), visited

    def _astar(self, start, goal, penalty_mask=None):
        g_score = {start: 0.0}
        prev = {}
        visited = set()
        pq = [(self._heuristic(start, goal), 0, start)]
        tie = 1

        while pq:
            _, _, node = heapq.heappop(pq)
            if node in visited:
                continue
            visited.add(node)
            if node == goal:
                break
            for nxt in self.env.get_valid_neighbors(node):
                ng = g_score[node] + self._edge_cost(node, nxt, penalty_mask)
                if nxt not in g_score or ng < g_score[nxt]:
                    g_score[nxt] = ng
                    prev[nxt] = node
                    f_score = ng + self._heuristic(nxt, goal)
                    heapq.heappush(pq, (f_score, tie, nxt))
                    tie += 1

        return self._reconstruct(prev, start, goal), visited

    def _finalize(self, path, algorithm, nodes_explored, runtime_ms):
        metrics = evaluate_route_metrics(
            self.env,
            path,
            self.weight_dist,
            self.weight_time,
            self.weight_risk,
            self.weight_restricted,
            include_geo=True,
        )
        if not metrics:
            return None
        metrics["algorithm"] = algorithm
        metrics["nodes_explored"] = nodes_explored
        metrics["runtime_ms"] = runtime_ms
        return metrics

    def solve(self, start, goal, algorithm="astar", penalty_mask=None):
        algorithm = "dijkstra" if algorithm == "dijkstra" else "astar"
        profile = SOLVER_PROFILES[algorithm]
        saved = (self.weight_dist, self.weight_time, self.weight_risk, self.weight_restricted)
        self.weight_dist = profile["weight_dist"]
        self.weight_time = profile["weight_time"]
        self.weight_risk = profile["weight_risk"]
        self.weight_restricted = profile["weight_restricted"]

        t0 = time.perf_counter()
        try:
            if algorithm == "dijkstra":
                path, visited = self._dijkstra(start, goal, penalty_mask)
            else:
                path, visited = self._astar(start, goal, penalty_mask)
            runtime_ms = round((time.perf_counter() - t0) * 1000.0, 2)
            best_route = self._finalize(path, algorithm, len(visited), runtime_ms)
        finally:
            self.weight_dist, self.weight_time, self.weight_risk, self.weight_restricted = saved

        cost = best_route["cost"] if best_route else None
        return {
            "best_route": best_route,
            "convergence_history": [
                {
                    "iteration": 1,
                    "best_cost": round(cost, 2) if cost is not None else None,
                    "avg_cost": round(cost, 2) if cost is not None else None,
                    "successful_ants": 1 if best_route else 0,
                    "nodes_explored": len(visited),
                    "algorithm": algorithm,
                    "runtime_ms": runtime_ms,
                }
            ],
            "sample_candidate_paths": [],
        }

    def compute_alternate_route(self, start, goal, primary_route_path, algorithm="astar", penalty_factor=6.0):
        penalty_mask = build_penalty_mask(primary_route_path, penalty_factor)
        return self.solve(start, goal, algorithm=algorithm, penalty_mask=penalty_mask)
