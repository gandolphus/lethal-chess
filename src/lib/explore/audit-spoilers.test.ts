/**
 * Correctness audit, 2026-09-16: the spoiler rule on the map and the playing page. Tests written against
 * defects the audit found. Ones still marked `.fails` are still defects; the rest have been fixed and now
 * guard the fix — they assert the *display* name the component reads, which is the only name that may
 * reach a reader, never the line object's own.
 */
import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import type { Analysis } from '$lib/chess/engine';
import type { BookLine, Bundle, BundleNode } from '$lib/drill/bundle';
import { toEpd } from '$lib/drill/tree';
import { Book, type Discovery, type LineStage } from './book';
import { layout } from './linemap';
import { pathTo } from './movetree';
import { ExploreSession } from './session.svelte';

const OPENING = ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5'];

const line = (name: string, moves: string[], extra: Partial<BookLine> = {}): BookLine => ({
	name,
	variation: name.split(',')[0],
	moves: [...OPENING, ...moves],
	entry: OPENING.length + moves.length,
	dubious: false,
	...extra
});

// Berlin: two lines sharing 3...Nf6 4.O-O, entered at 3...Nf6; Morphy: two lines sharing 3...a6.
const lines: BookLine[] = [
	line('Test: Berlin, Rio', ['g8f6', 'e1g1', 'f6e4'], { entry: 6, entryName: 'Test: Berlin' }),
	line('Test: Berlin, Classical', ['g8f6', 'e1g1', 'f8c5'], { entry: 6, entryName: 'Test: Berlin' }),
	line('Test: Morphy, Exchange', ['a7a6', 'b5c6'], { entry: 6, entryName: 'Test: Morphy' }),
	line('Test: Morphy, Retreat', ['a7a6', 'b5a4'], { entry: 6, entryName: 'Test: Morphy' })
];

const book = new Book({ lines });
const [rio, classical, exchange] = book.lines;
const stagesOf = (entries: [typeof rio, LineStage][]) => new Map(entries.map(([l, s]) => [l.key, s]));
const secretNames = (stages: Map<string, LineStage>) => book.lines.filter((l) => stages.get(l.key) !== 'discovered').map((l) => l.name);

describe('the map keeps an entered line’s end secret (Exploration Mode: "a hollow end and *no* name")', () => {
	it('does not name an entered line on the tooltip of its warm beads', () => {
		const stages = stagesOf([[rio, 'entered']]);
		const chart = layout(book.lines, stages, { zoom: 'detail', width: 1200, opening: OPENING.length });
		// LineMap.svelte shows `move.name` in the hover tooltip for every bead with a `line`.
		const named = chart.moves.filter((m) => m.line && m.ply > OPENING.length).map((m) => m.name);
		expect(named.length).toBeGreaterThan(0);
		for (const name of named) expect(secretNames(stages)).not.toContain(name);
	});

	it('calls an entered line’s end after its entrance, which is what the label and the dialog read', () => {
		const stages = stagesOf([[exchange, 'entered']]);
		const chart = layout(book.lines, stages, { zoom: 'detail', width: 1200, opening: OPENING.length });
		const ends = chart.nodes.filter((n) => n.line);
		expect(ends.length).toBe(1);
		// Still clickable, and still only as far as the entrance — but named after the entrance, not the end.
		expect(ends[0].resumeTo).toBe(exchange.entry);
		expect(ends[0].name).toBe(exchange.entryName);
		expect(secretNames(stages)).not.toContain(ends[0].name);
	});
});

describe('the band root', () => {
	it('is named after its band, never after a line running through it', () => {
		// The root keeps a `line` so a click can replay the opening and the tooltip can draw the position;
		// what the dialog and the label read is `name`, and that is the band's.
		const stages = new Map<string, LineStage>();
		const chart = layout(book.lines, stages, { zoom: 'detail', width: 1200, opening: OPENING.length });
		const roots = chart.moves.filter((m) => m.ply === OPENING.length);
		expect(roots.length).toBe(2);
		for (const root of roots) {
			expect(secretNames(stages)).not.toContain(root.name);
			expect(chart.bands.some((b) => b.label === root.name || b.name === root.name)).toBe(true);
		}
	});
});

describe('the map treats "here" as an entered line', () => {
	it('a line the game is merely on, before its entrance, gets no clickable end', () => {
		// The page's `here` falls back to *any* line through the position: right after the defining moves that
		// is the bundle's first line, at index = the opening's length, entrance not yet reached.
		const stages = new Map<string, LineStage>();
		const here = { line: rio, index: OPENING.length };
		const chart = layout(book.lines, stages, { zoom: 'detail', width: 1200, opening: OPENING.length, here });
		const clickable = chart.nodes.filter((n) => n.line);
		// Nothing is entered or discovered, so nothing may be picked up — least of all with a resumeTo past
		// the position the game has reached.
		expect(clickable.map((n) => [n.line!.name, n.resumeTo])).toEqual([]);
	});
});

// ── the session side of the same path ────────────────────────────────────────────────────────

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

