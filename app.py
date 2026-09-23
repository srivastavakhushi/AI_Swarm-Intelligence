"""
Maritime Fleet Defense & Risk-Aware Route Optimization System
---------------------------------------------------------------
FLASK WEB APPLICATION BACKEND

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
"""

import os
import json
from flask import Flask, render_template, request, jsonify, send_file
from workflow_system import MaritimeWorkflowSystem
from maritime_environment import PORTS, RESTRICTED_ZONES, cell_to_latlon

app = Flask(__name__)
app.config['SECRET_KEY'] = 'maritime-aco-secret-key-2026'

# Global workflow system instance
system = MaritimeWorkflowSystem(csv_path="pirate_attacks.csv")


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/status", methods=["GET"])
def get_status():
    """Returns complete state machine telemetry."""
    return jsonify({
        "current_user": system.current_user,
        "current_role": system.current_role,
        "data_sources": system.data_sources_status,
        "data_alerts": system.data_unavailability_alerts,
        "vessel_info": system.vessel_info,
        "threat_summary": system.active_threat_summary,
        "route_status": system.route_approval_status,
        "recalculation_count": system.recalculation_count,
        "has_primary_route": system.primary_route is not None,
        "has_alternate_route": system.alternate_route is not None,
        "selected_route": system.selected_route,
        "audit_logs_count": len(system.audit_logs),
        "recent_logs": system.audit_logs[-12:]
    })


@app.route("/api/auth/login", methods=["POST"])
def auth_login():
    data = request.get_json() or {}
    username = data.get("username", "")
    password = data.get("password", "")
    res = system.authenticate_user(username, password)
    return jsonify(res)


@app.route("/api/auth/unlock", methods=["POST"])
def auth_unlock():
    data = request.get_json() or {}
    username = data.get("username", "commander")
    success = system.unlock_account(username)
    return jsonify({"success": success, "message": f"Account {username} unlocked."})


@app.route("/api/data/ingest", methods=["POST"])
def ingest_data():
    data = request.get_json() or {}
    fail_source = data.get("simulate_failure_source", None)
    res = system.ingest_external_data(simulate_failure_source=fail_source)
    return jsonify(res)


@app.route("/api/threats", methods=["GET"])
def get_threats():
    """Returns pirate attacks and environmental hazard geometry for the map."""
    # Subsample pirate incidents for smooth frontend rendering (e.g. up to 400 incidents)
    incidents = system.env.pirate_incidents
    sample_step = max(1, len(incidents) // 350)
    subsampled = incidents[::sample_step]

    # Convert restricted zones
    zones = []
    for name, z in RESTRICTED_ZONES.items():
        zones.append({
            "name": name,
            "center": z["center"],
            "radius_deg": z["radius_deg"],
            "penalty": z["penalty"],
            "description": z["description"]
        })

    summary = system.monitor_threats()

    return jsonify({
        "incidents": subsampled,
        "total_incident_count": len(incidents),
        "restricted_zones": zones,
        "threat_summary": summary
    })


@app.route("/api/ports", methods=["GET"])
def get_ports():
    ports_list = [{"name": name, "lat": coords[0], "lon": coords[1]} for name, coords in PORTS.items()]
    return jsonify({"ports": ports_list})


@app.route("/api/optimize", methods=["POST"])
def optimize_route():
    """Runs Pure ACO optimization between selected origin and destination."""
    data = request.get_json() or {}
    origin = data.get("origin_port", "Penang (Malaysia)")
    destination = data.get("dest_port", "Singapore (SE Gateway)")
    n_ants = int(data.get("n_ants", 26))
    n_iter = int(data.get("n_iterations", 35))

    if origin not in PORTS or destination not in PORTS:
        return jsonify({"error": "Invalid origin or destination port."}), 400

    if origin == destination:
        return jsonify({"error": "Origin and destination cannot be identical."}), 400

    res = system.request_safe_route(origin_port=origin, dest_port=destination, n_ants=n_ants, n_iter=n_iter)
    return jsonify({
        "success": True,
        "primary_route": res["primary_route"],
        "alternate_route": res["alternate_route"],
        "convergence": res["convergence"],
        "sample_candidates": res["sample_candidates"],
        "vessel_info": system.vessel_info
    })


@app.route("/api/commander/decision", methods=["POST"])
def commander_decision():
    data = request.get_json() or {}
    decision = data.get("decision", "APPROVE")
    selected_type = data.get("selected_route_type", "primary")
    res = system.commander_decision(decision, selected_type)
    return jsonify(res)


@app.route("/api/voyage/step", methods=["POST"])
def voyage_step():
    res = system.step_voyage_transit()
    return jsonify(res)


@app.route("/api/voyage/deviation", methods=["POST"])
def voyage_deviation():
    data = request.get_json() or {}
    lat_off = float(data.get("lat_offset", 0.08))
    lon_off = float(data.get("lon_offset", 0.06))
    res = system.report_route_deviation(lat_off, lon_off)
    return jsonify(res)


@app.route("/api/voyage/reset", methods=["POST"])
def voyage_reset():
    system.vessel_info["status"] = "MOORED"
    system.vessel_info["waypoint_index"] = 0
    orig = PORTS[system.vessel_info["origin_port"]]
    system.vessel_info["current_lat"] = orig[0]
    system.vessel_info["current_lon"] = orig[1]
    system.selected_route = None
    system.route_approval_status = "PENDING"
    system.log_event("Voyage", "System", "Reset Voyage", "Vessel reset to moored status at origin port.")
    return jsonify({"success": True, "vessel_info": system.vessel_info})


@app.route("/api/records/export", methods=["GET"])
def export_records():
    path = system.export_operational_records_json()
    return send_file(path, as_attachment=True, download_name="maritime_operational_records.json")


@app.route("/api/records/list", methods=["GET"])
def list_records():
    return jsonify({
        "voyages": system.completed_voyage_records,
        "audit_logs": system.audit_logs
    })


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5050))
    app.run(host="0.0.0.0", port=port, debug=False)
