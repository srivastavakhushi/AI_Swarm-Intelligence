"""
Maritime Fleet Defense & Risk-Aware Route Optimization System
---------------------------------------------------------------
MARITIME ENVIRONMENT MODULE - STRAIT OF MALACCA & SINGAPORE STRAIT

Provides:
  - Spatial grid representation of the Strait of Malacca
  - Coastline geometry (Malay Peninsula and Sumatra)
  - Real pirate attack intelligence ingestion from `pirate_attacks.csv`
  - Environmental risk layers: Piracy Threat, Weather/Sea State, Ocean Currents,
    Restricted Zones (TSS / Phillips Channel / One Fathom Bank), and AIS Traffic Density.
  - Multi-objective cost evaluations for ACO route optimization.
"""

import os
import math
import numpy as np
import pandas as pd
import matplotlib.path as mpath

# Geographic Bounding Box for the Strait of Malacca study area
LAT_MIN, LAT_MAX = 0.8, 6.2      # South -> North (Degrees)
LON_MIN, LON_MAX = 95.0, 104.5    # West  -> East  (Degrees)

GRID_H = 45   # Rows (latitude resolution: ~0.12 degrees / ~13 km per cell)
GRID_W = 75   # Columns (longitude resolution: ~0.127 degrees / ~14 km per cell)

RISK_THRESHOLD = 7.0  # Cells with composite risk >= 7.0 classified as HIGH RISK

# Major Ports in the Strait of Malacca (Lat, Lon)
PORTS = {
    "Sabang (NW Gateway)":      (5.85, 95.35),
    "Belawan (Sumatra)":        (3.82, 98.72),
    "Penang (Malaysia)":        (5.40, 100.28),
    "Port Klang (Malaysia)":    (2.95, 101.28),
    "Dumai (Sumatra)":          (1.72, 101.48),
    "Singapore (SE Gateway)":   (1.23, 103.80),
}

# Restricted Navigation Zones & Chokepoints (TSS & narrow waterways)
RESTRICTED_ZONES = {
    "Phillips Channel Chokepoint": {
        "center": (1.18, 103.68),
        "radius_deg": 0.28,
        "penalty": 5.0,
        "description": "Ultra-narrow chokepoint (<3km wide), mandatory TSS adherence, heavy traffic.",
    },
    "One Fathom Bank Chokepoint": {
        "center": (2.88, 101.00),
        "radius_deg": 0.25,
        "penalty": 4.0,
        "description": "Shallow shoal area and mid-strait funneling zone.",
    },
    "Riau Military & Shallow Corridor": {
        "center": (0.98, 104.15),
        "radius_deg": 0.35,
        "penalty": 6.0,
        "description": "Restricted military patrol sector and hazardous reef zone.",
    }
}

# Realistic Coastlines via Polygons
# Malay Peninsula (land is North/East)
MALAY_COAST = [
    (98.0, 6.3), (99.0, 6.3), (99.5, 6.3), (100.0, 6.0), (100.3, 5.8),
    (100.4, 5.3), (100.6, 4.4), (101.2, 3.2), (101.4, 2.9), (102.0, 2.3),
    (102.5, 2.1), (103.1, 1.6), (103.5, 1.26), (104.0, 1.3), (104.5, 1.4),
    (104.5, 6.3), (98.0, 6.3)
]

# Sumatra Coast (land is South/West)
SUMATRA_COAST = [
    (95.0, 5.6), (95.4, 5.6), (96.0, 5.3), (97.0, 5.1), (98.0, 4.2),
    (98.7, 3.75), (99.5, 3.1), (100.2, 2.4), (101.4, 1.65), (102.2, 1.25),
    (103.3, 0.8), (104.5, 0.8), (95.0, 0.8), (95.0, 5.6)
]

_poly_malay = mpath.Path(MALAY_COAST)
_poly_sumatra = mpath.Path(SUMATRA_COAST)


def latlon_to_cell(lat, lon):
    """Converts geographic (lat, lon) to discrete grid cell indices (row, col)."""
    r = int((lat - LAT_MIN) / (LAT_MAX - LAT_MIN) * (GRID_H - 1))
    c = int((lon - LON_MIN) / (LON_MAX - LON_MIN) * (GRID_W - 1))
    return min(max(r, 0), GRID_H - 1), min(max(c, 0), GRID_W - 1)


def cell_to_latlon(row, col):
    """Converts grid cell indices (row, col) back to geographic (lat, lon)."""
    lat = LAT_MIN + (row / (GRID_H - 1)) * (LAT_MAX - LAT_MIN)
    lon = LON_MIN + (col / (GRID_W - 1)) * (LON_MAX - LON_MIN)
    return lat, lon


