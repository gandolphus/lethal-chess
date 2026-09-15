---
tags: [feature, planned, differentiator]
aliases: [Off-book Practice, Unusual Moves, Deviations]
---

# Off-book Practice

**Status: designed, first feature after [[Public MVP]] goes online.** Raised by the user 2026-09-15.

> "Practicing responding to moves which are unusual for the opening you're practicing. Many opening
> drilling tools only practice known lines. But in the wild you will encounter a very wide variety of
> moves. This is a huge blind spot."

This is a genuine differentiator: tools like Chessable drill the book and leave the learner stranded
the moment an opponent leaves it — which, below master level, is most games.

## Design sketch

The bundle format already supports it: nodes are keyed by position, and a learner node is just
"position + your move". Off-book practice adds **deviation nodes**.

1. **Deviations.** At each opponent-to-move node in the tree, take the legal opponent moves that are
   *not* drilled replies (~20–35 per position).
2. **Evaluate the punishment.** For each, look up the resulting position in the eval cache; if absent,
   evaluate with native [[Stockfish]] (multi-PV, depth ~20–24). The learner's move there is the
   engine's best, with the usual sound-alternative tolerance.
3. **Choose which deviations to drill.** Not all 30 — prioritise:
   - **Natural-looking** moves an opponent plausibly plays: engine-liked at low depth, developing
     moves, captures, checks. Without rating data, "natural" is approximated by shallow-search
     preference ([[Opening Classification]] uses the same signal for traps).
   - **Punishable** moves — a large eval swing means there is something concrete to learn.
4. **Drill.** The session plays a deviation at an opponent node with a set probability (e.g. 15–20%),
   steered like replies by what needs practice. Grading is unchanged ([[Opening Drills]]).
5. **After the punishment:** the line ends, or continues a few plies with engine play so the learner
   converts, not just spots, the advantage.

## Open questions

- **Size.** ~118 opponent nodes × several deviations × a few plies each; likely several hundred KB to
  a couple MB per bundle before compression. Restrict to early plies (≤ 12) first.
- **Native Stockfish fallback** does not exist in the pipeline yet — the eval cache covers catalog
  lines at 99.5%, but off-book positions will miss far more often.
- **Proficiency** should report off-book readiness separately from book knowledge — they are
  different skills.
