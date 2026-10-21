"""
Atmospheric weather service (Open-Meteo)
----------------------------------------
Wind, gusts, visibility, rain, cloud, pressure and a 48h forecast for any
lat/lon. Free, no account or API key. Pairs with copernicus_service.py,
which covers currents and waves.

Wire into threat_intel_server.py:
    from weather_service import router as weather_router
    app.include_router(weather_router)

Note: Open-Meteo's free tier is for non-commercial use. For commercial
deployment, use their paid plan (same API, add &apikey=...).
"""

import json
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

API_URL = "https://api.open-meteo.com/v1/forecast"
CACHE_TTL_SECONDS = 600
_CACHE: Dict[str, Dict[str, Any]] = {}

HOURLY_VARS = [
    "temperature_2m", "pressure_msl", "cloud_cover", "precipitation",
    "visibility", "wind_speed_10m", "wind_direction_10m", "wind_gusts_10m",
    "weather_code",
]

WMO_CODES = {
    0: "Clear", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Fog", 48: "Rime fog", 51: "Light drizzle", 53: "Drizzle",
    55: "Heavy drizzle", 61: "Light rain", 63: "Rain", 65: "Heavy rain",
    80: "Rain showers", 81: "Heavy showers", 82: "Violent showers",
    95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Severe thunderstorm",
}


def _beaufort(kn: float) -> int:
    limits = [1, 4, 7, 11, 17, 22, 28, 34, 41, 48, 56, 64]
    for i, lim in enumerate(limits):
        if kn < lim:
            return i
    return 12


def _advisory(wind_kn: float, gust_kn: float, vis_km: Optional[float], code: int) -> Dict[str, str]:
    """Simple operational status. Thresholds are a starting point: tune them to your fleet's SOPs."""
    reasons: List[str] = []
    level = "GREEN"

    def raise_to(new: str):
        nonlocal level
        order = ["GREEN", "AMBER", "RED"]
        if order.index(new) > order.index(level):
            level = new

    if gust_kn >= 48 or wind_kn >= 34:
        raise_to("RED"); reasons.append("Storm-force winds")
    elif gust_kn >= 34 or wind_kn >= 28:
        raise_to("AMBER"); reasons.append("Gale-force winds / gusts")
    if vis_km is not None:
        if vis_km < 1:
            raise_to("RED"); reasons.append("Restricted visibility (<1 km)")
        elif vis_km < 4:
            raise_to("AMBER"); reasons.append("Reduced visibility (<4 km)")
    if code in (95, 96, 99):
        raise_to("AMBER"); reasons.append("Thunderstorm activity")
    return {"level": level, "reasons": reasons or ["No weather restrictions"]}


def _fetch(lat: float, lon: float) -> Dict[str, Any]:
    params = {
        "latitude": lat, "longitude": lon,
        "hourly": ",".join(HOURLY_VARS),
        "wind_speed_unit": "kn",
        "forecast_days": 3,
        "timezone": "UTC",
    }
    url = f"{API_URL}?{urllib.parse.urlencode(params)}"
    with urllib.request.urlopen(url, timeout=15) as resp:
        return json.loads(resp.read().decode("utf-8"))


def get_weather(lat: float, lon: float) -> Dict[str, Any]:
    key = f"{round(lat * 4) / 4}:{round(lon * 4) / 4}"      # ~25 km cells share a cache entry
    hit = _CACHE.get(key)
    if hit and time.time() - hit["t"] < CACHE_TTL_SECONDS:
        return hit["v"]

    try:
        raw = _fetch(lat, lon)
    except (urllib.error.URLError, TimeoutError, ValueError) as e:
        return {"status": "error", "message": f"Open-Meteo unreachable: {e}"}

    h = raw.get("hourly", {})
    times: List[str] = h.get("time", [])
    if not times:
        return {"status": "error", "message": "No hourly data returned"}

    now_key = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:00")
    i = times.index(now_key) if now_key in times else 0

    def at(var: str, idx: int):
        arr = h.get(var, [])
        return arr[idx] if idx < len(arr) else None

    wind, gust = at("wind_speed_10m", i) or 0.0, at("wind_gusts_10m", i) or 0.0
    vis_m = at("visibility", i)
    vis_km = round(vis_m / 1000, 1) if vis_m is not None else None
    code = int(at("weather_code", i) or 0)

    forecast = []
    for j in range(i, min(i + 48, len(times)), 3):
        c = int(at("weather_code", j) or 0)
        forecast.append({
            "time_utc": times[j] + "Z",
            "wind_kn": at("wind_speed_10m", j),
            "gust_kn": at("wind_gusts_10m", j),
            "wind_from_deg": at("wind_direction_10m", j),
            "precip_mm": at("precipitation", j),
            "visibility_km": round(at("visibility", j) / 1000, 1) if at("visibility", j) is not None else None,
            "conditions": WMO_CODES.get(c, "Unknown"),
        })

    result = {
        "status": "success",
        "latitude": lat, "longitude": lon,
        "timestamp_utc": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%SZ"),
        "source": "Open-Meteo",
        "current": {
            "conditions": WMO_CODES.get(code, "Unknown"),
            "temperature_c": at("temperature_2m", i),
            "pressure_hpa": at("pressure_msl", i),
            "cloud_cover_pct": at("cloud_cover", i),
            "precipitation_mm": at("precipitation", i),
            "visibility_km": vis_km,
            "wind_kn": wind,
            "wind_from_deg": at("wind_direction_10m", i),
            "gust_kn": gust,
            "beaufort": _beaufort(wind),
        },
        "advisory": _advisory(wind, gust, vis_km, code),
        "forecast_48h": forecast,
    }
    _CACHE[key] = {"t": time.time(), "v": result}
    return result


# ------------------------------------------------------------- FastAPI router
try:
    from fastapi import APIRouter
    router = APIRouter(prefix="/api/weather", tags=["Weather"])

    @router.get("")
    def api_weather(lat: float, lon: float):
        return get_weather(lat, lon)
except ImportError:
    router = None
