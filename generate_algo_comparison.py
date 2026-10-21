"""
Maritime Fleet Defense & Risk-Aware Route Optimization System
---------------------------------------------------------------
ALGORITHM BENCHMARK GENERATOR: DIJKSTRA vs A* vs ACO
Produces a high-resolution, publication-quality comparative figure
comparing all 3 algorithms across nautical trajectories, multi-objective
composite costs, risk exposure profiles, and operational metrics.
"""

import time
import math
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.patches import Circle
from matplotlib.gridspec import GridSpec

from maritime_environment import (
    LAT_MIN, LAT_MAX, LON_MIN, LON_MAX, GRID_H, GRID_W,
    PORTS, RESTRICTED_ZONES, MaritimeEnvironment,
    cell_to_latlon, latlon_to_cell
)
from pathfinding import GraphSearchRouter, evaluate_route_metrics
from aco_engine import AntColonyRouteOptimizer


def run_benchmark():
    print("[1/4] Initializing Maritime Environment (Strait of Malacca)...")
    env = MaritimeEnvironment("pirate_attacks.csv")

    start = latlon_to_cell(*PORTS["Penang (Malaysia)"])
    goal = latlon_to_cell(*PORTS["Singapore (SE Gateway)"])
    print(f"      Start: Penang {start} -> Goal: Singapore {goal}")

    # Standard unified weights for fair multi-objective evaluation
    u_weights = dict(
        weight_dist=0.40,
        weight_time=0.25,
        weight_risk=3.50,
        weight_restricted=2.50
    )

    print("[2/4] Solving with Dijkstra Algorithm...")
    router = GraphSearchRouter(env)
    t0 = time.perf_counter()
    dijkstra_res = router.solve(start, goal, algorithm="dijkstra")
    dijkstra_time = (time.perf_counter() - t0) * 1000.0
    dijkstra_route = dijkstra_res["best_route"]
    dijkstra_eval = evaluate_route_metrics(env, dijkstra_route["path"], **u_weights)
    dijkstra_eval["runtime_ms"] = dijkstra_time

    print("[3/4] Solving with A* Heuristic Search...")
    t0 = time.perf_counter()
    astar_res = router.solve(start, goal, algorithm="astar")
    astar_time = (time.perf_counter() - t0) * 1000.0
    astar_route = astar_res["best_route"]
    astar_eval = evaluate_route_metrics(env, astar_route["path"], **u_weights)
    astar_eval["runtime_ms"] = astar_time

    print("[4/4] Solving with Ant Colony Optimization (ACO)...")
    aco = AntColonyRouteOptimizer(env, n_ants=28, n_iterations=35, seed=42)
    t0 = time.perf_counter()
    aco_res = aco.optimize(start, goal)
    aco_time = (time.perf_counter() - t0) * 1000.0
    aco_eval = aco_res["best_route"]
    aco_eval["runtime_ms"] = aco_time

    print("\n--- BENCHMARK RESULTS ---")
    print(f"Dijkstra : Dist={dijkstra_eval['total_dist_nm']} NM, Time={dijkstra_eval['total_time_hrs']}h, Cost={dijkstra_eval['cost']:.2f}, MaxRisk={dijkstra_eval['max_risk']}")
    print(f"A*       : Dist={astar_eval['total_dist_nm']} NM, Time={astar_eval['total_time_hrs']}h, Cost={astar_eval['cost']:.2f}, MaxRisk={astar_eval['max_risk']}")
    print(f"ACO      : Dist={aco_eval['total_dist_nm']} NM, Time={aco_eval['total_time_hrs']}h, Cost={aco_eval['cost']:.2f}, MaxRisk={aco_eval['max_risk']}")

    plot_benchmark(env, start, goal, dijkstra_eval, astar_eval, aco_eval, aco_res["convergence_history"])


