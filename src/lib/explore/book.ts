import { Chess } from 'chess.js';
import type { BookLine, Bundle } from '$lib/drill/bundle';
import { toEpd } from '$lib/drill/tree';

export type LineStage = 'entered' | 'discovered';

/** A line's progress for one learner. `line` is the line's key: the EPD of its end. */
export type Discovery = { bundleId: string; line: string; stage: LineStage; at: string };

export type IndexedLine = BookLine & {
	key: string;
	/** Positions along the line: epds[i] is the position after i moves. */
	epds: string[];
};

/** Where a position sits on a line: `index` moves in. */
export type LinePosition = { line: IndexedLine; index: number };

/**
 * Position-keyed view of a bundle's established lines: which lines pass through a
 * position, and which book moves continue from it. Transpositions share positions,
 * so a line counts as reached whatever the move order.
 */
export class Book {
	readonly lines: IndexedLine[];
	#at = new Map<string, LinePosition[]>();
	#next = new Map<string, Map<string, Set<IndexedLine>>>();

	constructor(bundle: Pick<Bundle, 'lines'>) {
		this.lines = (bundle.lines ?? []).map((line) => {
			const chess = new Chess();
			const epds = [toEpd(chess.fen())];
			for (const uci of line.moves) {
				chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
				epds.push(toEpd(chess.fen()));
			}
			return { ...line, key: epds.at(-1)!, epds };
		});

		for (const line of this.lines) {
			line.epds.forEach((epd, index) => {
				const here = this.#at.get(epd) ?? [];
				here.push({ line, index });
				this.#at.set(epd, here);
				if (index === line.moves.length) return;
				const next = this.#next.get(epd) ?? new Map<string, Set<IndexedLine>>();
				const through = next.get(line.moves[index]) ?? new Set<IndexedLine>();
				through.add(line);
				next.set(line.moves[index], through);
				this.#next.set(epd, next);
			});
		}
	}

	at(epd: string): LinePosition[] {
		return this.#at.get(epd) ?? [];
	}

	/** Book moves from a position, each with the lines it keeps open. */
	continuations(epd: string): { uci: string; lines: IndexedLine[] }[] {
		return [...(this.#next.get(epd) ?? [])].map(([uci, lines]) => ({ uci, lines: [...lines] }));
	}

	isBookMove(epd: string, uci: string): boolean {
		return this.#next.get(epd)?.has(uci) ?? false;
	}
}

/** The furthest stage reached per line key. */
export function stagesOf(discoveries: Discovery[]): Map<string, LineStage> {
	const stages = new Map<string, LineStage>();
	for (const d of discoveries) if (stages.get(d.line) !== 'discovered') stages.set(d.line, d.stage);
	return stages;
}

export type Tally = { total: number; discovered: number; entered: number };

export type VariationSummary = Tally & {
	name: string;
	/** Lines the learner has reached, with how far; lines not yet reached stay secret. */
	found: { line: IndexedLine; stage: LineStage }[];
};

export type DiscoverySummary = { sound: Tally; dubious: VariationSummary; variations: VariationSummary[] };

const emptyTally = (): Tally => ({ total: 0, discovered: 0, entered: 0 });

/** Counts for the opening page. `entered` excludes lines already discovered. Dubious lines are counted apart. */
export function summarize(book: Book, stages: Map<string, LineStage>): DiscoverySummary {
	const sound = emptyTally();
	const dubious: VariationSummary = { name: 'Dubious lines', found: [], ...emptyTally() };
	const variations = new Map<string, VariationSummary>();

	for (const line of book.lines) {
		const stage = stages.get(line.key);
		const tallies: Tally[] = [];
		if (line.dubious) {
			tallies.push(dubious);
			if (stage) dubious.found.push({ line, stage });
		} else {
			const variation = variations.get(line.variation) ?? { name: line.variation, found: [], ...emptyTally() };
			variations.set(line.variation, variation);
			tallies.push(sound, variation);
			if (stage) variation.found.push({ line, stage });
		}
		for (const tally of tallies) {
			tally.total++;
			if (stage === 'discovered') tally.discovered++;
			else if (stage === 'entered') tally.entered++;
		}
	}
	return { sound, dubious, variations: [...variations.values()] };
}