const SHORT_OPENING = ['e2e4', 'e7e5'];
const sessionLines: BookLine[] = [
	{ name: 'Test: Knight, Spanish', variation: 'Test: Knight', moves: [...SHORT_OPENING, 'g1f3', 'b8c6', 'f1b5', 'a7a6'], entry: 3, entryName: 'Test: Knight', dubious: false },
	{ name: 'Test: Knight, Petrov', variation: 'Test: Knight', moves: [...SHORT_OPENING, 'g1f3', 'g8f6'], entry: 3, entryName: 'Test: Knight', dubious: false },
	{ name: 'Test: Bishop', variation: 'Test: Bishop', moves: [...SHORT_OPENING, 'f1c4'], entry: 3, dubious: false }
];

function fixture(): Bundle {
	const nodes = [
		node([], [cand('e2e4', 'e4', 30)]),
		node(['e2e4'], [cand('e7e5', 'e5', 30)]),
		node(SHORT_OPENING, [cand('g1f3', 'Nf3', 40), cand('f1c4', 'Bc4', 30), cand('b1c3', 'Nc3', 25)]),
		node([...SHORT_OPENING, 'g1f3'], [cand('b8c6', 'Nc6', 40), cand('g8f6', 'Nf6', 45)], 'Test: Knight'),
		node([...SHORT_OPENING, 'g1f3', 'b8c6'], [cand('f1b5', 'Bb5', 40), cand('f1c4', 'Bc4', 35)]),
		node([...SHORT_OPENING, 'g1f3', 'b8c6', 'f1b5'], [cand('a7a6', 'a6', 40)])
	];
	return {
		id: 'fixture',
		name: 'Fixture',
		side: 'w',
		rootMoves: [],
		openingMoves: SHORT_OPENING,
		rootEpd: epdAfter(),
		nodes: Object.fromEntries(nodes.map((n) => [n.epd, n])),
		lines: sessionLines,
		tolerances: { soundCp: 35, replyCp: 60 },
		stats: { learnerNodes: 0, opponentNodes: 0, maxPly: 0, missingEvals: 0 },
		source: { evalCacheRecords: 0, builtAt: '' }
	};
}

const fakeEngine = {
	analyse: async (fen: string): Promise<Analysis> => {
		const [first] = new Chess(fen).moves({ verbose: true });
		return { fen, lines: first ? [{ move: `${first.from}${first.to}`, score: { cp: 0 }, pv: [], depth: 12 }] : [] };
	}
};

function session(opts: { wait?: (ms: number) => Promise<void>; stages?: Map<string, LineStage> } = {}) {
	const bundle = fixture();
	const discoveries: Discovery[] = [];
	const s = new ExploreSession({
		bundle,
		book: new Book(bundle),
		stages: opts.stages ?? new Map(),
		engine: async () => fakeEngine,
		onDiscovery: (d) => discoveries.push(d),
		random: () => 0,
		wait: opts.wait ?? (async () => {}),
		mistakeRate: 0
	});
	return { s, discoveries, book: new Book(bundle) };
}

describe('resume() off the map', () => {
	it('offers nothing for the line the map calls "here", and refuses it if asked anyway', async () => {
		const { s, discoveries, book } = session();
		await s.start();
		await s.submit('e2', 'e4');
		expect(s.game.uciHistory).toEqual(SHORT_OPENING);
		// Nothing found, so the map offers nothing — being *on* a line before its entrance earns none of it.
		const chart = layout(book.lines, new Map(), { zoom: 'detail', width: 1200, opening: 2, here: { line: book.lines[0], index: 2 } });
		expect(chart.nodes.filter((n) => n.line)).toEqual([]);
		// And the session refuses it even when asked directly, which is what a hand-written ?line= would do.
		await s.resume(book.lines[0], book.lines[0].moves.length);
		expect(s.game.uciHistory).toEqual([]);
		expect(discoveries.filter((d) => d.stage === 'discovered')).toEqual([]);
	});

	it('does not let a move race the replay, because the board is not the learner’s while it draws', async () => {
		const holds: (() => void)[] = [];
		const wait = () => new Promise<void>((resolve) => holds.push(resolve));
		const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
		// A line already found, so there is a real route to draw and a real chance to race it.
		const found = new Book(fixture()).lines[0];
		const { s, book } = session({ wait, stages: new Map([[found.key, 'discovered']]) });
		await s.start();
		void s.submit('e2', 'e4');
		await flush();
		holds.shift()!(); // the computer's reply delay
		await flush();
		expect(s.game.uciHistory).toEqual(SHORT_OPENING);
		expect(s.phase).toBe('your-move');

		const spanish = book.lines[0];
		let error: unknown = null;
		const resumed = s.resume(spanish, 2).catch((e: unknown) => (error = e));
		await flush();
		expect(holds.length).toBe(1); // the trace
		expect(s.game.uciHistory).toEqual(spanish.moves.slice(0, 1));
		// The board is the route's while it is drawn, so there is no race to lose.
		expect(s.canMove).toBe(false);
		expect(await s.submit('e2', 'e4')).toBeNull();
		expect(s.game.uciHistory).toEqual(spanish.moves.slice(0, 1));

		holds.shift()!(); // the trace ends and the route's last move lands
		await flush();
		for (let i = 0; i < 10 && holds.length; i++) {
			holds.shift()!();
			await flush();
		}
		await resumed;
		expect(error).toBeNull();
		expect(s.phase).not.toBe('thinking');
		// The tree and the board agree: nothing was recorded that the board refused.
		expect(pathTo(s.current).map((m) => m.uci)).toEqual(s.game.uciHistory);
	});
});
