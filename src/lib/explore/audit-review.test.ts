import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { winChance } from '$lib/coach/judge';
import type { BookLine, Bundle, BundleNode } from '$lib/drill/bundle';
import { toEpd } from '$lib/drill/tree';
import { Book } from './book';
import { learnerPlies } from './mastery';
import { ReviewSession } from './review.svelte';

// Correctness audit 2026-09-16: ReviewSession's "good too, but this line goes another way" verdict.
// `it.fails` marks the tests that fail against the current code.

const epdAfter = (...moves: string[]) => {
	const chess = new Chess();
	for (const m of moves) chess.move({ from: m.slice(0, 2), to: m.slice(2, 4) });
	return toEpd(chess.fen());
};

const OPENING = ['e2e4', 'e7e5'];
const lines: BookLine[] = [
	{ name: 'Test: Knight, Spanish', variation: 'Test: Knight', moves: [...OPENING, 'g1f3', 'b8c6', 'f1b5', 'a7a6'], entry: 3, entryName: 'Test: Knight', dubious: false },
	{ name: 'Test: Queen', variation: 'Test: Queen', moves: [...OPENING, 'd1h5'], entry: 3, dubious: true }
];

function fixture(): Bundle {
	const node = (moves: string[], candidates: [string, number][]): BundleNode => ({
		epd: epdAfter(...moves),
		ply: moves.length,
		depth: 30,
		candidates: candidates.map(([uci, cp]) => ({ uci, san: uci, score: { cp } })),
		line: []
	});
	// Qh5 loses 0.2+ win chance here: the coach's "mistake", and what makes the Queen line dubious.
	const nodes = [node(OPENING, [['g1f3', 40], ['b1c3', 35], ['f1c4', 30], ['d1h5', -160]])];
	return {
		id: 'fixture',
		name: 'Fixture',
		side: 'w',
		rootMoves: [],
		openingMoves: OPENING,
		rootEpd: epdAfter(),
		nodes: Object.fromEntries(nodes.map((n) => [n.epd, n])),
		lines,
		tolerances: { soundCp: 35, replyCp: 60 },
		stats: { learnerNodes: 0, opponentNodes: 0, maxPly: 0, missingEvals: 0 },
		source: { evalCacheRecords: 0, builtAt: '' }
	};
}

describe('ReviewSession and the dubious book move', () => {
	/**
	 * `#isSound` returns true for *any* book move (`book.isBookMove`), including the losing move that
	 * makes a dubious line dubious. Explore calls that move "An established move, but a dubious one";
	 * Practice calls it "good too" and rates the line Hard instead of Again. A mistake is taught as a
	 * sound alternative.
	 */
	it.fails('does not call the dubious line’s losing move "good too"', async () => {
		const bundle = fixture();
		const book = new Book(bundle);
		const spanish = book.lines[0];
		const session = new ReviewSession({ bundle, book, line: spanish, random: () => 0, wait: async () => {} });
		await session.start();
		expect(session.expected).toBe('g1f3');
		expect(await session.submit('d1', 'h5')).toBe(false);
		expect(session.message?.text).not.toMatch(/good too/);
		expect(session.message?.tone).toBe('fail');
	});
});

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'static', 'openings', 'repertoires');
const index: { id: string }[] = JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8'));

describe('shipped bundles: learner positions where a book move is a coach mistake', () => {
	/**
	 * Counts, over every shipped bundle, the (sound line, learner ply) pairs where another book
	 * continuation from that position loses ≥ 0.2 win chance by the bundle's own node — a move Practice
	 * would grade "good too". The names are printed so the owner can see which lines are affected.
	 */
	it.fails('has none', () => {
		const hits: string[] = [];
		for (const { id } of index) {
			const bundle: Bundle = JSON.parse(readFileSync(join(dir, `${id}.json`), 'utf8'));
			const book = new Book(bundle);
			const opening = (bundle.openingMoves ?? bundle.rootMoves).length;
			const seen = new Set<string>();
			for (const line of book.lines) {
				if (line.dubious) continue;
				for (const ply of learnerPlies(line, opening, bundle.side)) {
					const epd = line.epds[ply];
					const node = bundle.nodes[epd];
					const best = node?.candidates[0];
					if (!best) continue;
					for (const { uci, lines } of book.continuations(epd)) {
						if (uci === line.moves[ply] || seen.has(`${epd}|${uci}`)) continue;
						const played = node.candidates.find((c) => c.uci === uci);
						if (!played) continue;
						const loss = winChance(best.score, bundle.side) - winChance(played.score, bundle.side);
						if (loss >= 0.2) {
							seen.add(`${epd}|${uci}`);
							hits.push(`${id}: ${line.name} ply ${ply}: ${uci} (loss ${loss.toFixed(2)}) leads to ${lines.map((l) => l.name).join(' / ')}`);
						}
					}
				}
			}
		}
		console.info(hits.join('\n'));
		expect(hits).toEqual([]);
	});
});
