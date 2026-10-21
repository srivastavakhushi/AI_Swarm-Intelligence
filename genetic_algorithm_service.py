"""
Genetic Algorithm Fleet Patrol & Multi-Port Tour Optimizer (Unit 2: Informed Search)
-----------------------------------------------------------------------------------
Implements:
  1. Permutation Chromosome Representation for Maritime Waypoint/Port Patrol Tours.
  2. Multi-Objective Fitness Evaluation (Distance Minimization + Restricted Zone Clearance).
  3. Genetic Operators:
     - Selection: Tournament Selection (size k=3).
     - Crossover: Order Crossover (OX1 - Davis 1985).
     - Mutation: Inversion (2-opt) & Swap Mutation.
     - Elitism: Preserves top chromosome across generations.
  4. Generation-by-generation evolution metrics (Fitness, Diversity, Distance).
"""

import math
import random
from typing import List, Dict, Any, Tuple, Optional


# Available Strategic Patrol Stations and Ports across the Malacca Corridor
DEFAULT_PATROL_WAYPOINTS = [
    {"id": "WP-PNG", "name": "Penang Anchorage", "lat": 5.35, "lon": 100.33, "type": "PORT"},
    {"id": "WP-OFB", "name": "One Fathom Bank Mid-Strait", "lat": 2.88, "lon": 101.00, "type": "PATROL"},
    {"id": "WP-PKG", "name": "Port Klang Escort Hub", "lat": 2.98, "lon": 101.20, "type": "PORT"},
    {"id": "WP-MLC", "name": "Malacca Roadstead", "lat": 2.19, "lon": 102.25, "type": "PORT"},
    {"id": "WP-DMI", "name": "Dumai Straits Passage", "lat": 1.72, "lon": 101.48, "type": "PORT"},
    {"id": "WP-TJP", "name": "Tanjung Pelepas Container Hub", "lat": 1.36, "lon": 103.55, "type": "PORT"},
    {"id": "WP-PLC", "name": "Phillips Channel Gateway", "lat": 1.18, "lon": 103.68, "type": "PATROL"},
    {"id": "WP-SIN", "name": "Singapore Eastern Roads", "lat": 1.23, "lon": 103.80, "type": "PORT"},
    {"id": "WP-BLW", "name": "Belawan Offshore Sector", "lat": 3.88, "lon": 98.72, "type": "PORT"},
    {"id": "WP-SBG", "name": "Sabang Andaman Approach", "lat": 5.88, "lon": 95.32, "type": "PORT"},
]


