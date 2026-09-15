import type { AnalysisLine, EngineScore } from '$lib/chess/engine';

export type Side = 'w' | 'b';
export type Verdict = 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';

/**
 * Winning chances in [-1, 1] for `side`, from Lichess's logistic model. Judging by
 * the drop in winning chances rather than raw centipawns keeps verdicts sane in
 * lopsided positions: losing 150cp at +8 changes nothing, at 0.00 it matters.
 */
export function winChance(score: EngineScore, side: Side): number {
	const white =
		'mate' in score
			? Math.sign(score.mate)
			: 2 / (1 + Math.exp(-0.00368208 * Math.max(-1000, Math.min(1000, score.cp)))) - 1;
	return side === 'w' ? white : -white;
}

// Lichess's thresholds, on the same [-1, 1] scale.
const INACCURACY = 0.1;
const MISTAKE = 0.2;
const BLUNDER = 0.3;
const BEST_TOLERANCE = 0.02;

/** How much `side` gives up relative to the best line, in winning chances (≥ 0). */
export const lossFor = (best: AnalysisLine, played: EngineScore, side: Side) =>
	Math.max(0, winChance(best.score, side) - winChance(played, side));

export function verdictFor(loss: number, playedBest: boolean): Verdict {
	if (playedBest || loss < BEST_TOLERANCE) return 'best';
	if (loss < INACCURACY) return 'good';
	if (loss < MISTAKE) return 'inaccuracy';
	if (loss < BLUNDER) return 'mistake';
	return 'blunder';
}

export const isSound = (verdict: Verdict) => verdict === 'best' || verdict === 'good';