def haversine_nm(lat1, lon1, lat2, lon2):
    """Calculates great-circle distance between two points in Nautical Miles."""
    R = 3440.065  # Earth radius in Nautical Miles
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


class MaritimeEnvironment:
    """Encapsulates the complete digital maritime environment for the Strait of Malacca."""

    def __init__(self, csv_path="pirate_attacks.csv", weather_severity_factor=1.0):
        self.csv_path = csv_path
        self.weather_severity_factor = weather_severity_factor
        self.terrain = np.zeros((GRID_H, GRID_W), dtype=int)  # 0=water, 1=land
        self.pirate_incidents = []
        self.piracy_risk = np.zeros((GRID_H, GRID_W), dtype=float)
        self.weather_risk = np.zeros((GRID_H, GRID_W), dtype=float)
        self.ocean_current_u = np.zeros((GRID_H, GRID_W), dtype=float)  # knots (east)
        self.ocean_current_v = np.zeros((GRID_H, GRID_W), dtype=float)  # knots (north)
        self.traffic_density = np.zeros((GRID_H, GRID_W), dtype=float)
        self.restricted_penalty = np.zeros((GRID_H, GRID_W), dtype=float)
        self.composite_risk = np.zeros((GRID_H, GRID_W), dtype=float)

        self._build_terrain()
        self._load_pirate_intelligence()
        self._generate_environmental_layers()
        self._compute_composite_risk()

    def _build_terrain(self):
        """Constructs land/water mask using the Malacca coastline polygons."""
        for r in range(GRID_H):
            for c in range(GRID_W):
                lat, lon = cell_to_latlon(r, c)
                if _poly_malay.contains_point((lon, lat)) or _poly_sumatra.contains_point((lon, lat)):
                    self.terrain[r, c] = 1

        # Safeguard port locations so they are always navigable water cells
        for port_name, (plat, plon) in PORTS.items():
            pr, pc = latlon_to_cell(plat, plon)
            self.terrain[pr, pc] = 0

    def _load_pirate_intelligence(self):
        """Loads and filters real pirate attack records in the Strait of Malacca corridor."""
        if not os.path.exists(self.csv_path):
            print(f"[Warning] Piracy dataset {self.csv_path} not found. Using baseline intelligence.")
            return

        try:
            df = pd.read_csv(self.csv_path)
            # Filter attacks in our bounding box
            mask = (
                (df["latitude"] >= LAT_MIN) & (df["latitude"] <= LAT_MAX) &
                (df["longitude"] >= LON_MIN) & (df["longitude"] <= LON_MAX)
            )
            filtered = df[mask].dropna(subset=["latitude", "longitude"])
            self.pirate_incidents = []
            for _, row in filtered.iterrows():
                self.pirate_incidents.append({
                    "date": str(row.get("date", "Unknown")),
                    "latitude": float(row["latitude"]),
                    "longitude": float(row["longitude"]),
                    "attack_type": str(row.get("attack_type", "Piracy Event")),
                    "nearest_country": str(row.get("nearest_country", "NA")),
                    "description": str(row.get("location_description", "Strait of Malacca")),
                })

            # Project incidents onto the piracy risk grid via Gaussian spatial decay
            for inc in self.pirate_incidents:
                ilat, ilon = inc["latitude"], inc["longitude"]
                ir, ic = latlon_to_cell(ilat, ilon)
                # Severity weight based on attack type
                sev = 1.0
                atype = str(inc["attack_type"]).lower()
                if "hijack" in atype:
                    sev = 3.0
                elif "board" in atype:
                    sev = 2.0
                elif "attempt" in atype:
                    sev = 1.2

                radius = 3  # Influence radius in grid cells
                for dr in range(-radius, radius + 1):
                    for dc in range(-radius, radius + 1):
                        nr, nc = ir + dr, ic + dc
                        if 0 <= nr < GRID_H and 0 <= nc < GRID_W and self.terrain[nr, nc] == 0:
                            dist = math.hypot(dr, dc)
                            if dist <= radius:
                                weight = math.exp(-0.5 * (dist / 1.5) ** 2) * sev
                                self.piracy_risk[nr, nc] += weight

            # Normalize piracy risk to 0-10 scale
            max_p = np.max(self.piracy_risk)
            if max_p > 0:
                self.piracy_risk = (self.piracy_risk / max_p) * 9.5
        except Exception as e:
            print(f"[Error] Failed to load pirate attacks: {e}")

    def _generate_environmental_layers(self):
        """Generates realistic weather, ocean currents, restricted zones, and traffic density."""
        for r in range(GRID_H):
            for c in range(GRID_W):
                if self.terrain[r, c] == 1:
                    continue

                lat, lon = cell_to_latlon(r, c)

                # 1. Weather / Sea State Risk:
                # Monsoonal squall zone near central Malacca (Lat 2.0 - 3.5, Lon 99.0 - 101.5)
                squall_dist = math.hypot(lat - 2.8, lon - 100.2)
                base_weather = 1.5 + max(0, 5.0 - squall_dist * 2.0)
                self.weather_risk[r, c] = np.clip(base_weather * self.weather_severity_factor, 0.5, 9.0)

                # 2. Ocean Currents:
                # Persistent surface drift toward northwest through the strait (~ -0.8 knots lon, +0.6 knots lat)
                self.ocean_current_u[r, c] = -0.7 + 0.2 * math.sin(lat)
                self.ocean_current_v[r, c] = 0.5 + 0.1 * math.cos(lon)

                # 3. AIS Traffic Congestion Density:
                # Busiest in Singapore approaches and Malacca TSS funnel
                singapore_dist = math.hypot(lat - 1.25, lon - 103.8)
                traffic = max(1.0, 9.5 - singapore_dist * 2.5)
                self.traffic_density[r, c] = np.clip(traffic, 0.5, 9.5)

                # 4. Restricted Zones & Chokepoints
                for name, zone in RESTRICTED_ZONES.items():
                    zlat, zlon = zone["center"]
                    dist_deg = math.hypot(lat - zlat, lon - zlon)
                    if dist_deg < zone["radius_deg"]:
                        intensity = (1.0 - dist_deg / zone["radius_deg"]) * zone["penalty"]
                        self.restricted_penalty[r, c] += intensity

    def _compute_composite_risk(self):
        """Aggregates all multi-hazard risk dimensions into a unified 0-10 score."""
        for r in range(GRID_H):
            for c in range(GRID_W):
                if self.terrain[r, c] == 1:
                    self.composite_risk[r, c] = 10.0  # Impassable land
                    continue

                # Weighted multi-factor risk formula
                r_piracy = self.piracy_risk[r, c]
                r_weather = self.weather_risk[r, c]
                r_traffic = self.traffic_density[r, c]
                r_restrict = self.restricted_penalty[r, c]

                score = (
                    0.45 * r_piracy +
                    0.20 * r_weather +
                    0.15 * r_traffic +
                    0.20 * r_restrict
                )
                self.composite_risk[r, c] = np.clip(score, 0.5, 10.0)

    def get_valid_neighbors(self, node):
        """Returns 8-connected navigable water neighbors of a grid cell."""
        r, c = node
        for dr in (-1, 0, 1):
            for dc in (-1, 0, 1):
                if dr == 0 and dc == 0:
                    continue
                nr, nc = r + dr, c + dc
                if 0 <= nr < GRID_H and 0 <= nc < GRID_W and self.terrain[nr, nc] == 0:
                    yield (nr, nc)

    def get_cell_cost_components(self, from_node, to_node, vessel_speed_knots=18.0):
        """
        Computes the multi-objective cost components of transitioning from from_node to to_node:
        - Great-circle distance (nautical miles)
        - Travel time (hours, accounting for ocean current assistance or resistance)
        - Piracy threat score (0-10)
        - Weather severity (0-10)
        - Restricted zone penalty
        - Composite risk score (0-10)
        """
        r1, c1 = from_node
        r2, c2 = to_node
        lat1, lon1 = cell_to_latlon(r1, c1)
        lat2, lon2 = cell_to_latlon(r2, c2)

        # Distance in Nautical Miles
        dist_nm = haversine_nm(lat1, lon1, lat2, lon2)

        # Current vector effect
        # Normalized direction vector of vessel
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        mag = math.hypot(dlat, dlon) + 1e-9
        u_vessel = dlon / mag
        v_vessel = dlat / mag

        # Ocean current vector at destination
        u_curr = self.ocean_current_u[r2, c2]
        v_curr = self.ocean_current_v[r2, c2]

        # Effective speed over ground
        current_assist = u_curr * u_vessel + v_curr * v_vessel
        effective_speed = max(5.0, vessel_speed_knots + current_assist)
        travel_time_hrs = dist_nm / effective_speed

        risk = self.composite_risk[r2, c2]
        piracy = self.piracy_risk[r2, c2]
        weather = self.weather_risk[r2, c2]
        restricted = self.restricted_penalty[r2, c2]

        return {
            "dist_nm": dist_nm,
            "travel_time_hrs": travel_time_hrs,
            "risk": risk,
            "piracy": piracy,
            "weather": weather,
            "restricted": restricted
        }
