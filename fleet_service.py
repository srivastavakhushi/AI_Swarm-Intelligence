"""
Fleet Vessel Position Tracking & Telemetry Service
--------------------------------------------------
Manages real-time and simulated coordinates (latitude, longitude, speed, heading)
for the maritime fleet.

Both the Vessel Crew view and the Fleet Commander view directly consume this
data service. When a crew member updates vessel telemetry, advances a voyage,
or reports a navigational offset in the Vessel Position module, the updated
coordinates are dynamically served to the Fleet Commander.
"""

import math
import time
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

# Conversion factors: 1 knot = 1 nautical mile/hour ≈ 1/60 degree latitude per hour
NM_TO_DEG = 1.0 / 60.0


class FleetService:
    def __init__(self):
        self.vessels: Dict[str, Dict[str, Any]] = {
            "VESSEL-001": {
                "id": "VESSEL-001",
                "name": "MV Sentinel Guardian",
                "callsign": "9V-SG44",
                "vessel_class": "Guided Escort & Flagship",
                "type": "Guided Escort & Cargo Vessel",
                "flag": "Singapore",
                "mmsi": "563098110",
                "lat": 5.4160,
                "lon": 100.3450,
                "speed_knots": 18.0,
                "heading_deg": 135.0,
                "heading_cardinal": "SE",
                "depth_m": 12.5,
                "status": "MOORED", # MOORED, EN_ROUTE, UNDERWAY, ANCHORED
                "origin_port": "Penang (Malaysia)",
                "dest_port": "Singapore (SE Gateway)",
                "threat_level": "low",
                "threat_label": "LOW",
                "ai_confidence": 98,
                "last_contact": "JUST NOW",
                "trail": [
                    [5.4160, 100.3450]
                ],
                "route_deviation": False,
                "notes": "Lead mission vessel under active cyber-defense & ACO route guidance."
            },
            "VESSEL-002": {
                "id": "VESSEL-002",
                "name": "MV Ocean Defender",
                "callsign": "9V-OD22",
                "vessel_class": "Tactical Escort Cutter",
                "type": "Escort Patrol Cutter",
                "flag": "Singapore",
                "mmsi": "563099441",
                "lat": 1.1850,
                "lon": 103.5500,
                "speed_knots": 19.5,
                "heading_deg": 115.0,
                "heading_cardinal": "ESE",
                "depth_m": 8.0,
                "status": "UNDERWAY",
                "origin_port": "Port Klang (Malaysia)",
                "dest_port": "Singapore (SE Gateway)",
                "threat_level": "high",
                "threat_label": "HIGH",
                "ai_confidence": 92,
                "last_contact": "1 MIN AGO",
                "trail": [
                    [1.2400, 103.4200],
                    [1.2100, 103.4800],
                    [1.1850, 103.5500]
                ],
                "route_deviation": False,
                "notes": "Escort patrol operating near Singapore Strait approach piracy hotspot."
            },
            "VESSEL-003": {
                "id": "VESSEL-003",
                "name": "MT Pacific Aegis",
                "callsign": "V7-PA09",
                "vessel_class": "VLCC Crude Oil Tanker",
                "type": "Crude Oil Tanker",
                "flag": "Marshall Islands",
                "mmsi": "538009221",
                "lat": 1.2500,
                "lon": 103.9500,
                "speed_knots": 12.5,
                "heading_deg": 85.0,
                "heading_cardinal": "E",
                "depth_m": 21.0,
                "status": "UNDERWAY",
                "origin_port": "Dumai (Sumatra)",
                "dest_port": "Singapore (SE Gateway)",
                "threat_level": "critical",
                "threat_label": "CRITICAL",
                "ai_confidence": 95,
                "last_contact": "JUST NOW",
                "trail": [
                    [1.2000, 103.8200],
                    [1.2250, 103.8800],
                    [1.2500, 103.9500]
                ],
                "route_deviation": False,
                "notes": "Eastbound TSS lane transit; high-value oil shipment under elevated pirate watch."
            },
            "VESSEL-004": {
                "id": "VESSEL-004",
                "name": "Tug Atlas Titan",
                "callsign": "9M-TT04",
                "vessel_class": "Heavy Ocean Towage Tug",
                "type": "Ocean Tug & Salvage",
                "flag": "Malaysia",
                "mmsi": "533004812",
                "lat": 4.1200,
                "lon": 100.6500,
                "speed_knots": 9.8,
                "heading_deg": 142.0,
                "heading_cardinal": "SE",
                "depth_m": 6.5,
                "status": "ESCORT_DUTY",
                "origin_port": "Penang (Malaysia)",
                "dest_port": "Port Klang (Malaysia)",
                "threat_level": "medium",
                "threat_label": "MEDIUM",
                "ai_confidence": 88,
                "last_contact": "2 MIN AGO",
                "trail": [
                    [4.2500, 100.5200],
                    [4.1800, 100.5900],
                    [4.1200, 100.6500]
                ],
                "route_deviation": False,
                "notes": "Towing heavy modular cargo barge southbound down Malacca corridor."
            },
            "VESSEL-005": {
                "id": "VESSEL-005",
                "name": "FV Sea Sentinel",
                "callsign": "9V-SS55",
                "vessel_class": "Coastal Fast Interceptor",
                "type": "Rapid Coastal Patrol",
                "flag": "Singapore",
                "mmsi": "563001889",
                "lat": 2.8900,
                "lon": 101.0200,
                "speed_knots": 24.0,
                "heading_deg": 310.0,
                "heading_cardinal": "NW",
                "depth_m": 4.5,
                "status": "PATROL",
                "origin_port": "Port Klang (Malaysia)",
                "dest_port": "One Fathom Bank Sector",
                "threat_level": "low",
                "threat_label": "LOW",
                "ai_confidence": 99,
                "last_contact": "JUST NOW",
                "trail": [
                    [2.7800, 101.1500],
                    [2.8350, 101.0800],
                    [2.8900, 101.0200]
                ],
                "route_deviation": False,
                "notes": "Anti-piracy radar sweep covering One Fathom Bank choke point."
            },
            "VESSEL-006": {
                "id": "VESSEL-006",
                "name": "MV Malacca Trader",
                "callsign": "A8-MT77",
                "vessel_class": "Feeder Container Ship",
                "type": "Container Carrier",
                "flag": "Liberia",
                "mmsi": "636018900",
                "lat": 3.4500,
                "lon": 100.1000,
                "speed_knots": 15.2,
                "heading_deg": 120.0,
                "heading_cardinal": "ESE",
                "depth_m": 10.2,
                "status": "UNDERWAY",
                "origin_port": "Belawan (Sumatra)",
                "dest_port": "Singapore (SE Gateway)",
                "threat_level": "medium",
                "threat_label": "MEDIUM",
                "ai_confidence": 90,
                "last_contact": "3 MIN AGO",
                "trail": [
                    [3.6500, 99.8500],
                    [3.5500, 99.9800],
                    [3.4500, 100.1000]
                ],
                "route_deviation": False,
                "notes": "Commercial feeder carrying electronics and dry containerized freight."
            },
            "VESSEL-007": {
                "id": "VESSEL-007",
                "name": "MT Horizon Gas",
                "callsign": "T8-HG12",
                "vessel_class": "LPG Gas Carrier",
                "type": "LPG Liquefied Gas Carrier",
                "flag": "Palau",
                "mmsi": "511002340",
                "lat": 1.0550,
                "lon": 103.6200,
                "speed_knots": 14.8,
                "heading_deg": 102.0,
                "heading_cardinal": "ESE",
                "depth_m": 11.0,
                "status": "UNDERWAY",
                "origin_port": "Sabang (NW Gateway)",
                "dest_port": "Singapore (SE Gateway)",
                "threat_level": "high",
                "threat_label": "HIGH",
                "ai_confidence": 89,
                "last_contact": "JUST NOW",
                "trail": [
                    [1.0800, 103.4800],
                    [1.0680, 103.5500],
                    [1.0550, 103.6200]
                ],
                "route_deviation": False,
                "notes": "Transiting near Pulau Cula TSS sector where armed boardings were reported."
            },
            "VESSEL-008": {
                "id": "VESSEL-008",
                "name": "MV Eastern Star",
                "callsign": "VR-ES88",
                "vessel_class": "Capesize Bulk Carrier",
                "type": "Capesize Bulk Carrier",
                "flag": "Hong Kong",
                "mmsi": "477019800",
                "lat": 1.2900,
                "lon": 104.0500,
                "speed_knots": 0.0,
                "heading_deg": 40.0,
                "heading_cardinal": "NE",
                "depth_m": 17.5,
                "status": "ANCHORED",
                "origin_port": "Australia",
                "dest_port": "Singapore Anchorage",
                "threat_level": "low",
                "threat_label": "LOW",
                "ai_confidence": 97,
                "last_contact": "JUST NOW",
                "trail": [
                    [1.2900, 104.0500]
                ],
                "route_deviation": False,
                "notes": "Anchored at Eastern Boarding Ground waiting for bunkering and customs inspection."
            }
        }

    def get_all_vessels(self) -> List[Dict[str, Any]]:
        """Returns the full list of fleet vessels with real-time coordinates."""
        return list(self.vessels.values())

    def get_vessel(self, vessel_id: str) -> Optional[Dict[str, Any]]:
        """Returns telemetry for a specific vessel."""
        return self.vessels.get(vessel_id)

    def _calculate_cardinal(self, heading_deg: float) -> str:
        """Converts degrees into cardinal abbreviation."""
        cardinals = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
                     "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"]
        idx = int((heading_deg + 11.25) / 22.5) % 16
        return cardinals[idx]

    def update_vessel_telemetry(
        self,
        vessel_id: str,
        lat: Optional[float] = None,
        lon: Optional[float] = None,
        speed_knots: Optional[float] = None,
        heading_deg: Optional[float] = None,
        status: Optional[str] = None,
        notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """Updates vessel navigation coordinates, speed, heading, and status."""
        v = self.vessels.get(vessel_id)
        if not v:
            return {"success": False, "error": f"Vessel '{vessel_id}' not found"}

        if lat is not None:
            v["lat"] = round(float(lat), 5)
        if lon is not None:
            v["lon"] = round(float(lon), 5)
        if speed_knots is not None:
            v["speed_knots"] = round(float(speed_knots), 1)
        if heading_deg is not None:
            h = float(heading_deg) % 360.0
            v["heading_deg"] = round(h, 1)
            v["heading_cardinal"] = self._calculate_cardinal(h)
        if status is not None:
            v["status"] = status
        if notes is not None:
            v["notes"] = notes

        v["last_contact"] = "JUST NOW"

        # Append to trail
        current_pos = [v["lat"], v["lon"]]
        if not v["trail"] or v["trail"][-1] != current_pos:
            v["trail"].append(current_pos)
            if len(v["trail"]) > 50:
                v["trail"] = v["trail"][-50:]

        return {"success": True, "vessel": v}

    def report_vessel_deviation(
        self,
        vessel_id: str,
        lat_offset: float = 0.08,
        lon_offset: float = 0.06,
        reason: str = "Tidal surface drift & evasive clearing"
    ) -> Dict[str, Any]:
        """Reports a navigational route deviation for a fleet vessel."""
        v = self.vessels.get(vessel_id)
        if not v:
            return {"success": False, "error": f"Vessel '{vessel_id}' not found"}

        v["lat"] = round(v["lat"] + float(lat_offset), 5)
        v["lon"] = round(v["lon"] + float(lon_offset), 5)
        v["route_deviation"] = True
        v["last_contact"] = "DEVIATION REPORTED"
        v["notes"] = f"Navigation Deviation: {reason} (+{lat_offset}N, +{lon_offset}E)"

        v["trail"].append([v["lat"], v["lon"]])

        return {
            "success": True,
            "vessel_id": vessel_id,
            "new_lat": v["lat"],
            "new_lon": v["lon"],
            "deviation_active": True,
            "alert": f"Route deviation recorded for {v['name']}. Navigational offset applied ({reason}).",
            "vessel": v
        }

    def simulate_tick(self, time_delta_sec: float = 60.0) -> Dict[str, Any]:
        """
        Advances all moving/underway vessels forward along their heading vector.
        Allows real-time or stepped simulation in the Vessel Position tab.
        """
        hours = time_delta_sec / 3600.0
        updated = []

        for v in self.vessels.values():
            if v["status"] in ("UNDERWAY", "EN_ROUTE", "PATROL", "ESCORT_DUTY") and v["speed_knots"] > 0:
                dist_nm = v["speed_knots"] * hours
                rad = math.radians(v["heading_deg"])
                # Rough planar nautical projection for Malacca latitude ~1-5N
                delta_lat = dist_nm * math.cos(rad) * NM_TO_DEG
                # Correct for cosine of latitude for longitude degrees
                cos_lat = math.cos(math.radians(v["lat"]))
                delta_lon = (dist_nm * math.sin(rad) * NM_TO_DEG) / max(0.2, cos_lat)

                v["lat"] = round(v["lat"] + delta_lat, 5)
                v["lon"] = round(v["lon"] + delta_lon, 5)

                # Keep coordinates bounded inside Southeast Asia / Malacca corridor
                v["lat"] = max(0.5, min(6.5, v["lat"]))
                v["lon"] = max(95.0, min(105.0, v["lon"]))

                v["trail"].append([v["lat"], v["lon"]])
                if len(v["trail"]) > 50:
                    v["trail"] = v["trail"][-50:]

                v["last_contact"] = "JUST NOW"
                updated.append(v["id"])

        return {
            "success": True,
            "simulated_delta_sec": time_delta_sec,
            "vessels_updated": updated,
            "total_fleet": len(self.vessels)
        }

    def sync_primary_vessel(self, workflow_vessel_info: Dict[str, Any]) -> None:
        """
        Keeps VESSEL-001 in perfect sync with MaritimeWorkflowSystem's `vessel_info`
        so voyage steps, status, and port departures automatically update both views.
        """
        v = self.vessels.get("VESSEL-001")
        if not v or not workflow_vessel_info:
            return

        v["lat"] = workflow_vessel_info.get("current_lat", v["lat"])
        v["lon"] = workflow_vessel_info.get("current_lon", v["lon"])
        v["speed_knots"] = workflow_vessel_info.get("speed_knots", v["speed_knots"])
        v["status"] = workflow_vessel_info.get("status", v["status"])
        v["origin_port"] = workflow_vessel_info.get("origin_port", v["origin_port"])
        v["dest_port"] = workflow_vessel_info.get("destination_port", v["dest_port"])
        v["route_deviation"] = workflow_vessel_info.get("route_deviation_reported", False)

        curr_pt = [v["lat"], v["lon"]]
        if not v["trail"] or v["trail"][-1] != curr_pt:
            v["trail"].append(curr_pt)


# Global singleton fleet service
fleet_service = FleetService()
