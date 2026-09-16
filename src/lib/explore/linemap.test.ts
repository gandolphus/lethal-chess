import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { BookLine, Bundle } from '$lib/drill/bundle';
import { Book, type LineStage } from './book';
import { bandsOf, DUBIOUS, edgeState, elementCount, layout, place, sanOf, SIDELINES, trie } from './linemap';

const OPENING = ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5'];

const line = (name: string, moves: string[], extra: Partial<BookLine> = {}): BookLine => ({
	name,
	variation: name.split(',')[0],
	moves: [...OPENING, ...moves],
	entry: OPENING.length + moves.length,
	dubious: false,
	...extra
});

// Berlin: two lines sharing 3...Nf6 4.O-O; Morphy: two lines sharing 3...a6; two one-line variations; one dubious.
const lines: BookLine[] = [
	line('Test: Berlin, Rio', ['g8f6', 'e1g1', 'f6e4'], { entry: 6, entryName: 'Test: Berlin' }),
	line('Test: Berlin, Classical', ['g8f6', 'e1g1', 'f8c5'], { entry: 6, entryName: 'Test: Berlin' }),
	line('Test: Morphy, Exchange', ['a7a6', 'b5c6'], { entry: 6, entryName: 'Test: Morphy' }),
	line('Test: Morphy, Retreat', ['a7a6', 'b5a4'], { entry: 6, entryName: 'Test: Morphy' }),
	line('Test: Cozio', ['g8e7']),
	line('Test: Bird', ['c6d4']),
	line('Test: Bad', ['f7f5'], { dubious: true })
];

const book = new Book({ lines });
const [rio, classical, exchange, retreat, cozio, bird, bad] = book.lines;
const stagesOf = (entries: [typeof rio, LineStage][]) => new Map(entries.map(([l, s]) => [l.key, s]));

describe('bandsOf', () => {
	it('groups sound lines by variation, largest first, folds single lines into Sidelines and keeps dubious lines apart', () => {
		const bands = bandsOf(book.lines, stagesOf([[rio, 'discovered'], [exchange, 'entered'], [cozio, 'discovered']]));
		expect(bands.map((b) => [b.name, b.kind, b.lines.length, b.discovered, b.entered])).toEqual([
			['Test: Berlin', 'variation', 2, 1, 0],
			['Test: Morphy', 'variation', 2, 0, 1],
			[SIDELINES, 'sidelines', 2, 1, 0],
			[DUBIOUS, 'dubious', 1, 0, 0]
		]);
		expect(bands[3].lines).toEqual([bad]);
	});
});

describe('trie and place', () => {
	it('shares common moves and stacks the leaves, parents centred on their children', () => {
		const root = trie([rio, classical, cozio], OPENING.length);
		expect(root.children.map((c) => [c.uci, c.lines.length])).toEqual([
			['g8f6', 2],
			['g8e7', 1]
		]);
		const leaves = place(root, 10, 100);
		expect(leaves).toBe(3);
		const berlin = root.children[0];
		const castled = berlin.children[0];
		expect(castled.children.map((c) => c.y)).toEqual([105, 115]);
		expect(castled.y).toBe(110);
		expect(berlin.y).toBe(110);
		expect(root.children[1].y).toBe(125);
		expect(root.y).toBe(117.5);
		expect(castled.children[0].ends).toEqual([rio]);
	});
});

describe('edgeState', () => {
	const root = trie([rio, classical], OPENING.length);
	const nf6 = root.children[0];
	const castle = nf6.children[0];
	const [nxe4, bc5] = castle.children;

	it('is fog on secret lines', () => {
		expect(edgeState(nf6, new Map(), null)).toBe('fog');
		expect(edgeState(nxe4, new Map(), null)).toBe('fog');
	});

	it('is lit along a discovered line and stays fog on its secret siblings', () => {
		const stages = stagesOf([[rio, 'discovered']]);
		expect(edgeState(nf6, stages, null)).toBe('lit');
		expect(edgeState(nxe4, stages, null)).toBe('lit');
		expect(edgeState(bc5, stages, null)).toBe('fog');
	});

	it('is solid ember up to the entrance of an entered line and dim beyond', () => {
		const stages = stagesOf([[rio, 'entered']]);
		expect(edgeState(nf6, stages, null)).toBe('ember');
		expect(edgeState(castle, stages, null)).toBe('ember-dim');
		expect(edgeState(nxe4, stages, null)).toBe('ember-dim');
	});

	it('extends the solid part to where the game has come on the line being followed', () => {
		const stages = stagesOf([[rio, 'entered']]);
		expect(edgeState(castle, stages, { line: rio, index: 7 })).toBe('ember');
		expect(edgeState(nxe4, stages, { line: rio, index: 7 })).toBe('ember-dim');
	});

	it('warms only the moves played on a line the game is on but has not entered', () => {
		expect(edgeState(nf6, new Map(), { line: rio, index: 6 })).toBe('ember');
		expect(edgeState(castle, new Map(), { line: rio, index: 6 })).toBe('fog');
	});
});

