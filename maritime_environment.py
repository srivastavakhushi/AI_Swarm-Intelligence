"""
Maritime Fleet Defense & Risk-Aware Route Optimization System
---------------------------------------------------------------
MARITIME ENVIRONMENT MODULE - STRAIT OF MALACCA & SINGAPORE STRAIT

Provides:
  - Spatial grid representation of the Strait of Malacca
  - Real land/water geometry sourced from the NOAA 1-km global land mask
  - Real pirate attack intelligence ingestion from `pirate_attacks.csv`
  - Environmental risk layers: Piracy Threat, Weather/Sea State, Ocean Currents,
    Restricted Zones (TSS / Phillips Channel / One Fathom Bank), and AIS Traffic Density.
  - Multi-objective cost evaluations for ACO / A* / Dijkstra route optimization.

Every navigable cell and every emitted route segment is validated against the
land mask, so routes are guaranteed to stay on water.
"""

import os
import math
from collections import deque

import numpy as np
import pandas as pd
from global_land_mask import globe

# Geographic Bounding Box for the Strait of Malacca study area.
# The western edge reaches past Aceh so the Indian Ocean approach stays connected
# to the strait instead of being pinched shut against the boundary.
LAT_MIN, LAT_MAX = 0.8, 6.2       # South -> North (Degrees)
LON_MIN, LON_MAX = 93.5, 104.5    # West  -> East  (Degrees)

GRID_H = 108  # Rows (~0.05 degrees / ~5.5 km per cell)
GRID_W = 220  # Columns (~0.05 degrees / ~5.6 km per cell)

CELL_DLAT = (LAT_MAX - LAT_MIN) / GRID_H
CELL_DLON = (LON_MAX - LON_MIN) / GRID_W

# Sub-samples per grid cell per axis when rasterizing the coastline (~1.1 km)
_SUB = 5

# A cell is navigable when at most this fraction of its area is land
_MAX_LAND_FRACTION = 0.30

# Safety clearance kept between a ship track and the shoreline
CLEARANCE_KM = 1.5

RISK_THRESHOLD = 7.0  # Cells with composite risk >= 7.0 classified as HIGH RISK

