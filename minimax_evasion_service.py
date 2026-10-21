"""
Adversarial Search: Minimax with Alpha-Beta Pruning (Unit 2: Adversarial Search)
-------------------------------------------------------------------------------
Implements:
  1. Tactical Maritime Pursuit-Evasion Grid Game:
     - MAX Player: Our Fleet Vessel (Evader) seeking safe extraction gateway.
     - MIN Player: Hostile Drone / Fast Patrol Interceptor (Pursuer).
  2. Recursive Minimax with Alpha-Beta (α-β) Pruning:
     - Tracks depth-limited tree expansion.
     - Counts nodes visited vs branches pruned by α-cutoff / β-cutoff.
     - Generates decision tree traces with evaluation scores.
  3. Interactive Turn-by-Turn state machine (Manual move or AI autoplay).
"""

from typing import List, Dict, Any, Tuple, Optional
import math


GRID_SIZE = 8

# Movement directions (dr, dc)
MOVES = {
    "N": (-1, 0),
    "S": (1, 0),
    "E": (0, 1),
    "W": (0, -1),
    "NE": (-1, 1),
    "NW": (-1, -1),
    "SE": (1, 1),
    "SW": (1, -1),
    "HOLD": (0, 0),
}


class MinimaxEvasionGame:
    def __init__(self):
        self.grid_size = GRID_SIZE
        self.reefs: List[Tuple[int, int]] = []
        self.gateway = (0, 7)  # Safe Gateway at top-right
        self.vessel_pos = (7, 0)  # Vessel starts at bottom-left
        self.adversary_pos = (3, 4)  # Interceptor patrolling mid-grid
        self.turn = "VESSEL"  # "VESSEL" (MAX) or "ADVERSARY" (MIN)
        self.game_over = False
        self.winner = None
        self.turn_count = 0
        self.history: List[Dict[str, Any]] = []

        self._reset_board()

    def _reset_board(self):
        """Initializes a challenging tactical sector with reefs and gateway."""
        self.vessel_pos = (7, 0)
        self.adversary_pos = (2, 5)
        self.gateway = (0, 7)
        self.turn = "VESSEL"
        self.game_over = False
        self.winner = None
        self.turn_count = 0
        self.history = []

        # Fixed strategic coral reef shoals
        self.reefs = [
            (2, 2), (2, 3), (3, 2),
            (4, 5), (5, 5), (5, 4),
            (1, 6), (6, 2)
        ]

    def is_valid_cell(self, r: int, c: int) -> bool:
        if 0 <= r < self.grid_size and 0 <= c < self.grid_size:
            return (r, c) not in self.reefs
        return False

    def get_legal_moves(self, pos: Tuple[int, int]) -> List[Tuple[str, Tuple[int, int]]]:
        """Returns valid legal moves from the given cell."""
        valid = []
        for name, (dr, dc) in MOVES.items():
            nr, nc = pos[0] + dr, pos[1] + dc
            if self.is_valid_cell(nr, nc):
                valid.append((name, (nr, nc)))
        return valid

    def evaluate_state(self, v_pos: Tuple[int, int], a_pos: Tuple[int, int]) -> float:
        """
        Heuristic Utility Evaluation Function:
        MAX (Vessel) wants:
          - High distance from adversary.
          - Low distance to gateway.
        """
        # Terminal checks
        if v_pos == self.gateway:
            return 10000.0  # Safe escape victory
        if v_pos == a_pos or math.hypot(v_pos[0] - a_pos[0], v_pos[1] - a_pos[1]) < 1.0:
            return -10000.0  # Captured defeat

        # Distance to gateway (Manhattan / Euclidean)
        dist_to_gateway = math.hypot(v_pos[0] - self.gateway[0], v_pos[1] - self.gateway[1])
        # Distance between vessel and adversary
        dist_to_adv = math.hypot(v_pos[0] - a_pos[0], v_pos[1] - a_pos[1])

        # Composite score
        score = (dist_to_adv * 45.0) - (dist_to_gateway * 30.0)
        return score

    def minimax_alpha_beta(
        self,
        v_pos: Tuple[int, int],
        a_pos: Tuple[int, int],
        depth: int,
        alpha: float,
        beta: float,
        is_maximizing: bool,
        stats: Dict[str, Any],
        tree_trace: Optional[List[Dict[str, Any]]] = None
    ) -> Tuple[float, Optional[str], Optional[Tuple[int, int]]]:
        """
        Classic Minimax with Alpha-Beta Pruning algorithm:
          - Alpha: Best value that MAX can guarantee so far.
          - Beta: Best value that MIN can guarantee so far.
          - Prunes branch when beta <= alpha.
        """
        stats["nodes_evaluated"] += 1

        # Check terminal state or depth limit
        if depth == 0 or v_pos == self.gateway or v_pos == a_pos:
            val = self.evaluate_state(v_pos, a_pos)
            return val, None, None

        if is_maximizing:
            max_eval = -float("inf")
            best_move = None
            best_dest = None

            legal_moves = self.get_legal_moves(v_pos)
            # Heuristic move ordering: moves closer to gateway first
            legal_moves.sort(
                key=lambda m: math.hypot(m[1][0] - self.gateway[0], m[1][1] - self.gateway[1])
            )

            for move_name, next_v_pos in legal_moves:
                child_trace = [] if tree_trace is not None and depth >= 2 else None
                eval_val, _, _ = self.minimax_alpha_beta(
                    next_v_pos, a_pos, depth - 1, alpha, beta, False, stats, child_trace
                )

                if tree_trace is not None and depth >= 2:
                    tree_trace.append({
                        "player": "MAX (Vessel)",
                        "move": move_name,
                        "action": move_name,
                        "dest": next_v_pos,
                        "eval": round(eval_val, 1),
                        "score": round(eval_val, 1),
                        "alpha": round(alpha, 1),
                        "beta": round(beta, 1),
                        "pruned": False,
                        "cutoff_type": "β-cutoff",
                        "children": child_trace
                    })

                if eval_val > max_eval:
                    max_eval = eval_val
                    best_move = move_name
                    best_dest = next_v_pos

                alpha = max(alpha, eval_val)
                if beta <= alpha:
                    stats["branches_pruned"] += 1
                    if tree_trace is not None and tree_trace:
                        tree_trace[-1]["pruned"] = True
                    break  # β cutoff

            return max_eval, best_move, best_dest

        else:
            min_eval = float("inf")
            best_move = None
            best_dest = None

            legal_moves = self.get_legal_moves(a_pos)
            # Heuristic move ordering: moves closer to vessel first
            legal_moves.sort(
                key=lambda m: math.hypot(m[1][0] - v_pos[0], m[1][1] - v_pos[1])
            )

            for move_name, next_a_pos in legal_moves:
                child_trace = [] if tree_trace is not None and depth >= 2 else None
                eval_val, _, _ = self.minimax_alpha_beta(
                    v_pos, next_a_pos, depth - 1, alpha, beta, True, stats, child_trace
                )

                if tree_trace is not None and depth >= 2:
                    tree_trace.append({
                        "player": "MIN (Adversary)",
                        "move": move_name,
                        "action": move_name,
                        "dest": next_a_pos,
                        "eval": round(eval_val, 1),
                        "score": round(eval_val, 1),
                        "alpha": round(alpha, 1),
                        "beta": round(beta, 1),
                        "pruned": False,
                        "cutoff_type": "α-cutoff",
                        "children": child_trace
                    })

                if eval_val < min_eval:
                    min_eval = eval_val
                    best_move = move_name
                    best_dest = next_a_pos

                beta = min(beta, eval_val)
                if beta <= alpha:
                    stats["branches_pruned"] += 1
                    if tree_trace is not None and tree_trace:
                        tree_trace[-1]["pruned"] = True
                    break  # α cutoff

            return min_eval, best_move, best_dest

    def get_state(self) -> Dict[str, Any]:
        """Returns the full game state representation for frontend rendering."""
        last_stats = getattr(self, "last_stats", {
            "nodes_evaluated": 0, "evaluated": 0,
            "branches_pruned": 0, "pruned": 0,
            "best_score": 0.0
        })
        last_tree = getattr(self, "last_tree_trace", [])
        return {
            "status": "success",
            "grid_size": self.grid_size,
            "vessel_pos": list(self.vessel_pos),
            "vessel": list(self.vessel_pos),
            "adversary_pos": list(self.adversary_pos),
            "adversary": list(self.adversary_pos),
            "gateway": list(self.gateway),
            "reefs": [list(r) for r in self.reefs],
            "turn": "MAX" if self.turn == "VESSEL" else "MIN",
            "player_turn": self.turn,
            "turn_count": self.turn_count,
            "game_over": self.game_over,
            "winner": self.winner,
            "result_message": self.winner or ("VESSEL REACHED SAFE GATEWAY!" if self.game_over and self.vessel_pos == self.gateway else "ACTIVE TACTICAL EVASION"),
            "distance_to_gateway": round(math.hypot(self.vessel_pos[0] - self.gateway[0], self.vessel_pos[1] - self.gateway[1]), 2),
            "distance_to_adversary": round(math.hypot(self.vessel_pos[0] - self.adversary_pos[0], self.vessel_pos[1] - self.adversary_pos[1]), 2),
            "stats": last_stats,
            "decision_tree": last_tree,
            "tree_trace": last_tree
        }

    def play_turn(self, action: Optional[str] = None, depth: int = 4) -> Dict[str, Any]:
        """
        Executes one turn of the game:
          - If turn == 'VESSEL':
              Can accept explicit user action (e.g. 'NE') or use Minimax to find best evasive move.
          - If turn == 'ADVERSARY':
              Uses Minimax (is_maximizing=False) to compute best intercept move.
        """
        if self.game_over:
            st = self.get_state()
            return {"status": "game_over", "state": st, **st}

        raw_stats = {"nodes_evaluated": 0, "branches_pruned": 0}
        tree_trace: List[Dict[str, Any]] = []

        if self.turn == "VESSEL":
            if action and action in MOVES:
                dr, dc = MOVES[action]
                next_r, next_c = self.vessel_pos[0] + dr, self.vessel_pos[1] + dc
                if self.is_valid_cell(next_r, next_c):
                    chosen_move = action
                    chosen_dest = (next_r, next_c)
                    eval_val = self.evaluate_state(chosen_dest, self.adversary_pos)
                    tree_trace.append({
                        "player": "MAX (Manual Helm)",
                        "move": chosen_move,
                        "action": chosen_move,
                        "dest": chosen_dest,
                        "eval": round(eval_val, 1),
                        "score": round(eval_val, 1),
                        "alpha": 0.0,
                        "beta": 0.0,
                        "pruned": False,
                        "is_best": True,
                        "cutoff_type": "Manual"
                    })
                else:
                    return {"status": "error", "message": "Move blocked by shoal or grid boundary.", "state": self.get_state()}
            else:
                # Use Minimax (MAX)
                eval_val, chosen_move, chosen_dest = self.minimax_alpha_beta(
                    self.vessel_pos, self.adversary_pos, depth=depth,
                    alpha=-float("inf"), beta=float("inf"), is_maximizing=True,
                    stats=raw_stats, tree_trace=tree_trace
                )

            if chosen_dest:
                self.vessel_pos = chosen_dest

            # Check win condition
            if self.vessel_pos == self.gateway:
                self.game_over = True
                self.winner = "VESSEL REACHED SAFE GATEWAY! (MISSION SUCCESS)"
            elif self.vessel_pos == self.adversary_pos or math.hypot(self.vessel_pos[0] - self.adversary_pos[0], self.vessel_pos[1] - self.adversary_pos[1]) <= 1.0:
                self.game_over = True
                self.winner = "VESSEL INTERCEPTED BY HOSTILE PATROL! (MISSION FAILED)"
            else:
                self.turn = "ADVERSARY"

            self.turn_count += 1

        else:
            # ADVERSARY Turn (MIN)
            eval_val, chosen_move, chosen_dest = self.minimax_alpha_beta(
                self.vessel_pos, self.adversary_pos, depth=depth,
                alpha=-float("inf"), beta=float("inf"), is_maximizing=False,
                stats=raw_stats, tree_trace=tree_trace
            )

            if chosen_dest:
                self.adversary_pos = chosen_dest

            # Check intercept condition
            if self.adversary_pos == self.vessel_pos or math.hypot(self.vessel_pos[0] - self.adversary_pos[0], self.vessel_pos[1] - self.adversary_pos[1]) <= 1.0:
                self.game_over = True
                self.winner = "VESSEL INTERCEPTED BY HOSTILE PATROL! (MISSION FAILED)"
            else:
                self.turn = "VESSEL"

            self.turn_count += 1

        # Tag optimal best move in tree
        for node in tree_trace:
            node["is_best"] = (node.get("move") == chosen_move)

        full_stats = {
            "nodes_evaluated": raw_stats["nodes_evaluated"],
            "evaluated": raw_stats["nodes_evaluated"],
            "branches_pruned": raw_stats["branches_pruned"],
            "pruned": raw_stats["branches_pruned"],
            "best_score": round(eval_val, 1) if eval_val is not None else 0.0
        }
        self.last_stats = full_stats
        self.last_tree_trace = tree_trace[:12]

        current_state = self.get_state()
        return {
            "status": "success",
            "player": "VESSEL" if self.turn == "ADVERSARY" else "ADVERSARY",
            "move_executed": chosen_move,
            "dest": list(chosen_dest) if chosen_dest else None,
            "minimax_eval": round(eval_val, 2) if eval_val is not None else 0.0,
            "stats": full_stats,
            "tree_trace": self.last_tree_trace,
            "decision_tree": self.last_tree_trace,
            "state": current_state,
            **current_state
        }

    def reset(self) -> Dict[str, Any]:
        self._reset_board()
        self.last_stats = {
            "nodes_evaluated": 0, "evaluated": 0,
            "branches_pruned": 0, "pruned": 0,
            "best_score": 0.0
        }
        self.last_tree_trace = []
        return self.get_state()


# Singleton instance
minimax_evasion_game = MinimaxEvasionGame()
