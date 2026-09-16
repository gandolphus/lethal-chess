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

// ── The human-shaped opponent of The Open ───────────────────────────────────────────────────────
//
// An engine plays the best move every time; a person plays a spread. Three flavours:
//   theory — a sound move, the kind a player who knows the opening plays;
//   middle — not too shabby, but against a grandmaster devastating: it survives ordinary play and
//            is only punished by precise play. The category the mode exists for;
//   junk   — a clearly bad move, though still one from the engine's own list, so it looks like a
//            move a person might make rather than a random legal one.

export type Flavour = 'theory' | 'middle' | 'junk';

export type HumanChoice = { line: AnalysisLine; kind: Flavour; loss: number };

/** Winning chances a move gives away for it to count as each flavour. */
export const FLAVOUR_BANDS: Record<Flavour, [number, number]> = {
	theory: [0, NATURAL_SPREAD],
	middle: [0.08, 0.3],
	junk: [0.3, Infinity]
};

// A person follows theory for a few moves and then improvises: theory decays with every move of the
// round, and the chance of something plainly bad creeps up as the position gets unfamiliar.
const THEORY_AT_START = 0.75;
const THEORY_DECAY = 0.8;
const JUNK_AT_START = 0.05;
const JUNK_PER_MOVE = 0.03;

/** The mix of flavours when the learner has played `move` moves of the round so far. */
export function humanMix(move: number): Record<Flavour, number> {
	const theory = THEORY_AT_START * THEORY_DECAY ** move;
	const junk = JUNK_AT_START + JUNK_PER_MOVE * move;
	return { theory, middle: 1 - theory - junk, junk };
}

export function drawFlavour(move: number, random: () => number): Flavour {
	const mix = humanMix(move);
	const pick = random();
	if (pick < mix.theory) return 'theory';
	if (pick < mix.theory + mix.middle) return 'middle';
	return 'junk';
}

/**
 * A move of one flavour from a multi-PV list, or null when the list holds none. Within a band the
 * lesser evil is favoured: the middle leans toward its sound end, and junk toward the mild blunder
 * over the hung queen — plausible-and-bad, never absurd for its own sake.
 */
export function pickFlavoured(lines: AnalysisLine[], mover: Side, flavour: Flavour, random: () => number): HumanChoice | null {
	if (!lines.length) return null;
	const best = lines[0];
	const [low, high] = FLAVOUR_BANDS[flavour];
	const inBand = lines
		.map((line) => ({ line, loss: lossFor(best, line.score, mover) }))
		.filter((s) => s.loss >= low && s.loss < high);
	if (!inBand.length) return null;
	const weight = (loss: number) => {
		if (flavour === 'theory') return (1 - loss / high) ** 2 + 0.1;
		if (flavour === 'middle') return 1 + (high - loss) / (high - low);
		return Math.max(0.05, (2.2 - Math.min(loss, 2)) ** 2);
	};
	const { line, loss } = weightedPick(
		inBand.map((s) => ({ item: s, weight: weight(s.loss) })),
		random
	);
	return { line, kind: flavour, loss };
}

/**
 * A human-shaped reply: draw a flavour for this point in the round, then a move of that flavour.
 * A flavour the list cannot supply falls down to the next milder one, so the choice is always one
 * of the lines given — never anything off the list, and never nothing.
 */
export function humanReply(
	lines: AnalysisLine[],
	mover: Side,
	{ move, random, flavour = drawFlavour(move, random) }: { move: number; random: () => number; flavour?: Flavour }
): HumanChoice {
	if (!lines.length) throw new Error('No candidate moves to choose from');
	const order: Flavour[] = flavour === 'junk' ? ['junk', 'middle', 'theory'] : flavour === 'middle' ? ['middle', 'theory'] : ['theory'];
	// The best line gives nothing away, so theory is never empty and the loop always returns.
	return order.reduce<HumanChoice | null>((found, next) => found ?? pickFlavoured(lines, mover, next, random), null)!;
}
