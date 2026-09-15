import { scoreFor, type BundleNode, type Candidate, type Side } from './bundle';

export type Grade =
	/** The repertoire move. */
	| { kind: 'pass'; played: Candidate }
	/** Sound — within tolerance of the engine's best — but not the repertoire move. */
	| { kind: 'soft'; played: Candidate; expected: Candidate; costCp: number }
	/**
	 * Not sound. `costCp` is exact when the move was among the engine's candidates;
	 * otherwise null, and `atLeastCp` is a lower bound (it is worse than every candidate).
	 */
	| { kind: 'fail'; played: Candidate | null; expected: Candidate; costCp: number | null; atLeastCp: number };

/**
 * Grades a learner move at a learner-to-move node. Tolerance is measured from the
 * engine's best move, not from the repertoire move: when the repertoire prefers
 * theory that is slightly worse than best, playing the engine's best is still sound.
 */
export function gradeMove(node: BundleNode, uci: string, soundCp: number): Grade {
	const expected = node.move;
	if (!expected) throw new Error(`Not a learner node: ${node.epd}`);
	const side = node.epd.split(' ')[1] as Side;

	if (uci === expected.uci) return { kind: 'pass', played: expected };

	const best = scoreFor(node.candidates[0].score, side);
	const played = node.candidates.find((c) => c.uci === uci) ?? null;
	if (played) {
		const costCp = best - scoreFor(played.score, side);
		if (costCp <= soundCp) return { kind: 'soft', played, expected, costCp };
		return { kind: 'fail', played, expected, costCp, atLeastCp: costCp };
	}

	const worst = scoreFor(node.candidates.at(-1)!.score, side);
	return { kind: 'fail', played: null, expected, costCp: null, atLeastCp: best - worst };
}
