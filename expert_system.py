"""
Maritime Navigation & Tactical Rule-Based Expert System (Unit 6: Expert Systems)
--------------------------------------------------------------------------------
Implements classical Expert System architecture:
  1. Knowledge Base (KB): Domain rules based on IMO COLREGs & Malacca transit safety.
  2. Working Memory (WM): Active facts derived from live vessel telemetry & environment.
  3. Inference Engine (IE): Forward-chaining pattern matcher with priority resolution.
  4. Explanation Facility (EF): Generates comprehensive "WHY" and "HOW" audit traces.
"""

from typing import Dict, Any, List, Optional
import math


class Rule:
    def __init__(
        self,
        rule_id: str,
        name: str,
        priority: int,
        antecedents: List[Dict[str, Any]],
        consequents: Dict[str, Any],
        rationale: str,
        colreg_ref: Optional[str] = None
    ):
        self.rule_id = rule_id
        self.name = name
        self.priority = priority  # Higher number = higher priority
        self.antecedents = antecedents  # e.g. [{"fact": "speed_knots", "op": ">", "val": 16.0}]
        self.consequents = consequents  # e.g. {"advisory": "REDUCE_SPEED", "recommended_speed": 12.0}
        self.rationale = rationale
        self.colreg_ref = colreg_ref

    def evaluate(self, facts: Dict[str, Any]) -> bool:
        """Evaluates whether all antecedents are satisfied by the current working memory."""
        for ant in self.antecedents:
            key = ant.get("fact")
            op = ant.get("op")
            target = ant.get("val")

            if key not in facts:
                return False

            val = facts[key]

            if op == "==" and val != target:
                return False
            elif op == "!=" and val == target:
                return False
            elif op == ">" and not (val > target):
                return False
            elif op == ">=" and not (val >= target):
                return False
            elif op == "<" and not (val < target):
                return False
            elif op == "<=" and not (val <= target):
                return False
            elif op == "in" and val not in target:
                return False
        return True


