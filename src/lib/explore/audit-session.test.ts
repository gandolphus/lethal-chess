/**
 * Correctness audit, 2026-09-16: ExploreSession state. Every test here fails against the code as audited
 * and is marked `.fails`; turn each into a plain `it` when its defect is fixed.
 */
import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import type { Analysis } from '$lib/chess/engine';
import type { BookLine, Bundle, BundleNode } from '$lib/drill/bundle';
import { toEpd } from '$lib/drill/tree';
import { Book } from './book';
import { ExploreSession } from './session.svelte';

const epdAfter = (...moves: string[]) => {
	const chess = new Chess();
	for (const m of moves) chess.move({ from: m.slice(0, 2), to: m.slice(2, 4) });
	return toEpd(chess.fen());
};

const cand = (uci: string, san: string, cp: number) => ({ uci, san, score: { cp } });
const node = (moves: string[], candidates: BundleNode['candidates'], name?: string): BundleNode => ({
	epd: epdAfter(...moves),
	ply: moves.length,
	depth: 30,
	candidates,
	line: [],
	...(name ? { name } : {})
});

const OPENING = ['e2e4', 'e7e5'];
const lines: BookLine[] = [
	{ name: 'Test: Knight, Spanish', variation: 'Test: Knight', moves: [...OPENING, 'g1f3', 'b8c6', 'f1b5', 'a7a6'], entry: 3, entryName: 'Test: Knight', dubious: false },
	{ name: 'Test: Knight, Petrov', variation: 'Test: Knight', moves: [...OPENING, 'g1f3', 'g8f6'], entry: 3, entryName: 'Test: Knight', dubious: false },
	{ name: 'Test: Bishop', variation: 'Test: Bishop', moves: [...OPENING, 'f1c4'], entry: 3, dubious: false }
];

function fixture(): Bundle {
	const nodes = [
		node([], [cand('e2e4', 'e4', 30)]),
		node(['e2e4'], [cand('e7e5', 'e5', 30)]),
		node(OPENING, [cand('g1f3', 'Nf3', 40), cand('f1c4', 'Bc4', 30), cand('b1c3', 'Nc3', 25)]),
		node([...OPENING, 'g1f3'], [cand('b8c6', 'Nc6', 40), cand('g8f6', 'Nf6', 45)], 'Test: Knight'),
		node([...OPENING, 'g1f3', 'b8c6'], [cand('f1b5', 'Bb5', 40), cand('f1c4', 'Bc4', 35)]),
		node([...OPENING, 'g1f3', 'b8c6', 'f1b5'], [cand('a7a6', 'a6', 40)])
	];
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

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** An engine whose answer for one position can be held back and released later. */
function holdableEngine(table: Record<string, number> = {}) {
	let held: { fen: string; release: () => void } | null = null;
	const engine = {
		hold: (fen: string) => new Promise<void>((armed) => {
			held = { fen, release: () => {} };
			armed();
		}),
		release: () => held?.release(),
		analyse: async (fen: string): Promise<Analysis> => {
			if (held && held.fen === fen) await new Promise<void>((resolve) => (held!.release = resolve));
			const [first] = new Chess(fen).moves({ verbose: true });
			const cp = table[toEpd(fen)] ?? 0;
			return { fen, lines: first ? [{ move: `${first.from}${first.to}`, score: { cp }, pv: [], depth: 12 }] : [] };
		}
	};
	return engine;
}

function session(opts: { engine?: ReturnType<typeof holdableEngine>; roundMoves?: number } = {}) {
	const bundle = fixture();
	const engine = opts.engine ?? holdableEngine();
	const s = new ExploreSession({
		bundle,
		book: new Book(bundle),
		stages: new Map(),
		engine: async () => engine,
		random: () => 0,
		wait: async () => {},
		mistakeRate: 0,
		roundMoves: opts.roundMoves
	});
	return { s, engine };
}

describe('explain()', () => {
	it.fails('an explanation that arrives after the learner has moved on is dropped', async () => {
		// 3.a3 is off the book and, per this engine, loses 3 pawns: a blunder, so "Why?" is offered.
		const afterA3 = epdAfter(...OPENING, 'a2a3');
		const engine = holdableEngine({ [afterA3]: -300 });
		const { s } = session({ engine });
		await s.start();
		await s.submit('e2', 'e4');
		await s.submit('a2', 'a3');
		expect(s.phase).toBe('your-move');
		expect(s.canExplain).toBe(true);
		const mistakeFen = `${afterA3} 0 2`;

		// The learner presses Why?, and while the engine is still thinking about it, plays on.
		await engine.hold(mistakeFen);
		const asked = s.explain();
		await flush();
		expect(s.explanation).toBeNull();
		const [next] = new Chess(s.game.fen).moves({ verbose: true });
		await s.submit(next.from, next.to);
		expect(s.phase).toBe('your-move');
		engine.release();
		await asked;

		// The answer is about a position two moves back. `submit` does not bump the generation, so it lands.
		expect(s.explanation).toBeNull();
	});
});

describe('a finished round', () => {
	it.fails('cannot be played on from the tip', async () => {
		const { s } = session({ roundMoves: 1 });
		await s.start();
		expect(s.game.uciHistory).toEqual(OPENING);
		await s.submit('g1', 'f3');
		expect(s.phase).toBe('over');
		expect(s.round?.moves.length).toBe(1);
		expect(s.canTakeBack).toBe(false);

		// ← then → returns to the tip, which hands play back: the computer answers, and the learner's next
		// move is tallied as a ninth decision of an eight-move round.
		s.back();
		expect(s.phase).toBe('browse');
		s.forward();
		await flush();
		if (s.phase === 'your-move') await s.submit('d2', 'd4');
		expect(s.round?.moves.length).toBe(1);
		expect(s.phase).toBe('over');
	});
});
