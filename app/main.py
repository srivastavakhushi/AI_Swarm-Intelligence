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
from typing import Any, Optional

from fastapi import FastAPI
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from maritime_environment import (
    PORTS,
    RESTRICTED_ZONES,
    LAT_MIN,
    LAT_MAX,
    LON_MIN,
    LON_MAX,
)
from workflow_system import MaritimeWorkflowSystem

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


app = FastAPI(
    title="Maritime Fleet Defense & ACO Route Optimizer",
    description="Risk-aware maritime routing dashboard powered by ACO, A*, and Dijkstra.",
    version="1.0.0",
    default_response_class=NumpyJSONResponse,
)

system = MaritimeWorkflowSystem(csv_path=os.path.join(BASE_DIR, "pirate_attacks.csv"))


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


app.mount("/static", StaticFiles(directory=os.path.join(BASE_DIR, "static")), name="static")


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 5050))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=False)
