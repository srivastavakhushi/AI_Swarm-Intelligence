"""
Maritime Fleet Defense & Risk-Aware Route Optimization System
---------------------------------------------------------------
FASTAPI WEB APPLICATION BACKEND

Serves the interactive cyber-maritime command dashboard implementing
all swimlanes from the Experiment 4 UML Activity Diagram:
  - External Data Sources & Fallback Simulation
  - Multi-Role Authentication & Account Locking
  - Fleet Monitoring & Threat Intelligence
  - AI Risk Analysis
  - Pure Ant Colony Optimization (ACO) Engine
  - Fleet Commander Review & Recalculation Loop
  - Vessel Crew Voyage Transit & Deviation Reporting
  - Operational Logging & JSON Export

Run with:
  uvicorn app.main:app --reload --port 5050
"""

import json
import os
from typing import Any, Dict, List, Optional

from fastapi import FastAPI
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from maritime_environment import (
    PORTS,
    RESTRICTED_ZONES,
    LAT_MIN,
    LAT_MAX,
    LON_MIN,
    LON_MAX,
)
from workflow_system import MaritimeWorkflowSystem
from fleet_service import fleet_service
from expert_system import maritime_expert_system
from genetic_algorithm_service import genetic_algorithm_optimizer, DEFAULT_PATROL_WAYPOINTS
from minimax_evasion_service import minimax_evasion_game

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _json_default(value: Any):
    if hasattr(value, "item"):
        return value.item()
    if isinstance(value, (set, tuple)):
        return list(value)
    raise TypeError(f"Object of type {type(value).__name__} is not JSON serializable")


class NumpyJSONResponse(JSONResponse):
    def render(self, content: Any) -> bytes:
        return json.dumps(content, default=_json_default).encode("utf-8")


class LoginBody(BaseModel):
    username: str = ""
    password: str = ""


class UnlockBody(BaseModel):
    username: str = "commander"


class IngestBody(BaseModel):
    simulate_failure_source: Optional[str] = None


class OptimizeBody(BaseModel):
    origin_port: str = "Penang (Malaysia)"
    dest_port: str = "Singapore (SE Gateway)"
    n_ants: int = 26
    n_iterations: int = 35
    algorithm: str = "aco"


class CommanderDecisionBody(BaseModel):
    decision: str = "APPROVE"
    selected_route_type: str = "primary"


class DeviationBody(BaseModel):
    lat_offset: float = 0.08
    lon_offset: float = 0.06


class FleetTelemetryBody(BaseModel):
    lat: Optional[float] = None
    lon: Optional[float] = None
    speed_knots: Optional[float] = None
    heading_deg: Optional[float] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class FleetDeviationBody(BaseModel):
    lat_offset: float = 0.08
    lon_offset: float = 0.06
    reason: str = "Tidal surface drift & evasive clearing"


class FleetSimulateBody(BaseModel):
    time_delta_sec: float = 60.0
    step_minutes: Optional[float] = None


class ExpertEvaluateBody(BaseModel):
    vessel_id: Optional[str] = "VESSEL-001"
    custom_facts: Optional[Dict[str, Any]] = None


class GeneticAlgorithmBody(BaseModel):
    population_size: Optional[int] = None
    pop_size: Optional[int] = None
    generations: int = 50
    crossover_rate: float = 0.85
    mutation_rate: float = 0.25
    selected_waypoint_ids: Optional[List[str]] = None


class MinimaxMoveBody(BaseModel):
    action: Optional[str] = None
    depth: int = 4


app = FastAPI(
    title="Maritime Fleet Defense & ACO Route Optimizer",
    description="Risk-aware maritime routing dashboard powered by ACO, A*, and Dijkstra.",
    version="1.0.0",
    default_response_class=NumpyJSONResponse,
)

system = MaritimeWorkflowSystem()


@app.get("/")
def index():
    return FileResponse(os.path.join(BASE_DIR, "templates", "index.html"))


