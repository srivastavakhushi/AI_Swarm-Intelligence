from app.main import (
    get_expert_system_rules,
    evaluate_expert_system,
    ExpertEvaluateBody,
    get_ga_waypoints,
    run_genetic_algorithm,
    GeneticAlgorithmBody,
)

def test_all():
    print("--- 1. Testing Option 7: Rule-Based Maritime Expert System (Unit 6) ---")
    rules_resp = get_expert_system_rules()
    assert rules_resp["status"] == "success"
    rules = rules_resp["rules"]
    print(f"Expert System: {len(rules)} production rules loaded in Knowledge Base.")
    assert len(rules) >= 6
    for r in rules:
        assert "rule_id" in r and "antecedents" in r and "consequents" in r
        print(f"  • [{r['rule_id']}] {r['name']} (Priority: {r['priority']})")

    # Evaluate default vessel
    eval_resp = evaluate_expert_system(ExpertEvaluateBody(vessel_id="VESSEL-001"))
    assert eval_resp["status"] == "success"
    print(f"Inference Engine: Primary Advisory Fired = {eval_resp['firing_rule']['action']} ({eval_resp['firing_rule']['headline']})")
    assert "why_explanation" in eval_resp
    assert "how_explanation" in eval_resp
    print(f"Explanation Facility (WHY): {eval_resp['why_explanation']['question']}")
    print(f"Explanation Facility (HOW): Derivation steps = {len(eval_resp['how_explanation']['derivation_steps'])}")

    # What-If Shallow Water test
    sandbox_eval = evaluate_expert_system(ExpertEvaluateBody(
        vessel_id="VESSEL-001",
        custom_facts={"depth_m": 9.5, "speed_knots": 15.0}
    ))
    assert sandbox_eval["firing_rule"]["action"] == "THROTTLE_BACK_SLOW"
    print(f"What-If Shallow Water (<11m): Successfully triggered {sandbox_eval['firing_rule']['id']}: {sandbox_eval['firing_rule']['action']}")

    print("\n--- 2. Testing Option 1: Genetic Algorithm (GA) Fleet Patrol (Unit 2) ---")
    wp_resp = get_ga_waypoints()
    assert wp_resp["status"] == "success"
    print(f"GA Waypoints: {len(wp_resp['waypoints'])} strategic Malacca stations loaded.")

    ga_body = GeneticAlgorithmBody(pop_size=30, generations=25, crossover_rate=0.85, mutation_rate=0.25)
    ga_resp = run_genetic_algorithm(ga_body)
    assert ga_resp["status"] == "success"
    print(f"GA Evolution: Optimal Tour Distance = {ga_resp['total_distance_nm']} NM, Fitness = {ga_resp['best_fitness']}")
    print(f"GA Evolved Chromosome: {len(ga_resp['best_tour'])} waypoints in closed patrol cycle.")
    print(f"GA Convergence History: {len(ga_resp['evolution_history'])} generations logged for Live Chart.")
    assert len(ga_resp["best_tour"]) > 3
    assert len(ga_resp["evolution_history"]) > 0

    print("\n" + "=" * 65)
    print("AI SYLLABUS TOPICS VERIFIED AND FULLY OPERATIONAL!")
    print("=" * 65)

if __name__ == "__main__":
    test_all()
