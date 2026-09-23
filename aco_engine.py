"""
Maritime Fleet Defense & Risk-Aware Route Optimization System
---------------------------------------------------------------
PURE ANT COLONY OPTIMIZATION (ACO) ROUTE OPTIMIZER

Faithfully implements the ACO swimlane 
  - Generate Candidate Routes
  - Initialize Ant Colony
  - Evaluate Route Risk
  - Evaluate Distance (Nautical Miles)
  - Evaluate Travel Time (with currents & speed)
  - Evaluate Weather Conditions
  - Evaluate Maritime Threats
  - Evaluate Restricted Zones
  - Calculate Route Cost
  - Update Pheromone Values
  - Iterate ACO Optimization
  - Select Best Risk-Aware Route
  - Alternate Route Discovery via Pheromone Repulsion / Dynamic Taboo Penalties
"""

import math
import random
import numpy as np
from maritime_environment import (
    GRID_H, GRID_W, MaritimeEnvironment
)


class AntColonyRouteOptimizer:
    """
    Pure Ant Colony Optimization (ACO) router for risk-aware maritime navigation.
    Solves for multi-objective Pareto optimal routes balancing distance,
    travel time, piracy threat avoidance, weather hazards, and restricted zones.
    """

    def __init__(
        self,
        env: MaritimeEnvironment,
        n_ants: int = 28,
        n_iterations: int = 40,
        alpha: float = 1.0,        # Pheromone trail sensitivity
        beta: float = 3.2,         # Heuristic desirability sensitivity
        evaporation: float = 0.30, # Pheromone evaporation rate
        q_pheromone: float = 150.0,# Pheromone deposit scaling constant
        tau_min: float = 0.05,     # Min pheromone bound (MMAS)
        tau_max: float = 15.0,     # Max pheromone bound (MMAS)
        weight_dist: float = 0.40,
        weight_time: float = 0.25,
        weight_risk: float = 3.50,
        weight_restricted: float = 2.50,
        seed: int = 42
    ):
        self.env = env
        self.n_ants = n_ants
        self.n_iterations = n_iterations
        self.alpha = alpha
        self.beta = beta
        self.evaporation = evaporation
        self.q_pheromone = q_pheromone
        self.tau_min = tau_min
        self.tau_max = tau_max

        self.weight_dist = weight_dist
        self.weight_time = weight_time
        self.weight_risk = weight_risk
        self.weight_restricted = weight_restricted

        self.rng = random.Random(seed)
        self.np_rng = np.random.default_rng(seed)

        # Sparse pheromone map on directed edges ((r1, c1), (r2, c2))
        self.pheromone = {}

    def _get_pheromone(self, from_node, to_node):
        return self.pheromone.get((from_node, to_node), 1.0)

    def _heuristic_desirability(self, current, next_node, goal, penalty_mask=None):
        """
        Calculates heuristic desirability eta(i, j):
        Combines directional progress toward goal with hazard penalties.
        """
        r_c, c_c = current
        r_n, c_n = next_node
        r_g, c_g = goal

        # Goal distance in coordinate space
        dist_curr_goal = math.hypot(r_c - r_g, c_c - c_g)
        dist_next_goal = math.hypot(r_n - r_g, c_n - c_g)
        progress = dist_curr_goal - dist_next_goal  # Positive if moving toward goal

        # Step distance
        step_dist = math.hypot(r_c - r_n, c_c - c_n)

        # Environmental factors at target cell
        risk = self.env.composite_risk[r_n, c_n]
        restricted = self.env.restricted_penalty[r_n, c_n]
        weather = self.env.weather_risk[r_n, c_n]

        # Additional taboo/penalty for recalculating alternate routes
        alt_penalty = 0.0
        if penalty_mask is not None and (r_n, c_n) in penalty_mask:
            alt_penalty = penalty_mask[(r_n, c_n)]

        # Composite hazard denominator
        hazard_factor = (
            1.0 +
            0.8 * risk +
            1.2 * restricted +
            0.3 * weather +
            alt_penalty
        )

        # Desirability: higher when moving toward goal and through safer waters
        # Base progress weight ensures ants advance towards the destination
        progress_weight = max(0.05, 1.2 + 2.0 * progress)
        eta = progress_weight / (hazard_factor * step_dist)
        return max(eta, 1e-4)

    def _evaluate_route_metrics(self, path):
        """
        Evaluates a complete route path along the activities in the UML diagram:
        - Distance (nautical miles)
        - Travel time (hours)
        - Risk score (average and peak)
        - Weather exposure
        - Piracy exposure
        - Restricted zone compliance
        - Composite multi-objective cost
        """
        if not path or len(path) < 2:
            return None

        total_dist_nm = 0.0
        total_time_hrs = 0.0
        risks = []
        piracy_scores = []
        weather_scores = []
        restricted_scores = []

        for i in range(len(path) - 1):
            u, v = path[i], path[i + 1]
            comps = self.env.get_cell_cost_components(u, v)
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

        # Composite Route Cost as defined in Activity Diagram
        cost = (
            self.weight_dist * (total_dist_nm / 10.0) +
            self.weight_time * (total_time_hrs) +
            self.weight_risk * (avg_risk * 2.0 + max_risk * 1.5) +
            self.weight_restricted * (total_restricted * 1.2)
        )

        return {
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
            "waypoint_count": len(path)
        }

    def _construct_ant_route(self, start, goal, penalty_mask=None, max_steps=None):
        """Builds a single candidate route for one ant using the ACO probabilistic transition rule."""
        if max_steps is None:
            max_steps = GRID_H + GRID_W + 80
        path = [start]
        current = start
        visited = set([start])

        for _ in range(max_steps):
            if current == goal:
                break

            neighbors = [n for n in self.env.get_valid_neighbors(current) if n not in visited]
            if not neighbors:
                # Dead end encountered
                return None

            # Calculate transition probabilities P(current -> next)
            weights = []
            for nxt in neighbors:
                tau = self._get_pheromone(current, nxt) ** self.alpha
                eta = self._heuristic_desirability(current, nxt, goal, penalty_mask) ** self.beta
                weights.append(tau * eta)

            total_weight = sum(weights)
            if total_weight <= 0:
                return None

            probs = [w / total_weight for w in weights]
            # Probabilistic roulette-wheel selection
            next_node = self.rng.choices(neighbors, weights=probs, k=1)[0]

            path.append(next_node)
            visited.add(next_node)
            current = next_node

        return path if path[-1] == goal else None

    def optimize(self, start, goal, penalty_mask=None, progress_callback=None):
        """
        Executes the pure ACO optimization loop:
        1. Initializes / retains pheromones
        2. Dispatches colony ants per iteration
        3. Evaluates candidate routes
        4. Evaporates and deposits pheromones
        5. Tracks convergence history and global best route
        """
        best_eval = None
        convergence_history = []
        sample_candidate_paths = []

        for iteration in range(self.n_iterations):
            iteration_routes = []

            for ant_idx in range(self.n_ants):
                path = self._construct_ant_route(start, goal, penalty_mask)
                if path:
                    eval_res = self._evaluate_route_metrics(path)
                    if eval_res:
                        iteration_routes.append(eval_res)
                        if len(sample_candidate_paths) < 12 and iteration % 4 == 0:
                            sample_candidate_paths.append(path)

            # Check for best route in this iteration
            if iteration_routes:
                iter_best = min(iteration_routes, key=lambda x: x["cost"])
                if best_eval is None or iter_best["cost"] < best_eval["cost"]:
                    best_eval = iter_best
                iter_avg_cost = float(np.mean([r["cost"] for r in iteration_routes]))
            else:
                iter_avg_cost = best_eval["cost"] if best_eval else 0.0

            convergence_history.append({
                "iteration": iteration + 1,
                "best_cost": round(best_eval["cost"], 2) if best_eval else None,
                "avg_cost": round(iter_avg_cost, 2),
                "successful_ants": len(iteration_routes)
            })

            # Evaporate pheromones
            for edge in list(self.pheromone.keys()):
                self.pheromone[edge] *= (1.0 - self.evaporation)
                if self.pheromone[edge] < self.tau_min:
                    self.pheromone[edge] = self.tau_min

            # Deposit pheromone for all successful iteration ants
            for route_info in iteration_routes:
                route_path = route_info["path"]
                deposit = self.q_pheromone / (route_info["cost"] + 1e-4)
                for i in range(len(route_path) - 1):
                    edge = (route_path[i], route_path[i + 1])
                    self.pheromone[edge] = min(
                        self.tau_max,
                        self.pheromone.get(edge, 1.0) + deposit
                    )

            # Elitist reinforcement for global best ant
            if best_eval:
                elite_deposit = (2.0 * self.q_pheromone) / (best_eval["cost"] + 1e-4)
                best_p = best_eval["path"]
                for i in range(len(best_p) - 1):
                    edge = (best_p[i], best_p[i + 1])
                    self.pheromone[edge] = min(
                        self.tau_max,
                        self.pheromone.get(edge, 1.0) + elite_deposit
                    )

            if progress_callback:
                progress_callback(iteration + 1, self.n_iterations, best_eval)

        # Convert grid paths to geographic lat/lon coordinates that stay in water
        if best_eval:
            best_eval["geo_coordinates"] = self.env.path_to_water_geo(best_eval["path"])

        return {
            "best_route": best_eval,
            "convergence_history": convergence_history,
            "sample_candidate_paths": [
                self.env.path_to_water_geo(p)
                for p in sample_candidate_paths
            ]
        }

    def compute_alternate_route(self, start, goal, primary_route_path, penalty_factor=6.0):
        """
        Calculates an alternate safe route solely using ACO by applying
        dynamic repulsion penalties to cells along the primary / rejected route.
        Forces the ant colony to explore and reinforce a distinct safe corridor.
        """
        penalty_mask = {}
        for (r, c) in primary_route_path:
            penalty_mask[(r, c)] = penalty_factor
            # Also penalize immediate surrounding buffer so alternate doesn't just jitter
            for dr in (-1, 0, 1):
                for dc in (-1, 0, 1):
                    nr, nc = r + dr, c + dc
                    if (nr, nc) not in penalty_mask:
                        penalty_mask[(nr, nc)] = penalty_factor * 0.5

        # Evaporate pheromones heavily along primary path
        for i in range(len(primary_route_path) - 1):
            edge = (primary_route_path[i], primary_route_path[i + 1])
            if edge in self.pheromone:
                self.pheromone[edge] = self.tau_min

        # Re-run ACO optimization with updated taboo penalty landscape
        result = self.optimize(start, goal, penalty_mask=penalty_mask)
        return result