# Major Ports in the Strait of Malacca (Lat, Lon).
# These are the real port locations; each is snapped to the nearest navigable
# water cell at load time, so quayside coordinates on land are fine here.
PORTS = {
    "Sabang (NW Gateway)":      (5.88, 95.32),
    "Belawan (Sumatra)":        (3.88, 98.72),
    "Penang (Malaysia)":        (5.35, 100.33),
    "Port Klang (Malaysia)":    (2.98, 101.20),
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


def _build_fine_land_raster():
    """Rasterizes the NOAA land mask over the study area at ~1.1 km resolution."""
    lats = LAT_MIN + (np.arange(GRID_H * _SUB) + 0.5) * (CELL_DLAT / _SUB)
    lons = LON_MIN + (np.arange(GRID_W * _SUB) + 0.5) * (CELL_DLON / _SUB)
    grid_lat, grid_lon = np.meshgrid(lats, lons, indexing="ij")
    return globe.is_land(grid_lat, grid_lon)


_LAND_FINE = _build_fine_land_raster()
_FINE_H, _FINE_W = _LAND_FINE.shape
_FINE_DLAT = CELL_DLAT / _SUB
_FINE_DLON = CELL_DLON / _SUB


def _dilate(mask, radius):
    """Grows a boolean mask by `radius` cells (used for shoreline clearance)."""
    grown = mask.copy()
    for _ in range(radius):
        padded = np.pad(grown, 1, mode="edge")
        grown = (
            padded[:-2, 1:-1] | padded[2:, 1:-1] |
            padded[1:-1, :-2] | padded[1:-1, 2:] | grown
        )
    return grown


# Shoreline clearance buffer, expressed in fine-raster cells (~1.1 km each)
_CLEARANCE_CELLS = max(1, int(round(CLEARANCE_KM / 1.1)))
_LAND_FINE_BUFFERED = _dilate(_LAND_FINE, _CLEARANCE_CELLS)


def _shift_mask(mask, dr, dc):
    """Returns an array where out[r, c] == mask[r + dr, c + dc], False past the edges."""
    out = np.zeros_like(mask)
    rows_src = slice(max(dr, 0), GRID_H + min(dr, 0))
    rows_dst = slice(max(-dr, 0), GRID_H + min(-dr, 0))
    cols_src = slice(max(dc, 0), GRID_W + min(dc, 0))
    cols_dst = slice(max(-dc, 0), GRID_W + min(-dc, 0))
    out[rows_dst, cols_dst] = mask[rows_src, cols_src]
    return out


def _fine_index(lat, lon):
    fr = int((lat - LAT_MIN) / _FINE_DLAT)
    fc = int((lon - LON_MIN) / _FINE_DLON)
    return fr, fc


def is_land_latlon(lat, lon):
    """True when a geographic point is land (or outside the study area)."""
    if lat < LAT_MIN or lat > LAT_MAX or lon < LON_MIN or lon > LON_MAX:
        return True
    fr, fc = _fine_index(lat, lon)
    if fr < 0 or fr >= _FINE_H or fc < 0 or fc >= _FINE_W:
        return True
    return bool(_LAND_FINE[fr, fc])


def is_navigable_latlon(lat, lon):
    """True when a point is open water with safe clearance from the shoreline."""
    if lat < LAT_MIN or lat > LAT_MAX or lon < LON_MIN or lon > LON_MAX:
        return False
    fr, fc = _fine_index(lat, lon)
    if fr < 0 or fr >= _FINE_H or fc < 0 or fc >= _FINE_W:
        return False
    return not bool(_LAND_FINE_BUFFERED[fr, fc])


def latlon_to_cell(lat, lon):
    """Converts geographic (lat, lon) to discrete grid cell indices (row, col)."""
    r = int((lat - LAT_MIN) / CELL_DLAT)
    c = int((lon - LON_MIN) / CELL_DLON)
    return min(max(r, 0), GRID_H - 1), min(max(c, 0), GRID_W - 1)


def cell_to_latlon(row, col):
    """Converts grid cell indices (row, col) back to the cell-center (lat, lon)."""
    lat = LAT_MIN + (row + 0.5) * CELL_DLAT
    lon = LON_MIN + (col + 0.5) * CELL_DLON
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


def water_route_clear(lat1, lon1, lat2, lon2):
    """
    True when the straight track between two points stays in navigable water.

    Samples at half the coastline-raster resolution so no shoreline cell between
    the endpoints can be stepped over.
    """
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    steps = int(max(abs(dlat) / _FINE_DLAT, abs(dlon) / _FINE_DLON) * 2.0) + 2
    t = np.linspace(0.0, 1.0, steps)

    rows = ((lat1 + dlat * t - LAT_MIN) / _FINE_DLAT).astype(np.int32)
    cols = ((lon1 + dlon * t - LON_MIN) / _FINE_DLON).astype(np.int32)
    if rows.min() < 0 or rows.max() >= _FINE_H or cols.min() < 0 or cols.max() >= _FINE_W:
        return False
    return not bool(_LAND_FINE_BUFFERED[rows, cols].any())


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
        self.coastal_penalty = np.zeros((GRID_H, GRID_W), dtype=float)
        self.port_cells = {}
        self.edge_ok = {}

        self._build_terrain()
        self._load_pirate_intelligence()
        self._generate_environmental_layers()
        self._compute_composite_risk()

    # ------------------------------------------------------------------
    # Terrain construction from the real coastline
    # ------------------------------------------------------------------
    def _build_terrain(self):
        """Rasterizes the real coastline, keeps the open sea, and snaps ports to water."""
        land_fraction = _LAND_FINE.reshape(GRID_H, _SUB, GRID_W, _SUB).mean(axis=(1, 3))
        clearance = _LAND_FINE_BUFFERED.reshape(GRID_H, _SUB, GRID_W, _SUB).mean(axis=(1, 3))

        self.terrain = (land_fraction > _MAX_LAND_FRACTION).astype(int)
        # Cells whose center lacks shoreline clearance are unusable for transit
        for r in range(GRID_H):
            for c in range(GRID_W):
                if self.terrain[r, c] == 0 and not is_navigable_latlon(*cell_to_latlon(r, c)):
                    self.terrain[r, c] = 1

        self._precompute_edges()
        self._keep_largest_water_body()
        self.coastal_penalty = np.clip(clearance * 6.0, 0.0, 4.0) * (self.terrain == 0)

        for port_name, (plat, plon) in PORTS.items():
            self.port_cells[port_name] = self._nearest_water_cell(plat, plon)

    def _precompute_edges(self):
        """
        Caches, per cell and direction, whether that step keeps the ship in water.

        Doing this once at load time keeps the water test out of the solver inner
        loop while still validating every edge against the real coastline.
        """
        directions = [(dr, dc) for dr in (-1, 0, 1) for dc in (-1, 0, 1) if (dr, dc) != (0, 0)]
        for dr, dc in directions:
            allowed = np.zeros((GRID_H, GRID_W), dtype=bool)
            for r in range(GRID_H):
                nr = r + dr
                if nr < 0 or nr >= GRID_H:
                    continue
                for c in range(GRID_W):
                    nc = c + dc
                    if nc < 0 or nc >= GRID_W:
                        continue
                    if self.terrain[r, c] == 1 or self.terrain[nr, nc] == 1:
                        continue
                    # Never squeeze diagonally past a land corner
                    if dr != 0 and dc != 0:
                        if self.terrain[nr, c] == 1 or self.terrain[r, nc] == 1:
                            continue
                    lat1, lon1 = cell_to_latlon(r, c)
                    lat2, lon2 = cell_to_latlon(nr, nc)
                    allowed[r, c] = water_route_clear(lat1, lon1, lat2, lon2)
            self.edge_ok[(dr, dc)] = allowed

    def _keep_largest_water_body(self):
        """
        Discards inland lakes and pockets so only the open sea remains navigable.

        Reachability is evaluated with the same 8-connected, land-aware steps the
        solvers use, otherwise basins joined only by a diagonal passage — such as
        the Indian Ocean rounding the northern tip of Sumatra — look disconnected.
        """
        seen = np.zeros_like(self.terrain, dtype=bool)
        best_component = []

        for r0 in range(GRID_H):
            for c0 in range(GRID_W):
                if self.terrain[r0, c0] == 1 or seen[r0, c0]:
                    continue
                component = []
                queue = deque([(r0, c0)])
                seen[r0, c0] = True
                while queue:
                    node = queue.popleft()
                    component.append(node)
                    for nr, nc in self.get_valid_neighbors(node):
                        if not seen[nr, nc]:
                            seen[nr, nc] = True
                            queue.append((nr, nc))
                if len(component) > len(best_component):
                    best_component = component

        keep = np.zeros_like(self.terrain, dtype=bool)
        for r, c in best_component:
            keep[r, c] = True
        self.terrain = np.where(keep, 0, 1)

        # Drop cached edges that now touch a pruned cell
        for (dr, dc), allowed in self.edge_ok.items():
            np.logical_and(allowed, keep, out=allowed)
            np.logical_and(allowed, _shift_mask(keep, dr, dc), out=allowed)

    def _nearest_water_cell(self, lat, lon):
        """Finds the closest navigable cell to a port, expanding outward."""
        r0, c0 = latlon_to_cell(lat, lon)
        if self.is_water_cell(r0, c0):
            return (r0, c0)
        for radius in range(1, max(GRID_H, GRID_W)):
            best = None
            best_dist = float("inf")
            for dr in range(-radius, radius + 1):
                for dc in range(-radius, radius + 1):
                    if max(abs(dr), abs(dc)) != radius:
                        continue
                    r, c = r0 + dr, c0 + dc
                    if not self.is_water_cell(r, c):
                        continue
                    clat, clon = cell_to_latlon(r, c)
                    dist = haversine_nm(lat, lon, clat, clon)
                    if dist < best_dist:
                        best_dist = dist
                        best = (r, c)
            if best:
                return best
        raise RuntimeError("No navigable water cell found near port.")

    def get_port_cell(self, port_name):
        """Grid cell used for routing to/from a named port (always navigable water)."""
        if port_name not in self.port_cells:
            self.port_cells[port_name] = self._nearest_water_cell(*PORTS[port_name])
        return self.port_cells[port_name]

    def get_port_anchorage(self, port_name):
        """Lat/lon of the water cell a port is routed from."""
        return cell_to_latlon(*self.get_port_cell(port_name))

    def is_water_cell(self, r, c):
        return 0 <= r < GRID_H and 0 <= c < GRID_W and self.terrain[r, c] == 0

    def segment_stays_in_water(self, from_node, to_node):
        """Rejects a grid step whose geographic line would cut across land."""
        lat1, lon1 = cell_to_latlon(*from_node)
        lat2, lon2 = cell_to_latlon(*to_node)
        return water_route_clear(lat1, lon1, lat2, lon2)

    def get_valid_neighbors(self, node):
        """Returns 8-connected navigable water neighbors that do not cut across land."""
        r, c = node
        for (dr, dc), allowed in self.edge_ok.items():
            if allowed[r, c]:
                yield (r + dr, c + dc)

    # ------------------------------------------------------------------
    # Route geometry
    # ------------------------------------------------------------------
    def smooth_path(self, path, lookahead=60):
        """
        String-pulls a grid path into long straight legs that stay in water.

        Turns the staircase of grid steps into a realistic ship track. A leg is
        only accepted when the whole straight line between its endpoints is
        clear water, so smoothing can never shortcut across land.
        """
        if len(path) < 3:
            return [cell_to_latlon(*n) for n in path]

        points = [cell_to_latlon(*n) for n in path]
        smoothed = [points[0]]
        anchor = 0
        while anchor < len(points) - 1:
            limit = min(len(points) - 1, anchor + lookahead)
            furthest = anchor + 1
            for candidate in range(limit, anchor, -1):
                lat1, lon1 = points[anchor]
                lat2, lon2 = points[candidate]
                if water_route_clear(lat1, lon1, lat2, lon2):
                    furthest = candidate
                    break
            smoothed.append(points[furthest])
            anchor = furthest
        return smoothed

    def path_to_water_geo(self, path, step_nm=6.0, smooth=True):
        """
        Converts a grid path into a water-only lat/lon polyline for the map.

        The path is first string-pulled into straight legs, then each leg is
        resampled at a fixed spacing. Every leg has already been verified as
        clear water, so the interpolated waypoints are in water too. The even
        spacing is what the voyage stepper and waypoint table consume.
        """
        if not path:
            return []

        points = self.smooth_path(path) if smooth else [cell_to_latlon(*n) for n in path]
        if len(points) == 1:
            return [[round(points[0][0], 5), round(points[0][1], 5)]]

        coords = []
        for i in range(len(points) - 1):
            lat1, lon1 = points[i]
            lat2, lon2 = points[i + 1]
            legs = max(1, int(math.ceil(haversine_nm(lat1, lon1, lat2, lon2) / max(step_nm, 0.5))))
            for k in range(legs):
                t = k / legs
                coords.append([round(lat1 + (lat2 - lat1) * t, 5), round(lon1 + (lon2 - lon1) * t, 5)])

        coords.append([round(points[-1][0], 5), round(points[-1][1], 5)])
        return coords

    # ------------------------------------------------------------------
    # Intelligence & environmental layers
    # ------------------------------------------------------------------
    def _load_pirate_intelligence(self):
        """Loads and filters real pirate attack records in the Strait of Malacca corridor."""
        if not os.path.exists(self.csv_path):
            print(f"[Warning] Piracy dataset {self.csv_path} not found. Using baseline intelligence.")
            return

        try:
            df = pd.read_csv(self.csv_path)
            # Filter attacks in our bounding box AND strictly from 2019-2020
            date_mask = df["date"].astype(str).str.startswith(("2019", "2020"))
            geo_mask = (
                (df["latitude"] >= LAT_MIN) & (df["latitude"] <= LAT_MAX) &
                (df["longitude"] >= LON_MIN) & (df["longitude"] <= LON_MAX)
            )
            filtered = df[date_mask & geo_mask].dropna(subset=["latitude", "longitude"])
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
            print(f"[Intelligence Ingestion] Loaded {len(self.pirate_incidents)} piracy incidents (2019-2020 corridor data).")

            # Project incidents onto the piracy risk grid via Gaussian spatial decay
            radius = 5  # Influence radius in grid cells
            for inc in self.pirate_incidents:
                ir, ic = latlon_to_cell(inc["latitude"], inc["longitude"])
                sev = 1.0
                atype = str(inc["attack_type"]).lower()
                if "hijack" in atype:
                    sev = 3.0
                elif "board" in atype:
                    sev = 2.0
                elif "attempt" in atype:
                    sev = 1.2

                for dr in range(-radius, radius + 1):
                    for dc in range(-radius, radius + 1):
                        nr, nc = ir + dr, ic + dc
                        if 0 <= nr < GRID_H and 0 <= nc < GRID_W and self.terrain[nr, nc] == 0:
                            dist = math.hypot(dr, dc)
                            if dist <= radius:
                                weight = math.exp(-0.5 * (dist / 2.5) ** 2) * sev
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
                # Persistent surface drift toward northwest through the strait
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

                score = (
                    0.45 * self.piracy_risk[r, c] +
                    0.20 * self.weather_risk[r, c] +
                    0.15 * self.traffic_density[r, c] +
                    0.20 * self.restricted_penalty[r, c]
                )
                self.composite_risk[r, c] = np.clip(score, 0.5, 10.0)

        water = self.terrain == 0
        self.min_water_risk = float(self.composite_risk[water].min()) if water.any() else 0.0

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

        dist_nm = haversine_nm(lat1, lon1, lat2, lon2)

        # Current vector effect on speed over ground
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        mag = math.hypot(dlat, dlon) + 1e-9
        u_vessel = dlon / mag
        v_vessel = dlat / mag

        u_curr = self.ocean_current_u[r2, c2]
        v_curr = self.ocean_current_v[r2, c2]

        current_assist = u_curr * u_vessel + v_curr * v_vessel
        effective_speed = max(5.0, vessel_speed_knots + current_assist)
        travel_time_hrs = dist_nm / effective_speed

        return {
            "dist_nm": dist_nm,
            "travel_time_hrs": travel_time_hrs,
            "risk": self.composite_risk[r2, c2],
            "piracy": self.piracy_risk[r2, c2],
            "weather": self.weather_risk[r2, c2],
            "restricted": self.restricted_penalty[r2, c2] + self.coastal_penalty[r2, c2],
        }