@app.get("/api/status")
def get_status():
    """Returns complete state machine telemetry."""
    return {
        "current_user": system.current_user,
        "current_role": system.current_role,
        "data_sources": system.data_sources_status,
        "data_alerts": system.data_unavailability_alerts,
        "vessel_info": system.vessel_info,
        "threat_summary": system.active_threat_summary,
        "route_status": system.route_approval_status,
        "recalculation_count": system.recalculation_count,
        "algorithm": system.active_algorithm,
        "has_primary_route": system.primary_route is not None,
        "has_alternate_route": system.alternate_route is not None,
        "selected_route": system.selected_route,
        "audit_logs_count": len(system.audit_logs),
        "recent_logs": system.audit_logs[-12:],
    }


@app.post("/api/auth/login")
def auth_login(body: LoginBody):
    return system.authenticate_user(body.username, body.password)


@app.post("/api/auth/logout")
def auth_logout():
    system.current_user = None
    system.current_role = None
    return {"success": True, "message": "Logged out successfully."}


@app.post("/api/auth/unlock")
def auth_unlock(body: UnlockBody):
    success = system.unlock_account(body.username)
    return {"success": success, "message": f"Account {body.username} unlocked in SQLite database."}


@app.post("/api/data/ingest")
def ingest_data(body: IngestBody):
    return system.ingest_external_data(simulate_failure_source=body.simulate_failure_source)