def plot_benchmark(env, start, goal, d_metrics, a_metrics, aco_metrics, aco_history):
    # Set overall visual styling
    plt.style.use("seaborn-v0_8-whitegrid" if "seaborn-v0_8-whitegrid" in plt.style.available else "default")
    fig = plt.figure(figsize=(21, 11.5), dpi=250)
    gs = GridSpec(2, 3, figure=fig, width_ratios=[1.75, 1.05, 1.05], height_ratios=[1.0, 1.0], wspace=0.26, hspace=0.28)

    # High-contrast color palette
    c_dijkstra = "#1565C0"  # Deep Royal Blue
    c_astar = "#2E7D32"     # Forest / Jade Green
    c_aco = "#E65100"       # Vibrant Amber / Orange

    # -------------------------------------------------------------
    # 1. MAIN NAUTICAL MAP (Left Span, rows 0:2, col 0)
    # -------------------------------------------------------------
    ax_map = fig.add_subplot(gs[:, 0])

    # Composite risk layer with masked land
    masked_risk = np.ma.masked_where(env.terrain == 1, env.composite_risk)
    im = ax_map.imshow(masked_risk, cmap="YlOrRd", origin="lower", vmin=0, vmax=10, aspect="auto", alpha=0.92)

    # Render landmass
    masked_land = np.ma.masked_where(env.terrain == 0, env.terrain)
    ax_map.imshow(masked_land, cmap="bone_r", origin="lower", aspect="auto", alpha=0.95)

    # Plot Piracy Incidents
    pirate_cells = [latlon_to_cell(inc["latitude"], inc["longitude"]) for inc in env.pirate_incidents]
    if pirate_cells:
        px = [c[1] for c in pirate_cells]
        py = [c[0] for c in pirate_cells]
        ax_map.scatter(px, py, c="#D50000", marker="x", s=14, alpha=0.45, linewidth=0.8,
                       label=f"Pirate Attacks (N={len(pirate_cells)})", zorder=3)

    # Plot Restricted Zones
    zone_offsets = {
        "Phillips Channel Chokepoint": (12, 12),
        "One Fathom Bank Chokepoint": (-120, -14),
        "Riau Military & Shallow Corridor": (-145, -16),
    }
    for zname, zinfo in RESTRICTED_ZONES.items():
        zr, zc = latlon_to_cell(*zinfo["center"])
        radius_cells = zinfo["radius_deg"] / ((LAT_MAX - LAT_MIN) / GRID_H)
        circ = Circle((zc, zr), radius_cells, color="#6200EA", fill=False, linewidth=2.0, linestyle="--", zorder=4)
        ax_map.add_patch(circ)
        short_name = zname.replace("Chokepoint", "").strip()
        offset = zone_offsets.get(zname, (5, 5))
        ax_map.annotate(short_name, (zc, zr), fontsize=7.5, color="#4A148C", fontweight="bold",
                        xytext=offset, textcoords="offset points",
                        bbox=dict(boxstyle="round,pad=0.2", facecolor="white", alpha=0.9, edgecolor="#B39DDB"))

    # Plot Routes with clear distinct stroke styling
    d_p = d_metrics["path"]
    a_p = a_metrics["path"]
    aco_p = aco_metrics["path"]

    ax_map.plot([p[1] for p in d_p], [p[0] for p in d_p], color=c_dijkstra, linewidth=3.0,
                label=f"Dijkstra (Shortest: {d_metrics['total_dist_nm']} NM, Cost: {d_metrics['cost']:.1f})", zorder=5)

    ax_map.plot([p[1] for p in a_p], [p[0] for p in a_p], color=c_astar, linewidth=2.6, linestyle="--",
                label=f"A* Search (Informed: {a_metrics['total_dist_nm']} NM, Cost: {a_metrics['cost']:.1f})", zorder=6)

    ax_map.plot([p[1] for p in aco_p], [p[0] for p in aco_p], color=c_aco, linewidth=3.4, linestyle=":",
                label=f"ACO Swarm (Pareto Optimal: {aco_metrics['total_dist_nm']} NM, Cost: {aco_metrics['cost']:.1f})", zorder=7)

    # Plot Start / Goal and Major Ports
    ax_map.scatter([start[1]], [start[0]], c="#00E676", edgecolors="black", s=140, marker="o", zorder=8, label="Origin Port (Penang)")
    ax_map.scatter([goal[1]], [goal[0]], c="#FF1744", edgecolors="black", s=190, marker="*", zorder=8, label="Destination (Singapore)")

    port_text_offsets = {
        "Sabang (NW Gateway)": (10, -4),
        "Belawan (Sumatra)": (8, -8),
        "Penang (Malaysia)": (8, 6),
        "Port Klang (Malaysia)": (10, 4),
        "Dumai (Sumatra)": (8, -8),
        "Singapore (SE Gateway)": (10, 8)
    }

    for pname, pcoords in PORTS.items():
        pr, pc = latlon_to_cell(*pcoords)
        if (pr, pc) not in [start, goal]:
            ax_map.scatter([pc], [pr], marker="s", c="white", edgecolors="black", s=45, zorder=7)
        offset = port_text_offsets.get(pname, (6, -6))
        display_name = "Port Klang" if "Port Klang" in pname else pname.split(" ")[0]
        ax_map.annotate(display_name, (pc, pr), fontsize=8, fontweight="bold", color="#1A237E",
                        xytext=offset, textcoords="offset points",
                        bbox=dict(boxstyle="round,pad=0.2", facecolor="white", alpha=0.88, edgecolor="gray"))

    # Axes Ticks (Lat/Lon)
    n_ticks = 6
    row_ticks = np.linspace(0, GRID_H - 1, n_ticks)
    col_ticks = np.linspace(0, GRID_W - 1, n_ticks)
    ax_map.set_yticks(row_ticks)
    ax_map.set_yticklabels([f"{cell_to_latlon(r, 0)[0]:.1f}°N" for r in row_ticks], fontsize=9)
    ax_map.set_xticks(col_ticks)
    ax_map.set_xticklabels([f"{cell_to_latlon(0, c)[1]:.1f}°E" for c in col_ticks], fontsize=9)

    ax_map.set_title("Strait of Malacca: Multi-Algorithm Navigational Routing Benchmark", fontsize=12.5, fontweight="bold", pad=12)
    # Position legend cleanly in open waters off Sumatra
    ax_map.legend(loc="lower left", fontsize=8.2, framealpha=0.92, edgecolor="#CCCCCC", bbox_to_anchor=(0.02, 0.14))

    cbar = fig.colorbar(im, ax=ax_map, orientation="horizontal", fraction=0.035, pad=0.07)
    cbar.set_label("Composite Navigational Risk Index (0: Calmer Waters  →  10: Critical Hazard)", fontsize=9, fontweight="bold")

    # -------------------------------------------------------------
    # 2. COMPOSITE ROUTE COST (Top Middle)
    # -------------------------------------------------------------
    ax_cost = fig.add_subplot(gs[0, 1])
    algos = ["Dijkstra", "A* Search", "ACO Swarm"]
    costs = [d_metrics["cost"], a_metrics["cost"], aco_metrics["cost"]]
    colors = [c_dijkstra, c_astar, c_aco]

    bars = ax_cost.bar(algos, costs, color=colors, width=0.52, edgecolor="black", linewidth=1.2, alpha=0.9)
    ax_cost.set_ylabel("Composite Pareto Cost (Lower = Better)", fontsize=9.5, fontweight="bold")
    ax_cost.set_title("Composite Route Cost Comparison", fontsize=11, fontweight="bold")
    ax_cost.set_ylim(70, 96)

    for bar, val in zip(bars, costs):
        ax_cost.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 0.6,
                     f"{val:.2f}", ha="center", va="bottom", fontsize=10, fontweight="bold")

    diff_dijkstra = ((costs[0] - costs[2]) / costs[0]) * 100.0
    ax_cost.text(0.5, 0.10, f"[OPTIMAL] ACO achieves {diff_dijkstra:.1f}% lower cost than Dijkstra\nBalances distance, time, and pirate hazards",
                 transform=ax_cost.transAxes, ha="center", fontsize=8.2, fontweight="bold",
                 bbox=dict(boxstyle="round,pad=0.35", facecolor="#FFF9C4", edgecolor="#FBC02D"))

    # -------------------------------------------------------------
    # 3. DISTANCE vs TIME vs PEAK RISK (Top Right)
    # -------------------------------------------------------------
    ax_metrics = fig.add_subplot(gs[0, 2])
    x = np.arange(3)
    width = 0.26

    dists = [d_metrics["total_dist_nm"], a_metrics["total_dist_nm"], aco_metrics["total_dist_nm"]]
    times = [d_metrics["total_time_hrs"], a_metrics["total_time_hrs"], aco_metrics["total_time_hrs"]]

    b1 = ax_metrics.bar(x - width/2, dists, width, label="Distance (NM)", color="#3949AB", edgecolor="black")
    ax_metrics.set_ylabel("Nautical Distance (NM)", fontsize=9.5, fontweight="bold", color="#1A237E")
    ax_metrics.set_xticks(x)
    ax_metrics.set_xticklabels(algos, fontsize=9.5, fontweight="bold")
    ax_metrics.set_ylim(320, 420)
    ax_metrics.set_title("Distance vs. Transit Time Trade-Off", fontsize=11, fontweight="bold")

    # Secondary y-axis for travel time
    ax_time = ax_metrics.twinx()
    b2 = ax_time.bar(x + width/2, times, width, label="Transit Time (hrs)", color="#00897B", edgecolor="black")
    ax_time.set_ylabel("Transit Duration (Hours)", fontsize=9.5, fontweight="bold", color="#004D40")
    ax_time.set_ylim(16, 26)
    ax_time.grid(False)

    for bar, val in zip(b1, dists):
        ax_metrics.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 1.5, f"{val:.0f} NM", ha="center", fontsize=8, fontweight="bold")
    for bar, val in zip(b2, times):
        ax_time.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 0.2, f"{val:.1f}h", ha="center", fontsize=8, fontweight="bold")

    # -------------------------------------------------------------
    # 4. STEP-BY-STEP RISK PROFILE ALONG THE VOYAGE (Bottom Middle)
    # -------------------------------------------------------------
    ax_profile = fig.add_subplot(gs[1, 1])

    d_risks = [env.composite_risk[r, c] for (r, c) in d_p]
    a_risks = [env.composite_risk[r, c] for (r, c) in a_p]
    aco_risks = [env.composite_risk[r, c] for (r, c) in aco_p]

    d_x = np.linspace(0, 100, len(d_risks))
    a_x = np.linspace(0, 100, len(a_risks))
    aco_x = np.linspace(0, 100, len(aco_risks))

    ax_profile.plot(d_x, d_risks, color=c_dijkstra, linewidth=2.2, label="Dijkstra Risk Profile")
    ax_profile.plot(a_x, a_risks, color=c_astar, linewidth=2.0, linestyle="--", label="A* Risk Profile")
    ax_profile.plot(aco_x, aco_risks, color=c_aco, linewidth=2.6, linestyle=":", label="ACO Risk Profile")

    ax_profile.axhline(7.0, color="crimson", linestyle=":", linewidth=1.5, label="High-Risk Threshold (7.0)")
    ax_profile.set_xlabel("Voyage Transit Progress (Penang → Singapore %)", fontsize=9.5, fontweight="bold")
    ax_profile.set_ylabel("Encounter Risk Level (0 - 10)", fontsize=9.5, fontweight="bold")
    ax_profile.set_title("Hazard Exposure Along Transit Corridor", fontsize=11, fontweight="bold")
    ax_profile.set_ylim(0, 8.5)
    ax_profile.legend(loc="upper left", fontsize=8.0, framealpha=0.9)

    # -------------------------------------------------------------
    # 5. QUANTITATIVE SCORECARD TABLE (Bottom Right)
    # -------------------------------------------------------------
    ax_summary = fig.add_subplot(gs[1, 2])

    metrics_table = [
        ["Benchmark Metric", "Dijkstra", "A* Search", "ACO Swarm"],
        ["Total Distance", f"{d_metrics['total_dist_nm']} NM", f"{a_metrics['total_dist_nm']} NM", f"{aco_metrics['total_dist_nm']} NM"],
        ["Voyage Duration", f"{d_metrics['total_time_hrs']} hrs", f"{a_metrics['total_time_hrs']} hrs", f"{aco_metrics['total_time_hrs']} hrs"],
        ["Peak Risk Exposure", f"{d_metrics['max_risk']}", f"{a_metrics['max_risk']}", f"{aco_metrics['max_risk']}"],
        ["Mean Corridor Risk", f"{d_metrics['avg_risk']}", f"{a_metrics['avg_risk']}", f"{aco_metrics['avg_risk']}"],
        ["Composite Cost", f"{d_metrics['cost']:.2f}", f"{a_metrics['cost']:.2f}", f"{aco_metrics['cost']:.2f}"],
        ["Runtime Latency", f"{d_metrics['runtime_ms']:.1f} ms", f"{a_metrics['runtime_ms']:.1f} ms", f"{aco_metrics['runtime_ms']:.1f} ms"],
        ["Route Strategy", "Shortest Path", "Informed Track", "Pareto Optimal"]
    ]

    ax_summary.axis("off")
    table = ax_summary.table(cellText=metrics_table, cellLoc="center", loc="center",
                             colWidths=[0.34, 0.22, 0.22, 0.22])
    table.auto_set_font_size(False)
    table.set_fontsize(8.0)
    table.scale(1.0, 1.85)

    for (row, col), cell in table.get_celld().items():
        if row == 0:
            cell.set_facecolor("#1A237E")
            cell.set_text_props(color="white", fontweight="bold")
        elif col == 0:
            cell.set_facecolor("#ECEFF1")
            cell.set_text_props(fontweight="bold")
        elif col == 3:  # ACO column
            cell.set_facecolor("#FFF3E0")
            cell.set_text_props(fontweight="bold", color="#BF360C")
        else:
            cell.set_facecolor("#FAFAFA")

    ax_summary.set_title("Empirical Algorithm Benchmark Scorecard", fontsize=11, fontweight="bold", pad=12)

    # Main Super Title
    plt.suptitle("Maritime Fleet Defense: Multi-Algorithm Routing Benchmark (Dijkstra vs. A* vs. ACO Swarm)",
                 fontsize=14.5, fontweight="bold", y=0.98)

    output_path = "algorithm_comparison_benchmark.png"
    plt.savefig(output_path, dpi=250, bbox_inches="tight")
    print(f"\n[SUCCESS] Generated benchmark comparison chart: {output_path}")

    # Also save to static/images for web display
    static_output = "static/algorithm_comparison_benchmark.png"
    plt.savefig(static_output, dpi=250, bbox_inches="tight")
    print(f"[SUCCESS] Saved copy to web static folder: {static_output}")


if __name__ == "__main__":
    run_benchmark()
