"""
Copernicus Marine (CMEMS) live ocean conditions service
-------------------------------------------------------
Currents, waves and sea-surface wind for any lat/lon (e.g. a fleet vessel
position) or a bounding box (map overlay).

Setup:
    pip install copernicusmarine xarray numpy
    Free account: https://marine.copernicus.eu  ->  Register
    Set credentials as environment variables (never hardcode them):
        COPERNICUSMARINE_SERVICE_USERNAME=...
        COPERNICUSMARINE_SERVICE_PASSWORD=...

Wire into threat_intel_server.py with two lines:
    from copernicus_service import router as ocean_router
    app.include_router(ocean_router)

Dataset IDs are versioned by Copernicus and do change. Verify with:
    copernicusmarine describe --contains cmems_mod_glo_wav_anfc
"""

import math
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

try:
    import copernicusmarine as cm
    import numpy as np
    CM_AVAILABLE = True
except ImportError:
    CM_AVAILABLE = False

MS_TO_KNOTS = 1.943844
CACHE_TTL_SECONDS = 3600          # model fields update every few hours
_CACHE: Dict[str, Dict[str, Any]] = {}

DATASETS = {
    # Hourly total currents (ocean + tide + Stokes drift), 1/12 degree
    "currents": {
        "id": "cmems_mod_glo_phy_anfc_merged-uv_PT1H-i",
        "vars": ["utotal", "vtotal"],
    },
    # Significant wave height, mean direction, peak period, 3-hourly
    "waves": {
        "id": "cmems_mod_glo_wav_anfc_0.083deg_PT3H-i",
        "vars": ["VHM0", "VMDR", "VTPK"],
    },
    # Near-real-time observed sea-surface wind (no forecast), hourly
    "wind": {
        "id": "cmems_obs-wind_glo_phy_nrt_l4_0.125deg_PT1H",
        "vars": ["eastward_wind", "northward_wind"],
    },
}


# ----------------------------------------------------------------- helpers
def _cached(key: str):
    hit = _CACHE.get(key)
    if hit and time.time() - hit["t"] < CACHE_TTL_SECONDS:
        return hit["v"]
    return None


def _store(key: str, value):
    _CACHE[key] = {"t": time.time(), "v": value}
    return value


def _open(kind: str, min_lat, max_lat, min_lon, max_lon,
          hours_back: int = 3, hours_fwd: int = 24, latest_only: bool = False):
    cfg = DATASETS[kind]
    box = dict(
        minimum_latitude=min_lat, maximum_latitude=max_lat,
        minimum_longitude=min_lon, maximum_longitude=max_lon,
    )
    if latest_only:
        # Observation datasets end a few hours before "now", so asking for a
        # time window up to now is rejected. Open the box and keep the last steps.
        ds = cm.open_dataset(dataset_id=cfg["id"], variables=cfg["vars"], **box)
        return ds.isel(time=slice(-6, None))
    now = datetime.now(timezone.utc)
    return cm.open_dataset(
        dataset_id=cfg["id"],
        variables=cfg["vars"],
        start_datetime=(now - timedelta(hours=hours_back)).strftime("%Y-%m-%dT%H:%M:%S"),
        end_datetime=(now + timedelta(hours=hours_fwd)).strftime("%Y-%m-%dT%H:%M:%S"),
        **box,
    )


def _speed_dir(u: float, v: float):
    """u east, v north (m/s) -> (speed knots, direction the flow goes TOWARD, deg true)."""
    speed = math.hypot(u, v) * MS_TO_KNOTS
    toward = (math.degrees(math.atan2(u, v)) + 360) % 360
    return round(speed, 2), round(toward, 0)


def _num(x) -> Optional[float]:
    x = float(x)
    return None if math.isnan(x) else x


def _nearest_now_index(ds) -> int:
    times = ds["time"].values
    now = np.datetime64(datetime.now(timezone.utc).replace(tzinfo=None))
    return int(np.abs(times - now).argmin())


# --------------------------------------------------------- point conditions
def _point_currents(lat, lon):
    ds = _open("currents", lat - 0.3, lat + 0.3, lon - 0.3, lon + 0.3)
    if "depth" in ds.dims:
        ds = ds.isel(depth=0)
    p = ds.sel(latitude=lat, longitude=lon, method="nearest")
    i = _nearest_now_index(p)
    u, v = _num(p["utotal"].isel(time=i)), _num(p["vtotal"].isel(time=i))
    if u is None or v is None:
        return {"available": False, "reason": "no data (land or outside coverage)"}
    spd, brg = _speed_dir(u, v)
    forecast = []
    for j in range(i, min(i + 24, p.sizes["time"]), 3):
        uj, vj = _num(p["utotal"].isel(time=j)), _num(p["vtotal"].isel(time=j))
        if uj is not None and vj is not None:
            s, b = _speed_dir(uj, vj)
            forecast.append({"time_utc": str(p["time"].values[j])[:16] + "Z",
                             "speed_kn": s, "direction_deg": b})
    return {"available": True, "speed_kn": spd, "direction_to_deg": brg,
            "forecast": forecast}


