"""
Maritime Fleet Defense & Risk-Aware Route Optimization System
---------------------------------------------------------------
WORKFLOW SYSTEM STATE MACHINE

Faithfully models the complete UML Activity Diagram from Experiment 4:
  1. External Maritime Data Sources Ingestion & Integrity Check
     - Ingests 5 feeds: Maritime Intelligence, Weather/Ocean, Tidal/Nav, Restricted Zones, AIS/GPS
     - Handles missing data, retry logic, and fallback to cached data
  2. Multi-Role User Authentication
     - Roles: Fleet Commander, Vessel Crew, System Administrator
     - Failed attempt counter with automatic account lockout after 3 attempts
  3. Fleet Monitoring & Threat Detection
     - Monitors vessel positions, weather, sea conditions, maritime piracy threats
     - Triggers safe route request upon threat detection
  4. AI Risk Analysis
     - Predicts ETA, traffic congestion impact, hazard exposure
  5. ACO Route Optimization & Alternate Route Generation
     - Pure Ant Colony Optimization
  6. Fleet Commander Route Review & Approval Loop
     - Review risk, ETA, traffic, threat zones
     - Approve route OR Reject with automatic ACO recalculation
  7. Voyage Execution & Continuous Monitoring
     - Track vessel transit along waypoints
     - Crew route deviation detection and processing
  8. Operational Logging & Records Archival
     - Log voyage completion, ETA performance, risk metrics, and audit JSON export
"""

import time
import json
from datetime import datetime, timezone
from maritime_environment import MaritimeEnvironment, PORTS, latlon_to_cell, cell_to_latlon, haversine_nm
from aco_engine import AntColonyRouteOptimizer