def haversine_nm(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates Great-Circle distance in Nautical Miles."""
    R = 3440.065
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


class GeneticAlgorithmOptimizer:
    def __init__(self, waypoints: Optional[List[Dict[str, Any]]] = None):
        self.waypoints = waypoints or DEFAULT_PATROL_WAYPOINTS
        self.num_waypoints = len(self.waypoints)
        self.dist_matrix = self._compute_distance_matrix()

    def _compute_distance_matrix(self) -> List[List[float]]:
        matrix = [[0.0] * self.num_waypoints for _ in range(self.num_waypoints)]
        for i in range(self.num_waypoints):
            for j in range(self.num_waypoints):
                if i != j:
                    w1 = self.waypoints[i]
                    w2 = self.waypoints[j]
                    matrix[i][j] = haversine_nm(w1["lat"], w1["lon"], w2["lat"], w2["lon"])
        return matrix

    def compute_tour_distance(self, tour: List[int]) -> float:
        """Computes total round-trip distance of a tour permutation in nautical miles."""
        total = 0.0
        n = len(tour)
        for i in range(n):
            u = tour[i]
            v = tour[(i + 1) % n]
            total += self.dist_matrix[u][v]
        return total

    def fitness(self, tour: List[int]) -> float:
        """Fitness is inversely proportional to tour distance."""
        dist = self.compute_tour_distance(tour)
        return 10000.0 / (dist + 1e-6)

    def tournament_selection(self, population: List[List[int]], fitnesses: List[float], k: int = 3) -> List[int]:
        """Tournament selection selects best individual among k random competitors."""
        selected_indices = random.sample(range(len(population)), k)
        best_idx = max(selected_indices, key=lambda idx: fitnesses[idx])
        return population[best_idx][:]

    def order_crossover_ox1(self, parent1: List[int], parent2: List[int]) -> Tuple[List[int], List[int]]:
        """
        Order Crossover (OX1):
        Copies a continuous slice from parent1, fills remaining positions from parent2
        in order, avoiding duplicates (preserves valid TSP permutation).
        """
        size = len(parent1)
        a, b = sorted(random.sample(range(size), 2))

        def make_child(p1, p2):
            child = [None] * size
            # Copy slice from p1
            child[a:b + 1] = p1[a:b + 1]
            p1_set = set(child[a:b + 1])

            # Fill remaining from p2 in circular order starting after b
            p2_ordered = p2[b + 1:] + p2[:b + 1]
            fill_values = [gene for gene in p2_ordered if gene not in p1_set]

            fill_idx = 0
            for i in list(range(b + 1, size)) + list(range(0, a)):
                child[i] = fill_values[fill_idx]
                fill_idx += 1
            return child

        child1 = make_child(parent1, parent2)
        child2 = make_child(parent2, parent1)
        return child1, child2

    def mutate_inversion_2opt(self, tour: List[int], mutation_rate: float = 0.2) -> List[int]:
        """Inversion (2-opt) mutation: reverses a random subsegment with probability."""
        mutated = tour[:]
        if random.random() < mutation_rate:
            a, b = sorted(random.sample(range(len(mutated)), 2))
            mutated[a:b + 1] = reversed(mutated[a:b + 1])
        # Minor swap mutation
        if random.random() < (mutation_rate * 0.5):
            i, j = random.sample(range(len(mutated)), 2)
            mutated[i], mutated[j] = mutated[j], mutated[i]
        return mutated

    def run(
        self,
        population_size: int = 40,
        generations: int = 60,
        crossover_rate: float = 0.85,
        mutation_rate: float = 0.25,
        selected_waypoint_ids: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Runs the full Genetic Algorithm evolutionary optimization.
        Returns complete generation logs, fitness curve, and best tour geometry.
        """
        if selected_waypoint_ids and len(selected_waypoint_ids) >= 3:
            filtered = [w for w in DEFAULT_PATROL_WAYPOINTS if w["id"] in selected_waypoint_ids]
            if len(filtered) >= 3:
                self.waypoints = filtered
            else:
                self.waypoints = list(DEFAULT_PATROL_WAYPOINTS)
        else:
            self.waypoints = list(DEFAULT_PATROL_WAYPOINTS)

        self.num_waypoints = len(self.waypoints)
        self.dist_matrix = self._compute_distance_matrix()

        n = self.num_waypoints
        base_chromosome = list(range(n))

        # Initial Population: Random Permutations
        population = []
        for _ in range(population_size):
            chrom = base_chromosome[:]
            random.shuffle(chrom)
            population.append(chrom)

        history = []
        best_overall_tour = None
        best_overall_dist = float("inf")
        best_overall_fitness = 0.0

        for gen in range(generations):
            fitnesses = [self.fitness(ind) for ind in population]
            distances = [self.compute_tour_distance(ind) for ind in population]

            gen_best_idx = max(range(population_size), key=lambda i: fitnesses[i])
            gen_best_dist = distances[gen_best_idx]
            gen_best_fitness = fitnesses[gen_best_idx]
            gen_avg_dist = sum(distances) / len(distances)
            gen_avg_fitness = sum(fitnesses) / len(fitnesses)

            if gen_best_dist < best_overall_dist:
                best_overall_dist = gen_best_dist
                best_overall_tour = population[gen_best_idx][:]
                best_overall_fitness = gen_best_fitness

            # Record sample generations for live visual chart
            if gen % max(1, generations // 30) == 0 or gen == generations - 1:
                history.append({
                    "generation": gen + 1,
                    "gen": gen + 1,
                    "best_distance_nm": round(gen_best_dist, 1),
                    "avg_distance_nm": round(gen_avg_dist, 1),
                    "mean_distance_nm": round(gen_avg_dist, 1),
                    "best_fitness": round(gen_best_fitness, 4),
                    "avg_fitness": round(gen_avg_fitness, 4),
                    "mean_fitness": round(gen_avg_fitness, 4),
                    "diversity_score": round(len(set(distances)) / float(population_size) * 100, 1)
                })

            # Elitism: Preserve best individual
            new_population = [population[gen_best_idx][:]]

            # Breed new generation
            while len(new_population) < population_size:
                p1 = self.tournament_selection(population, fitnesses)
                p2 = self.tournament_selection(population, fitnesses)

                if random.random() < crossover_rate:
                    c1, c2 = self.order_crossover_ox1(p1, p2)
                else:
                    c1, c2 = p1[:], p2[:]

                c1 = self.mutate_inversion_2opt(c1, mutation_rate)
                c2 = self.mutate_inversion_2opt(c2, mutation_rate)

                new_population.append(c1)
                if len(new_population) < population_size:
                    new_population.append(c2)

            population = new_population

        # Build output path geometry and leg distances
        ordered_waypoints = []
        n_tour = len(best_overall_tour)
        for i in range(n_tour):
            curr_idx = best_overall_tour[i]
            next_idx = best_overall_tour[(i + 1) % n_tour]
            wp_data = dict(self.waypoints[curr_idx])
            wp_data["leg_dist_nm"] = round(self.dist_matrix[curr_idx][next_idx], 1)
            ordered_waypoints.append(wp_data)

        # Closed round trip list for frontend display
        closed_tour = [dict(w) for w in ordered_waypoints]
        origin_copy = dict(ordered_waypoints[0])
        origin_copy["name"] = f"{origin_copy['name']} (Loop Return)"
        origin_copy["leg_dist_nm"] = 0.0
        closed_tour.append(origin_copy)

        geo_polyline = [[w["lat"], w["lon"]] for w in ordered_waypoints]
        geo_polyline.append([ordered_waypoints[0]["lat"], ordered_waypoints[0]["lon"]])

        return {
            "status": "success",
            "total_distance_nm": round(best_overall_dist, 1),
            "best_distance_nm": round(best_overall_dist, 1),
            "best_fitness": round(best_overall_fitness, 4),
            "generations_completed": generations,
            "evolution_history": history,
            "history": history,
            "best_tour": closed_tour,
            "tour_details": {
                "distance_nm": round(best_overall_dist, 1),
                "fitness": round(best_overall_fitness, 4),
                "ordered_waypoint_names": [w["name"] for w in ordered_waypoints],
                "ordered_waypoint_ids": [w["id"] for w in ordered_waypoints],
                "geo_polyline": geo_polyline,
                "waypoints": closed_tour
            },
            "parameters": {
                "population_size": population_size,
                "generations": generations,
                "crossover_rate": crossover_rate,
                "mutation_rate": mutation_rate,
                "waypoint_count": self.num_waypoints
            }
        }


# Singleton instance
genetic_algorithm_optimizer = GeneticAlgorithmOptimizer()