describe('layout', () => {
	const options = { zoom: 'detail' as const, width: 800, opening: OPENING.length };

	it('places one band per variation with edges, ends and the here marker', () => {
		const stages = stagesOf([[rio, 'discovered'], [exchange, 'entered']]);
		const l = layout(book.lines, stages, { ...options, here: { line: exchange, index: 6 } });
		expect(l.bands.map((b) => [b.label, b.count, b.here])).toEqual([
			['Berlin', '1 of 2', false],
			['Morphy', '0 of 2', true],
			[SIDELINES, '0 of 2', false],
			[DUBIOUS, '0 of 1', false]
		]);
		expect(l.nodes.filter((n) => n.kind === 'lit').map((n) => n.label)).toEqual(['Rio']);
		expect(l.nodes.filter((n) => n.kind === 'ember')).toHaveLength(1);
		// SAN only where the learner has been: the discovered line's three moves and the entered line's ...a6.
		expect(l.edges.filter((e) => e.label).map((e) => e.label!.text)).toEqual(['Nf6', 'O-O', 'Nxe4', 'a6']);
		// Fog: Bc5, Ba4, Ne7, Nd4, f5. The entered Exchange line's Bxc6 is dim ember, not fog.
		expect(l.edges.filter((e) => e.state === 'fog')).toHaveLength(5);
		expect(l.edges.filter((e) => e.state === 'ember-dim')).toHaveLength(1);
		// Here: the position after 3...a6, one ply right of the root.
		const morphy = l.bands[1];
		expect(l.here).toEqual({ x: 180 + 46, y: morphy.y + 16 });
	});

	it('beads every move, and only names the ones the learner has been down', () => {
		const found = new Map<string, LineStage>([[book.lines[0].key, 'discovered']]);
		const l = layout(book.lines, found, options);
		// One move per edge, and the ends among them — they carry no bead but are still hoverable.
		expect(l.moves.length).toBe(l.edges.length);
		expect(l.moves.filter((m) => m.end).length).toBe(l.nodes.filter((n) => n.kind !== 'branch').length);
		// The spoiler rule the edge labels follow: a secret move has no line to draw a diagram from.
		for (const move of l.moves) {
			if (move.state === 'fog' || move.state === 'ember-dim') expect(move.line).toBeNull();
			else expect(move.line).not.toBeNull();
		}
		expect(l.moves.some((m) => m.state === 'lit' && m.line)).toBe(true);
	});

	it('fits Overview to the width', () => {
		const l = layout(book.lines, new Map(), { ...options, zoom: 'overview', width: 600 });
		expect(l.width).toBe(600);
		expect(l.edges.every((e) => e.label === null)).toBe(true);
		expect(l.ruler[0].label).toBe('3.');
	});

	it('converts moves to SAN once per line', () => {
		expect(sanOf(rio)).toEqual(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'Nf6', 'O-O', 'Nxe4']);
		expect(sanOf(rio)).toBe(sanOf(rio));
	});

	it('draws the Sicilian within budget: at most 2,000 elements, and fast enough to build on open', () => {
		const bundle = JSON.parse(readFileSync('static/openings/repertoires/sicilian.json', 'utf8')) as Bundle;
		const sicilian = new Book(bundle);
		const stages = new Map<string, LineStage>(sicilian.lines.slice(0, 40).map((l, i) => [l.key, i % 3 ? 'discovered' : 'entered']));
		const opening = bundle.openingMoves!.length;
		for (const zoom of ['detail', 'overview'] as const) {
			const started = performance.now();
			const l = layout(sicilian.lines, stages, { zoom, width: 1000, opening, here: { line: sicilian.lines[0], index: opening + 2 } });
			const took = performance.now() - started;
			expect(elementCount(l)).toBeLessThanOrEqual(2000);
			// A smoke check, not a benchmark: it takes about 4 ms, but a wall clock on a busy machine
			// (a build running alongside the suite) made a 30 ms bound fail spuriously.
			expect(took).toBeLessThan(250);
			expect(l.bands.at(-2)?.name).toBe(SIDELINES);
		}
	});
});