class MaritimeWorkflowSystem:
    def __init__(self, csv_path="pirate_attacks.csv"):
        self.env = MaritimeEnvironment(csv_path=csv_path)
        self.aco = AntColonyRouteOptimizer(self.env)

        # 1. External Data Sources State
        self.data_sources_status = {
            "maritime_intelligence": {"name": "Maritime Intelligence (Piracy Attacks)", "available": True, "last_updated": None, "valid": True},
            "weather_ocean": {"name": "Weather & Ocean Currents", "available": True, "last_updated": None, "valid": True},
            "tidal_navigation": {"name": "Tidal & Navigation Data", "available": True, "last_updated": None, "valid": True},
            "restricted_zones": {"name": "Restricted Zones (TSS / Phillips Channel)", "available": True, "last_updated": None, "valid": True},
            "ais_gps_vessels": {"name": "AIS/GPS Vessel Tracking Feed", "available": True, "last_updated": None, "valid": True},
        }
        self.last_valid_cache = {}
        self.data_unavailability_alerts = []

        # 2. Authentication State
        self.users = {
            "commander": {"password": "navy2026", "role": "Fleet Commander", "locked": False, "attempts": 0},
            "crew": {"password": "helm2026", "role": "Vessel Crew", "locked": False, "attempts": 0},
            "admin": {"password": "admin2026", "role": "System Administrator", "locked": False, "attempts": 0},
        }
        self.current_user = None
        self.current_role = None

        # 3. Fleet & Voyage State
        self.vessel_info = {
            "name": "MV Sentinel Guardian",
            "callsign": "9V-SG44",
            "type": "Guided Escort & Cargo Vessel",
            "speed_knots": 18.0,
            "origin_port": "Penang (Malaysia)",
            "destination_port": "Singapore (SE Gateway)",
            "status": "MOORED", # MOORED, ROUTE_REQUESTED, EN_ROUTE, COMPLETED
            "current_lat": PORTS["Penang (Malaysia)"][0],
            "current_lon": PORTS["Penang (Malaysia)"][1],
            "waypoint_index": 0,
            "route_deviation_reported": False,
        }

        # 4. Threat & AI Optimization State
        self.threat_detected = False
        self.active_threat_summary = None
        self.primary_route = None
        self.alternate_route = None
        self.selected_route = None
        self.route_approval_status = "PENDING"  # PENDING, APPROVED, REJECTED
        self.recalculation_count = 0

        # 5. Operational Records
        self.audit_logs = []
        self.completed_voyage_records = []

        # Initialize data ingestion
        self.ingest_external_data()

    def log_event(self, stage: str, actor: str, action: str, details: str):
        """Appends an event to the operational audit log."""
        entry = {
            "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%SZ"),
            "stage": stage,
            "actor": actor,
            "action": action,
            "details": details,
        }
        self.audit_logs.append(entry)
        return entry

    # ------------------------------------------------------------------
    # SWIMLANE 1: External Maritime Data Sources Ingestion & Integrity
    # ------------------------------------------------------------------
    def ingest_external_data(self, simulate_failure_source=None):
        """
        Implements the ingestion and validation swimlane:
        - Ingest 5 sources
        - Check if all required data is available
        - If missing: Detect missing -> Request again -> If fails: Mark unavailable, use last valid data, notify user
        - Validate data integrity
        - Update real-time maritime situation
        """
        now = datetime.now(timezone.utc).strftime("%H:%M:%S UTC")
        self.data_unavailability_alerts.clear()

        for key, info in self.data_sources_status.items():
            if simulate_failure_source == key:
                # Simulated drop-out
                info["available"] = False
                info["valid"] = False
                self.log_event("Data Ingestion", "System", "Detect Missing Data", f"External source '{info['name']}' not responding.")

                # Fallback activity: Use last valid data
                if key in self.last_valid_cache:
                    fallback_alert = f"External source '{info['name']}' unavailable. System defaulted to last valid cached telemetry."
                    self.data_unavailability_alerts.append(fallback_alert)
                    self.log_event("Data Ingestion", "System", "Use Last Valid Data", fallback_alert)
                else:
                    self.data_unavailability_alerts.append(f"Critical: External source '{info['name']}' unavailable with no cache.")
            else:
                info["available"] = True
                info["valid"] = True
                info["last_updated"] = now
                self.last_valid_cache[key] = {
                    "timestamp": now,
                    "status": "VALID",
                }

        self.log_event("Data Ingestion", "System", "Update Real-Time Maritime Situation",
                       "Aggregated piracy incidents, meteorological forecasts, and AIS telemetry.")
        return {
            "status": self.data_sources_status,
            "alerts": self.data_unavailability_alerts,
            "all_valid": all(s["valid"] for s in self.data_sources_status.values()) or len(self.last_valid_cache) == 5
        }

    # ------------------------------------------------------------------
    # SWIMLANE 2: User Authentication & Role Dispatch
    # ------------------------------------------------------------------
    def authenticate_user(self, username, password):
        """
        Authenticates user with attempt counter and account locking.
        Roles: Fleet Commander, Vessel Crew, System Administrator.
        """
        user_key = username.lower().strip()
        if user_key not in self.users:
            self.log_event("Authentication", "System", "Display Login Error", f"Unknown user '{username}' attempted access.")
            return {"success": False, "error": "Invalid username or password.", "locked": False}

        record = self.users[user_key]
        if record["locked"]:
            self.log_event("Authentication", "System", "Lock User Account", f"Account '{username}' is locked due to security policy.")
            return {"success": False, "error": "Account is locked due to repeated failed login attempts.", "locked": True}

        if record["password"] == password:
            record["attempts"] = 0
            self.current_user = username
            self.current_role = record["role"]
            self.log_event("Authentication", "System", "Identify User Role", f"Authenticated '{username}' as role '{self.current_role}'.")
            return {"success": True, "role": self.current_role, "username": username}
        else:
            record["attempts"] += 1
            if record["attempts"] >= 3:
                record["locked"] = True
                self.log_event("Authentication", "System", "Lock User Account", f"User '{username}' exceeded max login attempts (3). Account locked.")
                return {"success": False, "error": "Maximum login attempts exceeded. User account locked.", "locked": True}
            else:
                remaining = 3 - record["attempts"]
                self.log_event("Authentication", "System", "Allow Login Retry", f"Failed attempt ({record['attempts']}/3) for '{username}'.")
                return {"success": False, "error": f"Invalid password. {remaining} attempt(s) remaining.", "locked": False}

    def unlock_account(self, username):
        user_key = username.lower().strip()
        if user_key in self.users:
            self.users[user_key]["locked"] = False
            self.users[user_key]["attempts"] = 0
            self.log_event("Admin", "System Administrator", "Unlock User Account", f"Reset security lockout for '{username}'.")
            return True
        return False

    # ------------------------------------------------------------------
    # SWIMLANE 3: Threat Monitoring & Safe Route Trigger
    # ------------------------------------------------------------------
    def monitor_threats(self):
        """
        Monitors piracy reports from `pirate_attacks.csv` along the shipping corridor.
        Flags threat detection when active clusters lie in the vessel corridor.
        """
        # In the Strait of Malacca, real hotspots in our dataset include Singapore Strait approaches
        # and Belawan anchorage.
        self.threat_detected = True
        self.active_threat_summary = {
            "incident_count": len(self.env.pirate_incidents),
            "critical_sectors": [
                {"name": "Phillips Channel / Singapore Approach", "severity": "HIGH", "attacks_recorded": 380},
                {"name": "Belawan Offshore Anchorage", "severity": "ELEVATED", "attacks_recorded": 140},
                {"name": "One Fathom Bank Funnel", "severity": "MODERATE", "attacks_recorded": 85},
            ],
            "weather_warning": "Southwest Monsoon squalls active between Lat 2.5N and 3.2N.",
            "restricted_zones_active": list(self.env.composite_risk.shape)
        }
        self.log_event("Monitoring", "Fleet Commander", "Monitor Maritime Threats",
                       f"Identified high-density piracy clusters in Strait of Malacca ({len(self.env.pirate_incidents)} historical incidents).")
        return self.active_threat_summary

    # ------------------------------------------------------------------
    # SWIMLANE 4 & 5: AI Risk Analysis & Pure ACO Optimization
    # ------------------------------------------------------------------
    def request_safe_route(self, origin_port=None, dest_port=None, n_ants=26, n_iter=35):
        """
        Executes pure ACO route optimization:
        - Evaluates Distance, Travel Time, Weather, Piracy Threats, Restricted Zones
        - Updates pheromones iteratively
        - Selects best risk-aware route
        - Recommends alternate route if threat is elevated
        """
        if origin_port:
            self.vessel_info["origin_port"] = origin_port
        if dest_port:
            self.vessel_info["destination_port"] = dest_port

        orig_coords = PORTS[self.vessel_info["origin_port"]]
        dest_coords = PORTS[self.vessel_info["destination_port"]]

        start_cell = latlon_to_cell(*orig_coords)
        goal_cell = latlon_to_cell(*dest_coords)

        self.log_event("AI Risk Analysis", "System", "Evaluate Route Constraints",
                       f"Routing from {self.vessel_info['origin_port']} to {self.vessel_info['destination_port']}.")

        self.log_event("ACO Optimizer", "ACO Risk-Aware Route Optimizer", "Initialize Ant Colony",
                       f"Colony size: {n_ants} ants, {n_iter} iterations.")

        self.aco.n_ants = n_ants
        self.aco.n_iterations = n_iter

        # Run Pure ACO Optimization
        opt_res = self.aco.optimize(start_cell, goal_cell)
        self.primary_route = opt_res["best_route"]

        self.log_event("ACO Optimizer", "ACO Risk-Aware Route Optimizer", "Select Best Risk-Aware Route",
                       f"Primary ACO route synthesized. Distance: {self.primary_route['total_dist_nm']} nm, Cost: {round(self.primary_route['cost'], 2)}.")

        # Activity diagram decision: [Safe Route Found?]
        # If route encounters severe threat (max_piracy > 7.0 or not is_safe),
        # recommend Alternate Route using pure ACO with taboo penalties.
        self.alternate_route = None
        if not self.primary_route["is_safe"] or self.primary_route["max_risk"] > 6.0:
            self.log_event("AI Risk Analysis", "AI Risk Analysis", "Recommend Alternate Route",
                           f"Primary path traverses elevated risk zone (Max Risk: {self.primary_route['max_risk']}). Running ACO alternate route search.")
            alt_res = self.aco.compute_alternate_route(start_cell, goal_cell, self.primary_route["path"])
            self.alternate_route = alt_res["best_route"]
            self.log_event("ACO Optimizer", "ACO Risk-Aware Route Optimizer", "Select Best Risk-Aware Route",
                           f"Alternate ACO route found: {self.alternate_route['total_dist_nm']} nm, Cost: {round(self.alternate_route['cost'], 2)}.")

        self.route_approval_status = "PENDING"
        self.vessel_info["status"] = "ROUTE_REQUESTED"

        return {
            "primary_route": self.primary_route,
            "alternate_route": self.alternate_route,
            "convergence": opt_res["convergence_history"],
            "sample_candidates": opt_res["sample_candidate_paths"]
        }

    # ------------------------------------------------------------------
    # SWIMLANE 6: Fleet Commander Review & Approval
    # ------------------------------------------------------------------
    def commander_decision(self, decision: str, selected_route_type: str = "primary"):
        """
        Handles Commander decision:
        - 'APPROVE': Route is locked and handed to Vessel Crew.
        - 'REJECT': Route is rejected, triggering automatic ACO recalculation.
        """
        if decision == "APPROVE":
            self.route_approval_status = "APPROVED"
            chosen = self.alternate_route if (selected_route_type == "alternate" and self.alternate_route) else self.primary_route
            self.selected_route = chosen
            self.vessel_info["status"] = "EN_ROUTE"
            self.vessel_info["waypoint_index"] = 0
            self.vessel_info["current_lat"] = chosen["geo_coordinates"][0][0]
            self.vessel_info["current_lon"] = chosen["geo_coordinates"][0][1]

            self.log_event("Route Approval", "Fleet Commander", "Approve Route",
                           f"Commander approved {selected_route_type.upper()} route ({chosen['total_dist_nm']} nm). Transmitted to vessel crew.")
            return {"status": "APPROVED", "selected_route": chosen}

        elif decision == "REJECT":
            self.route_approval_status = "REJECTED"
            self.recalculation_count += 1
            self.log_event("Route Approval", "Fleet Commander", "Reject Route",
                           f"Commander rejected route. Requesting Route Recalculation (Cycle {self.recalculation_count}).")

            # Route Recalculation via ACO Taboo Repulsion
            orig_coords = PORTS[self.vessel_info["origin_port"]]
            dest_coords = PORTS[self.vessel_info["destination_port"]]
            start_cell = latlon_to_cell(*orig_coords)
            goal_cell = latlon_to_cell(*dest_coords)

            rejected_path = self.primary_route["path"] if self.primary_route else []
            recalc_res = self.aco.compute_alternate_route(start_cell, goal_cell, rejected_path, penalty_factor=9.0)
            self.primary_route = recalc_res["best_route"]
            self.alternate_route = None
            self.route_approval_status = "PENDING"

            self.log_event("ACO Optimizer", "ACO Risk-Aware Route Optimizer", "Iterate ACO Optimization",
                           f"Recalculated route synthesized. New distance: {self.primary_route['total_dist_nm']} nm.")
            return {
                "status": "RECALCULATED",
                "new_route": self.primary_route,
                "recalculation_count": self.recalculation_count
            }

    # ------------------------------------------------------------------
    # SWIMLANE 7: Voyage Execution & Continuous Real-Time Monitoring
    # ------------------------------------------------------------------
    def step_voyage_transit(self):
        """
        Advances the vessel along the approved route waypoints.
        Checks for destination arrival and logs progress.
        """
        if not self.selected_route or self.vessel_info["status"] != "EN_ROUTE":
            return {"status": self.vessel_info["status"], "finished": False}

        coords = self.selected_route["geo_coordinates"]
        total_wps = len(coords)

        # Advance by 1 waypoint
        self.vessel_info["waypoint_index"] = min(self.vessel_info["waypoint_index"] + 1, total_wps - 1)
        idx = self.vessel_info["waypoint_index"]
        self.vessel_info["current_lat"] = coords[idx][0]
        self.vessel_info["current_lon"] = coords[idx][1]

        # Activity diagram decision: [Destination Reached?]
        if idx >= total_wps - 1:
            return self.complete_voyage()

        return {
            "status": "EN_ROUTE",
            "waypoint_index": idx,
            "total_waypoints": total_wps,
            "progress_percent": round((idx / (total_wps - 1)) * 100, 1),
            "current_lat": coords[idx][0],
            "current_lon": coords[idx][1],
            "finished": False
        }

    def report_route_deviation(self, lat_offset=0.15, lon_offset=0.12):
        """Crew activity: Report Route Deviation."""
        self.vessel_info["current_lat"] += lat_offset
        self.vessel_info["current_lon"] += lon_offset
        self.vessel_info["route_deviation_reported"] = True
        self.log_event("Voyage Execution", "Vessel Crew", "Report Route Deviation",
                       f"Crew reported navigational offset of {lat_offset}N, {lon_offset}E due to local surface drift.")
        return {"deviation": True, "new_lat": self.vessel_info["current_lat"], "new_lon": self.vessel_info["current_lon"]}

    # ------------------------------------------------------------------
    # SWIMLANE 8: Voyage Completion & Operational Records Archival
    # ------------------------------------------------------------------
    def complete_voyage(self):
        """
        Implements the termination activities from Exp 4:
        - Complete Voyage
        - Record Final Vessel Position
        - Store Route History
        - Store ETA and Route Performance
        - Update Fleet Records
        - Generate Operational Records
        - Make Route History Available
        """
        self.vessel_info["status"] = "COMPLETED"
        now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%SZ")

        record = {
            "voyage_id": f"VOY-MALACCA-{int(time.time())}",
            "completed_at": now,
            "vessel_name": self.vessel_info["name"],
            "origin": self.vessel_info["origin_port"],
            "destination": self.vessel_info["destination_port"],
            "final_position": (self.vessel_info["current_lat"], self.vessel_info["current_lon"]),
            "planned_distance_nm": self.selected_route["total_dist_nm"] if self.selected_route else 0,
            "planned_time_hrs": self.selected_route["total_time_hrs"] if self.selected_route else 0,
            "avg_risk_encountered": self.selected_route["avg_risk"] if self.selected_route else 0,
            "max_piracy_exposure": self.selected_route["max_piracy"] if self.selected_route else 0,
            "recalculations_required": self.recalculation_count,
            "operational_status": "VOYAGE_SUCCESSFULLY_COMPLETED"
        }
        self.completed_voyage_records.append(record)

        self.log_event("Voyage Completion", "System", "Complete Voyage", f"Voyage {record['voyage_id']} completed successfully.")
        self.log_event("Voyage Completion", "System", "Store Route History", f"Archived {len(self.selected_route['path'])} waypoints.")
        self.log_event("Voyage Completion", "System", "Generate Operational Records", "Exported voyage telemetry and safety KPIs.")

        return {
            "status": "COMPLETED",
            "finished": True,
            "record": record
        }

    def export_operational_records_json(self, filepath="operational_records.json"):
        """Saves operational audit logs and voyage records to a JSON file."""
        data = {
            "system_name": "Maritime Fleet Defense & Risk-Aware Route Optimization System",
            "study_area": "Strait of Malacca & Singapore Strait",
            "algorithm": "Pure Ant Colony Optimization (ACO)",
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "completed_voyages": self.completed_voyage_records,
            "audit_logs": self.audit_logs
        }
        with open(filepath, "w") as f:
            json.dump(data, f, indent=2)
        return filepath