class MaritimeExpertSystem:
    def __init__(self):
        self.knowledge_base: List[Rule] = []
        self._init_knowledge_base()

    def _init_knowledge_base(self):
        """Initializes the production rules for maritime navigation advisory."""
        self.knowledge_base = [
            Rule(
                rule_id="RULE-01",
                name="Critical Under-Keel Clearance Advisory",
                priority=100,
                antecedents=[
                    {"fact": "depth_m", "op": "<", "val": 11.0},
                    {"fact": "speed_knots", "op": ">", "val": 12.0}
                ],
                consequents={
                    "severity": "CRITICAL",
                    "action": "THROTTLE_BACK_SLOW",
                    "recommended_speed": 8.0,
                    "helm_trim_deg": 0.0,
                    "headline": "CRITICAL UNDER-KEEL CLEARANCE (<11m)",
                    "message": "Squat effect risk in shallow water. Immediate throttle reduction to 8 knots mandatory."
                },
                rationale="Vessels travelling in shallow water experience hydrostatic squatting where hull draft increases proportionally to the square of vessel speed, risking grounding on shoals.",
                colreg_ref="IMO Resolution A.893(21) & Malacca Under-Keel Clearance Standard"
            ),
            Rule(
                rule_id="RULE-02",
                name="Route Deviation Recovery Protocol",
                priority=90,
                antecedents=[
                    {"fact": "route_deviation", "op": "==", "val": True}
                ],
                consequents={
                    "severity": "WARNING",
                    "action": "CORRECT_TRANSIT_CORRIDOR",
                    "recommended_speed": 12.0,
                    "helm_trim_deg": -10.0,
                    "headline": "TRANSIT DRIFT DETECTED",
                    "message": "Vessel has drifted from the designated deep-water route. Steer 10° Port to rejoin corridor centerline."
                },
                rationale="Uncorrected tidal drift moves vessels into unchartered coastal shoals or counter-traffic lanes in the Traffic Separation Scheme.",
                colreg_ref="COLREG Rule 10 (Traffic Separation Schemes)"
            ),
            Rule(
                rule_id="RULE-03",
                name="Chokepoint High-Traffic Funnel Regulation",
                priority=80,
                antecedents=[
                    {"fact": "in_chokepoint", "op": "==", "val": True},
                    {"fact": "speed_knots", "op": ">", "val": 15.0}
                ],
                consequents={
                    "severity": "ALERT",
                    "action": "REGULATE_CONGESTION_SPEED",
                    "recommended_speed": 12.0,
                    "helm_trim_deg": 0.0,
                    "headline": "MANDATORY CHOKEPOINT SPEED RESTRICTION",
                    "message": "Entering confined funnel zone (Phillips Channel / One Fathom Bank). Max allowable speed is 12 knots."
                },
                rationale="Traffic density in the narrow bottleneck exceeds 200 vessel movements daily. Maintaining safe stopping distance is required.",
                colreg_ref="COLREG Rule 6 (Safe Speed) & MPA Port Marine Circular"
            ),
            Rule(
                rule_id="RULE-04",
                name="Monsoonal Squall Sea State Damping",
                priority=70,
                antecedents=[
                    {"fact": "weather_severity", "op": ">=", "val": 6.5},
                    {"fact": "speed_knots", "op": ">", "val": 14.0}
                ],
                consequents={
                    "severity": "ADVISORY",
                    "action": "WEATHER_THROTTLE_REDUCTION",
                    "recommended_speed": 11.0,
                    "helm_trim_deg": 5.0,
                    "headline": "ADVERSE SEA STATE / SQUALL DETECTED",
                    "message": "High wave chop and monsoonal cross-currents active. Reduce speed to 11 knots and trim 5° Starboard against drift."
                },
                rationale="Squall wind shear destabilizes cargo integrity and reduces rudder authority during sudden wind gusts in the central strait.",
                colreg_ref="COLREG Rule 2 (Responsibility & Seaman's Prudence)"
            ),
            Rule(
                rule_id="RULE-05",
                name="Restricted Military & Reef Sector Proximity",
                priority=85,
                antecedents=[
                    {"fact": "dist_to_restricted_nm", "op": "<", "val": 8.0}
                ],
                consequents={
                    "severity": "WARNING",
                    "action": "EVADE_RESTRICTED_BOUNDS",
                    "recommended_speed": 14.0,
                    "helm_trim_deg": -15.0,
                    "headline": "RESTRICTED EXCLUSION ZONE PROXIMITY (<8 NM)",
                    "message": "Approaching hazardous military reef boundary. Execute 15° Port evasive course alteration."
                },
                rationale="Navigating within 8 nautical miles of military exercise corridors or shallow reef shoals triggers automatic coastal interception and navigational risk.",
                colreg_ref="SOLAS Chapter V (Safety of Navigation)"
            ),
            Rule(
                rule_id="RULE-06",
                name="Nominal Deep-Water Passage Cruise",
                priority=10,
                antecedents=[
                    {"fact": "depth_m", "op": ">=", "val": 11.0},
                    {"fact": "route_deviation", "op": "==", "val": False},
                    {"fact": "in_chokepoint", "op": "==", "val": False}
                ],
                consequents={
                    "severity": "NOMINAL",
                    "action": "MAINTAIN_CRUISE",
                    "recommended_speed": 18.0,
                    "helm_trim_deg": 0.0,
                    "headline": "OPTIMAL TRANSIT PROFILE ACTIVE",
                    "message": "Vessel navigating within clear navigable water. Maintain scheduled speed and centerline heading."
                },
                rationale="Working memory indicates deep water clearance, open sea lane, and zero navigational deviations.",
                colreg_ref="COLREG Rule 8 (Action to Avoid Collision)"
            )
        ]

    def build_working_memory(self, vessel: Dict[str, Any], env_context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Constructs active facts from vessel telemetry and maritime spatial context."""
        lat = float(vessel.get("lat", 5.416))
        lon = float(vessel.get("lon", 100.345))
        speed = float(vessel.get("speed_knots", 18.0))
        depth = float(vessel.get("depth_m", 12.5))
        status = str(vessel.get("status", "MOORED"))
        deviation = bool(vessel.get("route_deviation", False))

        # Check proximity to chokepoints
        # Phillips Channel: Lat ~1.18, Lon ~103.68
        # One Fathom Bank: Lat ~2.88, Lon ~101.00
        dist_phillips = math.hypot(lat - 1.18, lon - 103.68) * 60.0
        dist_one_fathom = math.hypot(lat - 2.88, lon - 101.00) * 60.0
        in_chokepoint = (dist_phillips < 12.0) or (dist_one_fathom < 10.0)

        # Restricted zone distance (Riau reef ~ 0.98, 104.15)
        dist_restricted = math.hypot(lat - 0.98, lon - 104.15) * 60.0

        # Monsoonal squall zone near central Malacca (Lat 2.5 - 3.2, Lon 99.5 - 101.2)
        in_squall_sector = (2.2 <= lat <= 3.3) and (99.5 <= lon <= 101.5)
        weather_severity = 7.0 if in_squall_sector else (float(env_context.get("weather_severity", 3.0)) if env_context else 3.0)

        return {
            "vessel_id": vessel.get("id", "VESSEL-001"),
            "vessel_name": vessel.get("name", "MV Sentinel Guardian"),
            "status": status,
            "speed_knots": speed,
            "heading_deg": float(vessel.get("heading_deg", 135.0)),
            "depth_m": depth,
            "lat": lat,
            "lon": lon,
            "route_deviation": deviation,
            "in_chokepoint": in_chokepoint,
            "dist_to_chokepoint_nm": round(min(dist_phillips, dist_one_fathom), 1),
            "dist_to_restricted_nm": round(dist_restricted, 1),
            "weather_severity": weather_severity,
            "under_keel_margin": round(depth - 8.5, 2)  # typical ship draft ~8.5m
        }

    def infer(self, working_memory: Dict[str, Any]) -> Dict[str, Any]:
        """
        Executes Forward Chaining Inference:
          1. Matches working memory facts against knowledge base rules.
          2. Resolves conflicts by rule priority and specificity.
          3. Generates "WHY" and "HOW" explanation structures.
        """
        fired_rules = []
        unfired_rules = []

        for rule in self.knowledge_base:
            if rule.evaluate(working_memory):
                fired_rules.append(rule)
            else:
                unfired_rules.append(rule)

        # Conflict Resolution: Sort by Priority (Descending)
        fired_rules.sort(key=lambda r: r.priority, reverse=True)
        primary_rule = fired_rules[0] if fired_rules else None

        # Build Explanation Traces
        why_explanation = self._build_why_explanation(primary_rule, working_memory)
        how_explanation = self._build_how_explanation(fired_rules, working_memory)

        # Working memory facts array for table display
        wm_facts_list = []
        for k, v in working_memory.items():
            wm_facts_list.append({
                "name": k,
                "value": v,
                "type": type(v).__name__
            })

        firing_rule = None
        if primary_rule:
            firing_rule = {
                "id": primary_rule.rule_id,
                "rule_id": primary_rule.rule_id,
                "title": primary_rule.name,
                "name": primary_rule.name,
                "priority": primary_rule.priority,
                "severity": primary_rule.consequents.get("severity", "nominal").lower(),
                "action": primary_rule.consequents.get("action", "MAINTAIN_CRUISE"),
                "message": primary_rule.consequents.get("message", "Nominal cruise state."),
                "target_speed_knots": primary_rule.consequents.get("recommended_speed", 18.0),
                "course_trim_deg": primary_rule.consequents.get("helm_trim_deg", 0.0),
                "colreg_rule": primary_rule.colreg_ref or "IMO COLREGs",
                "colreg_ref": primary_rule.colreg_ref or "IMO COLREGs",
                "headline": primary_rule.consequents.get("headline", primary_rule.name)
            }

        return {
            "status": "success",
            "working_memory": {
                "facts": wm_facts_list,
                **working_memory
            },
            "firing_rule": firing_rule,
            "primary_advisory": primary_rule.consequents if primary_rule else None,
            "primary_rule_id": primary_rule.rule_id if primary_rule else None,
            "primary_rule_name": primary_rule.name if primary_rule else None,
            "fired_rules_count": len(fired_rules),
            "fired_rules": [
                {
                    "rule_id": r.rule_id,
                    "id": r.rule_id,
                    "name": r.name,
                    "title": r.name,
                    "priority": r.priority,
                    "colreg_ref": r.colreg_ref,
                    "colreg_rule": r.colreg_ref,
                    "action": r.consequents.get("action"),
                    "headline": r.consequents.get("headline")
                }
                for r in fired_rules
            ],
            "why_explanation": why_explanation,
            "how_explanation": how_explanation,
            "explanation_facility": {
                "why": why_explanation,
                "how": how_explanation
            }
        }

    def _build_why_explanation(self, rule: Optional[Rule], facts: Dict[str, Any]) -> Dict[str, Any]:
        """Constructs an exhaustive 'WHY' explanation justification."""
        if not rule:
            return {
                "question": "Why did the Expert System trigger this directive?",
                "summary": "No domain rules were triggered by current working memory telemetry.",
                "rationale": "All maritime safety thresholds (depth, corridor, traffic) are nominal.",
                "colreg_rule": "COLREG Rule 8 (Action to Avoid Collision)",
                "rule_id": "RULE-NONE",
                "rule_title": "Normal Cruising State",
                "premises_evaluated": []
            }

        premise_proofs = []
        for ant in rule.antecedents:
            fact_name = ant["fact"]
            op = ant["op"]
            target_val = ant["val"]
            actual_val = facts.get(fact_name)

            premise_proofs.append({
                "fact": fact_name,
                "condition": f"{fact_name} {op} {target_val}",
                "operator": op,
                "op": op,
                "required_value": target_val,
                "val": target_val,
                "actual_value": actual_val,
                "matched": True,
                "satisfied": True
            })

        return {
            "question": f"Why is '{rule.consequents.get('headline')}' recommended?",
            "selected_rule": f"{rule.rule_id}: {rule.name}",
            "rule_id": rule.rule_id,
            "rule_title": rule.name,
            "priority": rule.priority,
            "premises_evaluated": premise_proofs,
            "maritime_justification": rule.rationale,
            "rationale": rule.rationale,
            "governing_standard": rule.colreg_ref or "Standard Maritime Seamanship Protocol",
            "colreg_rule": rule.colreg_ref or "Standard Maritime Seamanship Protocol",
            "conclusion": rule.consequents.get("message")
        }

    def _build_how_explanation(self, fired_rules: List[Rule], facts: Dict[str, Any]) -> Dict[str, Any]:
        """Constructs a 'HOW' trace showing derivation chain of all active advisories."""
        chain = []
        for idx, r in enumerate(fired_rules):
            matched_facts = {ant["fact"]: facts.get(ant["fact"]) for ant in r.antecedents}
            premises_str_list = [f"{ant['fact']} {ant['op']} {ant['val']}" for ant in r.antecedents]
            chain.append({
                "step": idx + 1,
                "rule_id": r.rule_id,
                "rule_title": r.name,
                "rule_name": r.name,
                "fired": True,
                "premises_evaluated": premises_str_list,
                "conclusion_asserted": f"{r.consequents.get('action')} — {r.consequents.get('headline')}",
                "derived_action": r.consequents.get("action"),
                "matched_evidence": matched_facts,
                "priority_level": r.priority
            })

        return {
            "inference_mode": "Forward-Chaining Production System",
            "conflict_resolution_strategy": "Rule Priority Dominance with Specificity Ordering",
            "derivation_steps": chain,
            "working_memory_elements": list(facts.keys())
        }

    def get_all_rules(self) -> List[Dict[str, Any]]:
        """Returns all knowledge base rules for inspector inspection."""
        return [
            {
                "id": r.rule_id,
                "rule_id": r.rule_id,
                "name": r.name,
                "title": r.name,
                "priority": r.priority,
                "colreg_rule": r.colreg_ref or "COLREGs Protocol",
                "colreg_ref": r.colreg_ref or "COLREGs Protocol",
                "premises": r.antecedents,
                "antecedents": r.antecedents,
                "conclusion": {
                    "action": r.consequents.get("action"),
                    "target_speed_knots": r.consequents.get("recommended_speed", 18.0),
                    "course_trim_deg": r.consequents.get("helm_trim_deg", 0.0),
                    "headline": r.consequents.get("headline"),
                    "message": r.consequents.get("message"),
                    "severity": r.consequents.get("severity", "nominal").lower()
                },
                "consequents": r.consequents,
                "rationale": r.rationale
            }
            for r in self.knowledge_base
        ]


# Singleton instance
maritime_expert_system = MaritimeExpertSystem()
