import type { AnalysisLine } from '$lib/chess/engine';
import { lossFor, type Side } from './judge';

export type ReplyChoice = { line: AnalysisLine; kind: 'natural' | 'mistake'; loss: number };

export type ReplyOptions = {
	/** Probability of deliberately playing a mistake when one is available. */
	mistakeRate: number;
	random: () => number;
};

// A natural reply stays within this many winning chances of the best move.
const NATURAL_SPREAD = 0.06;
// A planted mistake must be a real error with something concrete to find,
// but not a move so absurd that no one would play it.
const MISTAKE_MIN = 0.15;
const MISTAKE_MAX = 0.5;

function weightedPick<T>(items: { item: T; weight: number }[], random: () => number): T {
	const total = items.reduce((sum, i) => sum + i.weight, 0);
	let pick = random() * total;
	for (const { item, weight } of items) {
		pick -= weight;
		if (pick <= 0) return item;
	}
	return items.at(-1)!.item;
}

/**
 * Picks the computer's move from a multi-PV analysis. Usually a natural move —
 * any strong candidate, weighted toward the best — so play varies like a human
 * opponent's. Occasionally a deliberate mistake, for the learner to punish.
 */
export function chooseReply(lines: AnalysisLine[], mover: Side, { mistakeRate, random }: ReplyOptions): ReplyChoice {
	if (!lines.length) throw new Error('No candidate moves to choose from');
	const best = lines[0];
	const scored = lines.map((line) => ({ line, loss: lossFor(best, line.score, mover) }));

	const mistakes = scored.filter((s) => s.loss >= MISTAKE_MIN && s.loss <= MISTAKE_MAX);
	if (mistakes.length && random() < mistakeRate) {
		const { line, loss } = weightedPick(mistakes.map((s) => ({ item: s, weight: 1 })), random);
		return { line, kind: 'mistake', loss };
	}

	const natural = scored.filter((s) => s.loss <= NATURAL_SPREAD);
	const { line, loss } = weightedPick(
		natural.map((s) => ({ item: s, weight: (1 - s.loss / NATURAL_SPREAD) ** 2 + 0.1 })),
		random
	);
	return { line, kind: 'natural', loss };
}