def _point_waves(lat, lon):
    ds = _open("waves", lat - 0.3, lat + 0.3, lon - 0.3, lon + 0.3)
    p = ds.sel(latitude=lat, longitude=lon, method="nearest")
    i = _nearest_now_index(p)
    hs = _num(p["VHM0"].isel(time=i))
    if hs is None:
        return {"available": False, "reason": "no data (land or outside coverage)"}
    return {
        "available": True,
        "sig_wave_height_m": round(hs, 2),
        "mean_direction_from_deg": _num(p["VMDR"].isel(time=i)),
        "peak_period_s": _num(p["VTPK"].isel(time=i)),
        "sea_state": _sea_state(hs),
    }


def _point_wind(lat, lon):
    ds = _open("wind", lat - 0.5, lat + 0.5, lon - 0.5, lon + 0.5, latest_only=True)
    p = ds.sel(latitude=lat, longitude=lon, method="nearest")
    i = _nearest_now_index(p)
    u, v = _num(p["eastward_wind"].isel(time=i)), _num(p["northward_wind"].isel(time=i))
    if u is None or v is None:
        return {"available": False, "reason": "no data"}
    spd, toward = _speed_dir(u, v)
    return {"available": True, "speed_kn": spd,
            "direction_from_deg": round((toward + 180) % 360, 0),
            "observed_at_utc": str(p["time"].values[i])[:16] + "Z"}


def _sea_state(hs: float) -> str:
    if hs < 0.5: return "CALM"
    if hs < 1.25: return "SLIGHT"
    if hs < 2.5: return "MODERATE"
    if hs < 4.0: return "ROUGH"
    if hs < 6.0: return "VERY ROUGH"
    return "HIGH"


def get_conditions(lat: float, lon: float) -> Dict[str, Any]:
    """Currents + waves + wind at a point. One source failing does not break the rest."""
    if not CM_AVAILABLE:
        return {"status": "unavailable",
                "message": "pip install copernicusmarine xarray numpy"}
    key = f"pt:{round(lat * 4) / 4}:{round(lon * 4) / 4}"
    hit = _cached(key)
    if hit:
        return hit

    out: Dict[str, Any] = {"status": "success", "latitude": lat, "longitude": lon,
                           "timestamp_utc": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%SZ"),
                           "source": "Copernicus Marine Service (CMEMS)"}
    for name, fn in (("currents", _point_currents), ("waves", _point_waves), ("wind", _point_wind)):
        try:
            out[name] = fn(lat, lon)
        except Exception as e:                      # keep going, report per source
            out[name] = {"available": False, "reason": str(e)[:200]}
    return _store(key, out)


# ------------------------------------------------------------ map grid layer
def get_grid(kind: str, min_lat: float, max_lat: float,
             min_lon: float, max_lon: float, max_points: int = 400) -> Dict[str, Any]:
    """Latest field over a bbox, thinned for drawing arrows on Leaflet."""
    if not CM_AVAILABLE:
        return {"status": "unavailable"}
    if kind not in ("currents", "wind"):
        return {"status": "error", "message": "kind must be currents or wind"}
    key = f"grid:{kind}:{min_lat:.1f}:{max_lat:.1f}:{min_lon:.1f}:{max_lon:.1f}"
    hit = _cached(key)
    if hit:
        return hit

    ds = _open(kind, min_lat, max_lat, min_lon, max_lon,
               hours_back=6, hours_fwd=0, latest_only=(kind == "wind"))
    if "depth" in ds.dims:
        ds = ds.isel(depth=0)
    ds = ds.isel(time=_nearest_now_index(ds))
    uname, vname = DATASETS[kind]["vars"]
    n_lat, n_lon = ds.sizes["latitude"], ds.sizes["longitude"]
    stride = max(1, int(math.ceil(math.sqrt(n_lat * n_lon / max_points))))
    ds = ds.isel(latitude=slice(None, None, stride), longitude=slice(None, None, stride))

    pts: List[Dict[str, Any]] = []
    for la in ds["latitude"].values:
        for lo in ds["longitude"].values:
            u = _num(ds[uname].sel(latitude=la, longitude=lo))
            v = _num(ds[vname].sel(latitude=la, longitude=lo))
            if u is None or v is None:
                continue
            s, b = _speed_dir(u, v)
            pts.append({"lat": round(float(la), 3), "lon": round(float(lo), 3),
                        "speed_kn": s, "direction_deg": b})
    return _store(key, {"status": "success", "kind": kind, "count": len(pts), "points": pts})


# ------------------------------------------------------------- FastAPI router
try:
    from fastapi import APIRouter
    router = APIRouter(prefix="/api/ocean", tags=["Copernicus Ocean"])

    # plain `def` (not async): copernicusmarine blocks, so FastAPI runs it in a threadpool
    @router.get("/conditions")
    def api_conditions(lat: float, lon: float):
        return get_conditions(lat, lon)

    @router.get("/grid")
    def api_grid(kind: str = "currents", min_lat: float = -5, max_lat: float = 10,
                 min_lon: float = 95, max_lon: float = 110):
        return get_grid(kind, min_lat, max_lat, min_lon, max_lon)
except ImportError:
    router = None
