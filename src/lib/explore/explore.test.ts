import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import type { Analysis } from '$lib/chess/engine';
import type { BookLine, Bundle, BundleNode } from '$lib/drill/bundle';
import { toEpd } from '$lib/drill/tree';
import { Book, stagesOf, summarize, type Discovery, type LineStage } from './book';
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
	{ name: 'Test: Bishop', variation: 'Test: Bishop', moves: [...OPENING, 'f1c4'], entry: 3, dubious: false },
	{ name: 'Test: Queen', variation: 'Test: Queen', moves: [...OPENING, 'd1h5'], entry: 3, dubious: true }
];

function fixture(): Bundle {
	const nodes = [
		node([], [cand('e2e4', 'e4', 30)]),
		node(['e2e4'], [cand('e7e5', 'e5', 30)]),
		node(OPENING, [cand('g1f3', 'Nf3', 40), cand('f1c4', 'Bc4', 30), cand('b1c3', 'Nc3', 25), cand('d1h5', 'Qh5', -40)]),
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

/** An engine that knows a few positions and otherwise suggests the first legal move at equality. */
function fakeEngine(table: Record<string, Analysis['lines']> = {}) {
	const calls: string[] = [];
	return {
		calls,
		analyse: async (fen: string): Promise<Analysis> => {
			calls.push(fen);
			const known = table[toEpd(fen)];
			if (known) return { fen, lines: known };
			const [first] = new Chess(fen).moves({ verbose: true });
			return { fen, lines: first ? [{ move: `${first.from}${first.to}`, score: { cp: 0 }, pv: [], depth: 12 }] : [] };
		}
	};
}

function session(opts: { stages?: Map<string, LineStage>; random?: () => number; engine?: ReturnType<typeof fakeEngine> } = {}) {
	const bundle = fixture();
	const discoveries: Discovery[] = [];
	const engine = opts.engine ?? fakeEngine();
	const s = new ExploreSession({
		bundle,
		book: new Book(bundle),
		stages: opts.stages ?? new Map(),
		engine: async () => engine,
		onDiscovery: (d) => discoveries.push(d),
		random: opts.random ?? (() => 0),
		wait: async () => {},
		mistakeRate: 0
	});
	return { s, discoveries, engine, book: new Book(bundle) };
}

async function started(opts: Parameters<typeof session>[0] = {}) {
	const ctx = session(opts);
	await ctx.s.start();
	await ctx.s.submit('e2', 'e4');
	return ctx;
}

describe('Book', () => {
	const book = new Book(fixture());

	it('keys lines by their end position and indexes every position along them', () => {
		expect(book.lines[1].key).toBe(epdAfter(...OPENING, 'g1f3', 'g8f6'));
		expect(book.at(epdAfter(...OPENING, 'g1f3')).map(({ line, index }) => [line.name, index])).toEqual([
			['Test: Knight, Spanish', 3],
			['Test: Knight, Petrov', 3]
		]);
	});

	it('lists book continuations with the lines each keeps open', () => {
		const next = book.continuations(epdAfter(...OPENING));
		expect(next.map((c) => [c.uci, c.lines.length])).toEqual([
			['g1f3', 2],
			['f1c4', 1],
			['d1h5', 1]
		]);
		expect(book.isBookMove(epdAfter(...OPENING), 'b1c3')).toBe(false);
	});

	it('summarises sound lines by variation and dubious lines apart', () => {
		const stages = stagesOf([
			{ bundleId: 'fixture', line: book.lines[0].key, stage: 'entered', at: '2026-09-15T10:00:00.000Z' },
			{ bundleId: 'fixture', line: book.lines[0].key, stage: 'discovered', at: '2026-09-15T10:01:00.000Z' },
			{ bundleId: 'fixture', line: book.lines[1].key, stage: 'entered', at: '2026-09-15T10:00:00.000Z' }
		]);
		const summary = summarize(book, stages);
		expect(summary.sound).toEqual({ total: 3, discovered: 1, entered: 1 });
		expect(summary.dubious).toMatchObject({ total: 1, discovered: 0, entered: 0 });
		expect(summary.variations.map((v) => [v.name, v.total, v.discovered, v.entered])).toEqual([
			['Test: Knight', 2, 1, 1],
			['Test: Bishop', 1, 0, 0]
		]);
	});
});

describe('ExploreSession', () => {
	it('insists on the opening’s defining moves, showing the right one', async () => {
		const { s } = session();
		await s.start();
		expect(s.phase).toBe('your-move');
		expect(await s.submit('d2', 'd4')).toBeNull();
		expect(s.game.history).toEqual([]);
		expect(s.arrows).toEqual([{ from: 'e2', to: 'e4', kind: 'hint' }]);

		await s.submit('e2', 'e4');
		expect(s.game.history).toEqual(['e4', 'e5']);
		expect(s.inOpening).toBe(false);
		expect(s.phase).toBe('your-move');
	});

	it('reports entering lines, then discovering one when its end is reached — by either side’s move', async () => {
		const { s, discoveries } = await started();
		await s.submit('g1', 'f3');
		// Both Knight lines are entered at once; the computer answers from the book (Nc6 with random 0).
		expect(discoveries.map((d) => d.stage)).toEqual(['entered', 'entered']);
		expect(s.events.at(-1)).toMatchObject({ kind: 'entered' });
		expect(s.game.history.at(-1)).toBe('Nc6');
		expect(s.following?.name).toBe('Test: Knight, Spanish');

		await s.submit('f1', 'b5');
		expect(s.game.history.at(-1)).toBe('a6');
		expect(discoveries.at(-1)).toMatchObject({ stage: 'discovered', line: epdAfter(...OPENING, 'g1f3', 'b8c6', 'f1b5', 'a7a6') });
		expect(s.events.at(-1)).toMatchObject({ kind: 'discovered', assisted: false });
	});

	it('anticipates an entered line with its progress, until either side reaches the end', async () => {
		const { s } = await started();
		expect(s.progress).toBeNull();
		await s.submit('g1', 'f3');
		// After 3.Nf3 Nc6 the nearest open line is the Spanish: entered at ply 3, ends at ply 6, 1 of 3 half-moves played.
		expect(s.progress).toEqual({ name: 'Test: Knight', lines: 1, allKnown: false, total: 3, played: 1 });
		await s.submit('f1', 'b5');
		// The computer's ...a6 ended it: celebrated, nothing left to anticipate.
		expect(s.progress).toBeNull();
		expect(s.events.at(-1)).toMatchObject({ kind: 'discovered', known: false, ply: 6 });
	});

	it('counts every line still reachable, not just the ones already entered', async () => {
		// The report: "2 lines left from here" and then "5" a move later. The count was gated on the
		// entrance being passed, so it climbed as the game went deeper. It is the lines running through
		// this position now, which can only shrink.
		const bundle = fixture();
		bundle.lines = [
			...lines,
			// A line under the same variation whose entrance is two moves deeper than the Spanish's.
			{ name: 'Test: Knight, Deep', variation: 'Test: Knight', moves: [...OPENING, 'g1f3', 'b8c6', 'f1b5', 'g8f6'], entry: 5, entryName: 'Test: Knight, Deep', dubious: false }
		];
		const s = new ExploreSession({
			bundle,
			book: new Book(bundle),
			stages: new Map(),
			engine: async () => fakeEngine(),
			onDiscovery: () => {},
			random: () => 0,
			wait: async () => {},
			mistakeRate: 0
		});
		await s.start();
		await s.submit('e2', 'e4');
		const counts: number[] = [];
		await s.submit('g1', 'f3');
		counts.push(s.progress!.lines);
		await s.submit('f1', 'b5');
		if (s.progress) counts.push(s.progress.lines);
		// Both the Spanish and the Deep line run through the position after 3.Nf3 Nc6.
		expect(counts[0]).toBe(2);
		expect(counts).toEqual([...counts].sort((a, b) => b - a));
	});

	it('celebrates completing an already discovered line again, without recording it', async () => {
		const bishop = new Book(fixture()).lines[2].key;
		const { s, discoveries } = await started({ stages: new Map([[bishop, 'discovered']]) });
		await s.submit('f1', 'c4');
		expect(s.events.at(-1)).toMatchObject({ kind: 'discovered', known: true });
		expect(discoveries).toEqual([]);
	});

	it('discovers a line with no entrance the moment its end is reached', async () => {
		const { s, discoveries } = await started();
		await s.submit('f1', 'c4');
		expect(discoveries).toEqual([expect.objectContaining({ stage: 'discovered', line: epdAfter(...OPENING, 'f1c4') })]);
	});

	it('steers book replies toward lines not yet discovered', async () => {
		const spanish = new Book(fixture()).lines[0].key;
		// Weights: Nc6 keeps only the discovered Spanish open (0.2), Nf6 the undiscovered Petrov (1).
		const { s } = await started({ stages: new Map([[spanish, 'discovered']]), random: () => 0.5 });
		await s.submit('g1', 'f3');
		expect(s.game.history.at(-1)).toBe('Nf6');
	});

	it('keeps play going after a good move off the book, and says it left the lines', async () => {
		const { s } = await started();
		await s.submit('b1', 'c3');
		expect(s.message?.text).toContain('leaves the established lines');
		expect(s.game.history).toHaveLength(4);
		expect(s.phase).toBe('your-move');
	});

	it('plays on after an ordinary mistake, keeping the move and answering it', async () => {
		const engine = fakeEngine({ [epdAfter(...OPENING, 'f2f3')]: [{ move: 'd8h4', score: { cp: -250 }, pv: [], depth: 20 }] });
		const { s } = await started({ engine });
		await s.submit('f2', 'f3');
		expect(s.phase).toBe('your-move');
		expect(s.game.history).toEqual(['e4', 'e5', 'f3', 'Qh4+']);
		expect(s.message?.tone).toBe('bad');
		expect(s.canTakeBack).toBe(true);
	});

	it('rewinds a missed punishment once and names it, then plays on', async () => {
		const engine = fakeEngine({ [epdAfter(...OPENING, 'f2f3')]: [{ move: 'd8h4', score: { cp: -250 }, pv: [], depth: 20 }] });
		const { s } = await started({ engine });
		s.opportunity = { san: 'g4' };
		await s.submit('f2', 'f3');
		// The move comes back rather than the game stopping, and the chance is named.
		expect(s.phase).toBe('your-move');
		expect(s.game.history).toEqual(['e4', 'e5']);
		expect(s.message?.text).toContain('punish g4');

		// A second miss plays on: it is a game, not an exam.
		s.opportunity = { san: 'g4' };
		await s.submit('f2', 'f3');
		expect(s.game.history).toEqual(['e4', 'e5', 'f3', 'Qh4+']);
	});

	it('explains what a mistake allowed, after play has moved past it', async () => {
		const engine = fakeEngine({ [epdAfter(...OPENING, 'f2f3')]: [{ move: 'd8h4', score: { cp: -250 }, pv: ['d8h4', 'g2g3'], depth: 20 }] });
		const { s } = await started({ engine });
		await s.submit('f2', 'f3');
		expect(s.canExplain).toBe(true);
		await s.explain();
		expect(s.explanation).toMatchObject({ san: 'Qh4+', line: ['Qh4+', 'g3'] });
		expect(s.canExplain).toBe(false);
	});

	it('lets an established but dubious move through, and counts the dubious line', async () => {
		const { s, discoveries } = await started();
		await s.submit('d1', 'h5');
		expect(s.phase).not.toBe('decide');
		expect(s.message?.text).toContain('dubious');
		expect(discoveries.at(-1)).toMatchObject({ stage: 'discovered' });
	});

	it('hints the piece, then the move — and a line found through a shown move does not count', async () => {
		const { s, discoveries } = await started();
		s.hint();
		// The book move keeping the most lines open: Nf3.
		expect(s.marks.g1).toContain('hint');
		s.hint();
		expect(s.arrows).toEqual([{ from: 'g1', to: 'f3', kind: 'hint' }]);

		await s.submit('f1', 'c4');
		expect(discoveries).toEqual([expect.objectContaining({ stage: 'entered' })]);
		expect(s.events.at(-1)).toMatchObject({ kind: 'discovered', assisted: true });
	});

	it('takes back to the learner’s previous decision, never into the opening moves', async () => {
		const { s } = await started();
		expect(s.canTakeBack).toBe(false);
		await s.submit('g1', 'f3');
		expect(s.canTakeBack).toBe(true);
		await s.takeBack();
		expect(s.game.history).toEqual(['e4', 'e5']);
		expect(s.phase).toBe('your-move');
	});

	it('uses the engine only once the book has run out', async () => {
		const engine = fakeEngine();
		const { s } = await started({ engine });
		await s.submit('g1', 'f3');
		expect(engine.calls).toEqual([]);
		await s.submit('f1', 'b5');
		// The line ended with ...a6, a position the bundle has no evals for.
		expect(engine.calls.map(toEpd)).toEqual([epdAfter(...OPENING, 'g1f3', 'b8c6', 'f1b5', 'a7a6')]);
	});
});

describe('browsing past the book', () => {
	it('steps back and forward, jumps by ply, and resumes from where it stops', async () => {
		const { s } = await started();
		await s.submit('g1', 'f3'); // 3.Nf3, the computer answers ...Nc6
		expect(s.game.history).toEqual(['e4', 'e5', 'Nf3', 'Nc6']);
		expect(s.atTip).toBe(true);

		s.back();
		expect(s.phase).toBe('browse');
		// Back to the learner's own previous move, past the computer's reply.
		expect(s.game.history).toEqual(['e4', 'e5']);
		expect(s.atTip).toBe(false);

		// Back again: one move of the learner's own each time, so this reaches the start.
		s.back();
		expect(s.game.history).toEqual([]);
		expect(s.canForward).toBe(true);

		// Forward lands on the learner's next turn, not on the computer's half-move.
		s.forward();
		expect(s.game.history).toEqual(['e4', 'e5']);

		// Playing something else from here branches: the old moves stay in the tree.
		await s.playFromHere();
		expect(s.phase).toBe('your-move');
		await s.submit('f1', 'c4');
		expect(s.game.history.slice(0, 3)).toEqual(['e4', 'e5', 'Bc4']);
		const afterE5 = s.root.children[0].children[0];
		expect(afterE5.children.map((m) => m.san)).toEqual(['Nf3', 'Bc4']);
	});

	it('hides the evaluation while the position is still in the book', async () => {
		const { s } = await started();
		await s.submit('g1', 'f3');
		s.back();
		expect(s.evaluation).toBeNull();
	});
});
