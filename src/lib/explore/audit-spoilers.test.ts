/**
 * Correctness audit, 2026-09-16: the spoiler rule on the map and the playing page. Every test here fails
 * against the code as audited and is marked `.fails`, so the suite stays green until the defect is fixed —
 * at which point the test starts failing the other way and should be turned into a plain `it`.
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
	it.fails('does not name an entered line on the tooltip of its warm beads', () => {
		const stages = stagesOf([[rio, 'entered']]);
		const chart = layout(book.lines, stages, { zoom: 'detail', width: 1200, opening: OPENING.length });
		// LineMap.svelte shows `move.name` in the hover tooltip for every bead with a `line`.
		const named = chart.moves.filter((m) => m.line && m.ply > OPENING.length).map((m) => m.name);
		expect(named.length).toBeGreaterThan(0);
		for (const name of named) expect(secretNames(stages)).not.toContain(name);
	});

	it.fails('does not hand the page a name for an entered line’s end (the aria-label and the tap dialog use `node.line.name`)', () => {
		const stages = stagesOf([[exchange, 'entered']]);
		const chart = layout(book.lines, stages, { zoom: 'detail', width: 1200, opening: OPENING.length });
		const ends = chart.nodes.filter((n) => n.line);
		expect(ends.length).toBe(1);
		// The end is clickable, which is right: it should resume to the entrance. But `line` is the whole
		// IndexedLine, and the component reads `line.name` off it for the button's label and the confirm dialog.
		expect(ends[0].resumeTo).toBe(exchange.entry);
		expect(secretNames(stages)).not.toContain(ends[0].line!.name);
	});
});

describe('the band root', () => {
	it.fails('carries the bundle’s first line, which the tap-to-confirm dialog names', () => {
		// Nothing found. The root bead's `line` is `band.lines[0]` so a click can replay the opening; on a
		// phone `LineMap.svelte` confirms with `${asked.line.name} — …`, which is that undiscovered line's name.
		const stages = new Map<string, LineStage>();
		const chart = layout(book.lines, stages, { zoom: 'detail', width: 1200, opening: OPENING.length });
		const roots = chart.moves.filter((m) => m.ply === OPENING.length);
		expect(roots.length).toBe(2);
		for (const root of roots) expect(secretNames(stages)).not.toContain(root.line?.name);
	});
});

describe('the map treats "here" as an entered line', () => {
	it.fails('a line the game is merely on, before its entrance, gets no clickable end', () => {
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
	it.fails('picking up the line the map calls "here" credits an entrance the learner never reached', async () => {
		// Nothing found. After the defining moves the page's `here` is { line: lines[0], index: 2 } and the
		// map offers that line's end with resumeTo = its entrance (3). Resuming replays 3.Nf3 — a move the
		// learner has not played — and records "entered" for both Knight lines.
		const { s, discoveries, book } = session();
		await s.start();
		await s.submit('e2', 'e4');
		expect(s.game.uciHistory).toEqual(SHORT_OPENING);
		const chart = layout(book.lines, new Map(), { zoom: 'detail', width: 1200, opening: 2, here: { line: book.lines[0], index: 2 } });
		const offered = chart.nodes.find((n) => n.line);
		expect(offered).toBeDefined();
		await s.resume(offered!.line!, offered!.resumeTo);
		expect(discoveries).toEqual([]);
	});

	it.fails('a move during the trace does not race the replay', async () => {
		// `resume` resets the board but leaves the phase at 'your-move', so the board stays interactive while
		// the route is traced (220 ms a move). A learner who plays 1.e4 during the trace starts a second
		// game inside the first: the trace's remaining moves land on top of theirs, and the computer's
		// delayed reply is then illegal and throws out of `submit`.
		const holds: (() => void)[] = [];
		const wait = () => new Promise<void>((resolve) => holds.push(resolve));
		const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
		const { s, book } = session({ wait });
		await s.start();
		void s.submit('e2', 'e4');
		await flush();
		holds.shift()!(); // the computer's reply delay
		await flush();
		expect(s.game.uciHistory).toEqual(SHORT_OPENING);
		expect(s.phase).toBe('your-move');

		// The map's band-root bead calls resume(lines[0], opening.length): the trace shows the defining moves
		// but the last, and the learner is to move inside the opening while it runs (the Ruy Lopez: four plies
		// shown, White to move). This fixture's opening is two plies, so the same shape is resume(line, 1).
		const spanish = book.lines[0];
		let error: unknown = null;
		const resumed = s.resume(spanish, 1).catch((e: unknown) => (error = e));
		await flush();
		expect(holds.length).toBe(1); // the trace
		expect(s.game.uciHistory).toEqual([]);
		expect(s.canMove).toBe(true);
		// The learner plays the defining move during the trace — the board takes it — and the computer's delay starts.
		const played = s.submit('e2', 'e4').catch((e: unknown) => (error = e));
		await flush();
		expect(s.game.uciHistory).toEqual(['e2e4']);
		expect(holds.length).toBe(2);
		holds.shift()!(); // the trace ends: the route's last move is walked onto the learner's game
		await flush();
		holds.shift()!(); // the computer's reply, computed for the position before the trace landed
		await flush();
		for (let i = 0; i < 10 && holds.length; i++) {
			holds.shift()!();
			await flush();
		}
		await Promise.allSettled([resumed, played]);
		// The trace's own continuation queued a second computer reply for the same position. `Game.move`
		// refuses the second one (it is Black's move on White's turn) — but `#played` records it in the move
		// tree regardless, so the tree carries a move the board never saw, and `current` points at it.
		expect(error).toBeNull();
		expect(s.phase).not.toBe('thinking');
		expect(s.game.uciHistory).toEqual(SHORT_OPENING);
		expect(pathTo(s.current).map((m) => m.uci)).toEqual(s.game.uciHistory);
	});
});