@app.get("/api/threats")
def get_threats():
    """Returns pirate attacks and environmental hazard geometry for the map."""
    incidents = system.env.pirate_incidents
    sample_step = max(1, len(incidents) // 350)
    subsampled = incidents[::sample_step]

    zones = []
    for name, z in RESTRICTED_ZONES.items():
        zones.append({
            "name": name,
            "center": z["center"],
            "radius_deg": z["radius_deg"],
            "penalty": z["penalty"],
            "description": z["description"],
        })

    summary = system.monitor_threats()

    return {
        "incidents": subsampled,
        "total_incident_count": len(incidents),
        "restricted_zones": zones,
        "threat_summary": summary,
    }


@app.get("/api/ports")
def get_ports():
    """Ports plus the navigable water cell each one is routed from."""
    ports_list = []
    for name, coords in PORTS.items():
        alat, alon = system.env.get_port_anchorage(name)
        ports_list.append({
            "name": name,
            "lat": alat,
            "lon": alon,
            "port_lat": coords[0],
            "port_lon": coords[1],
        })
    return {"ports": ports_list}


@app.get("/api/geography")
def get_geography():
    """Study-area bounds for the Strait of Malacca map."""
    return {
        "bounds": {
            "south": LAT_MIN,
            "north": LAT_MAX,
            "west": LON_MIN,
            "east": LON_MAX,
        },
        "label": {"name": "Strait of Malacca", "lat": 3.15, "lon": 100.35},
    }


@app.post("/api/optimize")
def optimize_route(body: OptimizeBody):
    """Runs ACO, A*, Dijkstra, or a side-by-side comparison between ports."""
    origin = body.origin_port
    destination = body.dest_port
    algorithm = (body.algorithm or "aco").lower().strip()

    if origin not in PORTS or destination not in PORTS:
        return JSONResponse({"error": "Invalid origin or destination port."}, status_code=400)

    if origin == destination:
        return JSONResponse({"error": "Origin and destination cannot be identical."}, status_code=400)

    if algorithm not in ("aco", "astar", "dijkstra", "compare"):
        return JSONResponse({"error": "Algorithm must be aco, astar, dijkstra, or compare."}, status_code=400)

    res = system.request_safe_route(
        origin_port=origin,
        dest_port=destination,
        n_ants=body.n_ants,
        n_iter=body.n_iterations,
        algorithm=algorithm,
    )
    if res.get("error") and not res.get("primary_route"):
        return JSONResponse(res, status_code=400)

    return {
        "success": True,
        "algorithm": res.get("algorithm", algorithm),
        "primary_route": res["primary_route"],
        "alternate_route": res["alternate_route"],
        "convergence": res["convergence"],
        "sample_candidates": res["sample_candidates"],
        "comparison_routes": res.get("comparison_routes", {}),
        "vessel_info": system.vessel_info,
    }


@app.post("/api/commander/decision")
def commander_decision(body: CommanderDecisionBody):
    return system.commander_decision(body.decision, body.selected_route_type)


@app.post("/api/voyage/step")
def voyage_step():
    return system.step_voyage_transit()


@app.post("/api/voyage/deviation")
def voyage_deviation(body: DeviationBody):
    return system.report_route_deviation(body.lat_offset, body.lon_offset)


@app.post("/api/voyage/reset")
def voyage_reset():
    system.vessel_info["status"] = "MOORED"
    system.vessel_info["waypoint_index"] = 0
    orig = PORTS[system.vessel_info["origin_port"]]
    system.vessel_info["current_lat"] = orig[0]
    system.vessel_info["current_lon"] = orig[1]
    system.selected_route = None
    system.route_approval_status = "PENDING"
    system.log_event("Voyage", "System", "Reset Voyage", "Vessel reset to moored status at origin port.")
    return {"success": True, "vessel_info": system.vessel_info}


@app.get("/api/records/export")
def export_records():
    path = system.export_operational_records_json(
        filepath=os.path.join(BASE_DIR, "operational_records.json")
    )
    return FileResponse(
        path,
        filename="maritime_operational_records.json",
        media_type="application/json",
    )


@app.get("/api/records/list")
def list_records():
    return {
        "voyages": system.completed_voyage_records,
        "audit_logs": system.audit_logs,
    }


# =============================================================================
# FLEET VESSEL POSITION TRACKING ENDPOINTS (VESSEL CREW & FLEET COMMANDER)
# =============================================================================
@app.get("/api/fleet/vessels")
def get_fleet_vessels():
    """
    Returns real-time and simulated coordinates, speeds, headings, and status
    of all fleet vessels. Fleet Commander view directly consumes this endpoint.
    """
    fleet_service.sync_primary_vessel(system.vessel_info)
    return {
        "status": "success",
        "vessels": fleet_service.get_all_vessels(),
        "count": len(fleet_service.vessels),
    }


@app.get("/api/fleet/vessels/{vessel_id}")
def get_fleet_vessel(vessel_id: str):
    """Returns telemetry details for a single fleet vessel."""
    fleet_service.sync_primary_vessel(system.vessel_info)
    v = fleet_service.get_vessel(vessel_id)
    if not v:
        return JSONResponse({"error": f"Vessel '{vessel_id}' not found."}, status_code=404)
    return {"status": "success", "vessel": v}


@app.post("/api/fleet/vessels/{vessel_id}/telemetry")
def update_fleet_telemetry(vessel_id: str, body: FleetTelemetryBody):
    """
    Updates navigation coordinates, speed, heading, and status for a fleet vessel.
    Propagates changes immediately so Fleet Commander view displays updated positions.
    """
    res = fleet_service.update_vessel_telemetry(
        vessel_id,
        lat=body.lat,
        lon=body.lon,
        speed_knots=body.speed_knots,
        heading_deg=body.heading_deg,
        status=body.status,
        notes=body.notes,
    )
    if vessel_id == "VESSEL-001" and res.get("success"):
        if body.lat is not None:
            system.vessel_info["current_lat"] = body.lat
        if body.lon is not None:
            system.vessel_info["current_lon"] = body.lon
        if body.speed_knots is not None:
            system.vessel_info["speed_knots"] = body.speed_knots
        if body.status is not None:
            system.vessel_info["status"] = body.status
    return res


@app.post("/api/fleet/vessels/{vessel_id}/deviate")
def deviate_fleet_vessel(vessel_id: str, body: FleetDeviationBody):
    """
    Reports a navigational offset / route deviation from the Vessel Crew console.
    Immediately updates coordinates and syncs with Fleet Commander view.
    """
    res = fleet_service.report_vessel_deviation(
        vessel_id,
        lat_offset=body.lat_offset,
        lon_offset=body.lon_offset,
        reason=body.reason,
    )
    if vessel_id == "VESSEL-001" and res.get("success"):
        system.report_route_deviation(body.lat_offset, body.lon_offset)
    return res


@app.post("/api/fleet/simulate_tick")
def simulate_fleet_tick(body: FleetSimulateBody):
    """
    Advances simulated positions of all underway fleet vessels according to
    their speed, heading vector, and elapsed time.
    """
    fleet_service.sync_primary_vessel(system.vessel_info)
    delta_sec = body.step_minutes * 60.0 if body.step_minutes is not None else body.time_delta_sec
    res = fleet_service.simulate_tick(delta_sec)
    v1 = fleet_service.get_vessel("VESSEL-001")
    if v1:
        system.vessel_info["current_lat"] = v1["lat"]
        system.vessel_info["current_lon"] = v1["lon"]
    res["lead_vessel_position"] = {"lat": v1["lat"], "lon": v1["lon"]} if v1 else None
    return res




# =============================================================================
# UNIT 6: MARITIME NAVIGATION RULE-BASED EXPERT SYSTEM & EXPLANATION FACILITY
# =============================================================================
@app.get("/api/ai/expert-system/rules")
def get_expert_system_rules():
    """Returns the production rules from the Expert System Knowledge Base."""
    return {"status": "success", "rules": maritime_expert_system.get_all_rules()}


@app.post("/api/ai/expert-system/evaluate")
def evaluate_expert_system(body: ExpertEvaluateBody):
    """
    Evaluates current vessel state through the forward-chaining Inference Engine.
    Returns triggered rules and 'WHY' & 'HOW' explanation facilities.
    """
    fleet_service.sync_primary_vessel(system.vessel_info)
    vessel = fleet_service.get_vessel(body.vessel_id or "VESSEL-001")
    if not vessel:
        vessel = system.vessel_info

    # Build working memory
    wm = maritime_expert_system.build_working_memory(vessel)
    if body.custom_facts:
        wm.update(body.custom_facts)

    inference_result = maritime_expert_system.infer(wm)
    return inference_result


# =============================================================================
# UNIT 2: GENETIC ALGORITHM FOR FLEET PATROL & MULTI-PORT OPTIMIZATION
# =============================================================================
@app.get("/api/ai/genetic-algorithm/waypoints")
def get_ga_waypoints():
    """Returns available strategic patrol stations and ports for GA tour optimization."""
    return {"status": "success", "waypoints": DEFAULT_PATROL_WAYPOINTS}


@app.post("/api/ai/genetic-algorithm/run")
def run_genetic_algorithm(body: GeneticAlgorithmBody):
    """
    Executes the Genetic Algorithm with selection, Order Crossover (OX1),
    and inversion mutation to evolve the optimal multi-port patrol tour.
    """
    pop_size = body.pop_size or body.population_size or 40
    res = genetic_algorithm_optimizer.run(
        population_size=pop_size,
        generations=body.generations,
        crossover_rate=body.crossover_rate,
        mutation_rate=body.mutation_rate,
        selected_waypoint_ids=body.selected_waypoint_ids,
    )
    return res


# =============================================================================
# UNIT 2: ADVERSARIAL SEARCH - MINIMAX WITH ALPHA-BETA PRUNING
# =============================================================================
@app.get("/api/ai/minimax/state")
def get_minimax_state():
    """Returns the current tactical pursuit-evasion grid state."""
    st = minimax_evasion_game.get_state()
    return {"status": "success", "state": st, **st}


@app.post("/api/ai/minimax/move")
def play_minimax_move(body: MinimaxMoveBody):
    """
    Executes one turn of the adversarial pursuit-evasion game.
    Runs recursive Minimax with Alpha-Beta pruning, tracking nodes evaluated
    and pruned branches.
    """
    res = minimax_evasion_game.play_turn(action=body.action, depth=body.depth)
    return res


@app.post("/api/ai/minimax/reset")
def reset_minimax_game():
    """Resets the tactical pursuit-evasion board to initial positions."""
    st = minimax_evasion_game.reset()
    return {"status": "success", "state": st, **st}


@app.get("/api/download/dashboard")
@app.get("/download/dashboard")
def download_dashboard():
    """Serves the complete standalone Vessel Crew Dashboard zip archive."""
    zip_path = os.path.join(BASE_DIR, "vessel_crew_dashboard.zip")
    if os.path.exists(zip_path):
        return FileResponse(
            zip_path,
            filename="vessel_crew_dashboard.zip",
            media_type="application/zip",
        )
    return JSONResponse(status_code=404, content={"error": "Zip file not found."})


app.mount("/static", StaticFiles(directory=os.path.join(BASE_DIR, "static")), name="static")


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 5050))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=False)
