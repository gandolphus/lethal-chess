import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import type { BookLine, Bundle, BundleNode } from '$lib/drill/bundle';
import type { Attempt } from '$lib/drill/session.svelte';
import { toEpd } from '$lib/drill/tree';
import { Book, type LineStage } from './book';
import { lineCards, mastery, nextLine, reviewable, type LineReview } from './mastery';
import { ReviewSession } from './review.svelte';

const epdAfter = (...moves: string[]) => {
	const chess = new Chess();
	for (const m of moves) chess.move({ from: m.slice(0, 2), to: m.slice(2, 4) });
	return toEpd(chess.fen());
};

const OPENING = ['e2e4', 'e7e5'];
const lines: BookLine[] = [
	{ name: 'Test: Knight, Spanish', variation: 'Test: Knight', moves: [...OPENING, 'g1f3', 'b8c6', 'f1b5', 'a7a6'], entry: 3, entryName: 'Test: Knight', dubious: false },
	{ name: 'Test: Knight, Petrov', variation: 'Test: Knight', moves: [...OPENING, 'g1f3', 'g8f6'], entry: 3, entryName: 'Test: Knight', dubious: false },
	{ name: 'Test: Bishop', variation: 'Test: Bishop', moves: [...OPENING, 'f1c4'], entry: 3, dubious: false },
	{ name: 'Test: Queen', variation: 'Test: Queen', moves: [...OPENING, 'd1h5'], entry: 3, dubious: true },
	{ name: 'Test: Countergambit', variation: 'Test: Countergambit', moves: [...OPENING, 'g1f3', 'f7f5'], entry: 4, dubious: false }
];

function fixture(): Bundle {
	const node = (moves: string[], candidates: [string, number][]): BundleNode => ({
		epd: epdAfter(...moves),
		ply: moves.length,
		depth: 30,
		candidates: candidates.map(([uci, cp]) => ({ uci, san: uci, score: { cp } })),
		line: []
	});
	const nodes = [node(OPENING, [['g1f3', 40], ['b1c3', 35], ['f1c4', 30], ['a2a3', -60]])];
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

const book = new Book(fixture());
const [spanish, petrov, bishop, queen] = book.lines;
const at = (day: number) => new Date(Date.UTC(2026, 8, day, 10)).toISOString();

describe('mastery', () => {
	it('reviews only discovered, sound lines with a move of the learner’s own past the opening', () => {
		const stages = new Map<string, LineStage>([
			[spanish.key, 'discovered'],
			[petrov.key, 'entered'],
			[queen.key, 'discovered'],
			[book.lines[4].key, 'discovered'] // ends on ...f5, but the learner still has Nf3 to play
		]);
		expect(reviewable(book, stages, 2, 'w').map((l) => l.name)).toEqual(['Test: Knight, Spanish', 'Test: Countergambit']);
	});

	it('replays reviews into FSRS cards and counts remembered, mastered and due lines', () => {
		const reviews: LineReview[] = [1, 3, 10, 40].map((day) => ({ bundleId: 'fixture', line: spanish.key, rating: 'good', at: at(day) }));
		const cards = lineCards(reviews);
		const now = new Date(at(41));
		const m = mastery([spanish, bishop], cards, now);
		expect(m).toMatchObject({ discovered: 2, remembered: 1, due: 1 });
		expect(cards.get(spanish.key)!.stability).toBeGreaterThan(21);
		expect(m.mastered).toBe(1);
	});

	it('picks the most overdue line first, then lines never reviewed', () => {
		const cards = lineCards([
			{ bundleId: 'fixture', line: spanish.key, rating: 'again', at: at(1) },
			{ bundleId: 'fixture', line: bishop.key, rating: 'again', at: at(2) }
		]);
		expect(nextLine([bishop, spanish, petrov], cards, new Date(at(20)))).toBe(spanish);
		expect(nextLine([petrov, spanish], new Map(), new Date(at(20)))).toBe(petrov);
		expect(nextLine([spanish], lineCards([{ bundleId: 'fixture', line: spanish.key, rating: 'good', at: at(20) }]), new Date(at(20)))).toBeNull();
	});
});

function reviewSession(line = spanish) {
	const attempts: Attempt[] = [];
	const reviews: LineReview[] = [];
	const s = new ReviewSession({
		bundle: fixture(),
		book,
		line,
		onAttempt: (a) => attempts.push(a),
		onReview: (r) => reviews.push(r),
		random: () => 0,
		wait: async () => {},
		now: () => new Date(at(15))
	});
	return { s, attempts, reviews };
}

describe('ReviewSession', () => {
	it('replays the line from after the opening, the computer playing the other side, and rates it Good', async () => {
		const { s, attempts, reviews } = reviewSession();
		await s.start();
		expect(s.game.history).toEqual(['e4', 'e5']);
		await s.submit('g1', 'f3');
		expect(s.game.history.at(-1)).toBe('Nc6');
		await s.submit('f1', 'b5');
		expect(s.phase).toBe('done');
		expect(s.game.history.at(-1)).toBe('a6');
		expect(reviews).toEqual([{ bundleId: 'fixture', line: spanish.key, rating: 'good', at: at(15) }]);
		expect(s.result?.due.getTime()).toBeGreaterThan(new Date(at(15)).getTime());
		expect(attempts.map((a) => [a.grade, a.mode])).toEqual([
			['pass', 'practice'],
			['pass', 'practice']
		]);
	});

	it('calls another good move "right idea, other line" and rates the line Hard', async () => {
		const { s, reviews } = reviewSession();
		await s.start();
		expect(await s.submit('f1', 'c4')).toBe(false); // book, but the Bishop line
		expect(s.phase).toBe('retry');
		expect(s.game.history).toHaveLength(2);
		await s.submit('g1', 'f3');
		await s.submit('f1', 'b5');
		expect(reviews[0].rating).toBe('hard');
	});

	it('gives one retry after a wrong move, then shows the move, and rates the line Again', async () => {
		const { s, reviews } = reviewSession();
		await s.start();
		await s.submit('a2', 'a3');
		expect(s.phase).toBe('retry');
		expect(s.arrows).toEqual([]);
		await s.submit('h2', 'h3');
		expect(s.phase).toBe('reveal');
		expect(s.arrows).toEqual([{ from: 'g1', to: 'f3', kind: 'hint' }]);
		expect(await s.submit('b1', 'c3')).toBe(false);
		await s.submit('g1', 'f3');
		await s.submit('f1', 'b5');
		expect(reviews[0].rating).toBe('again');
	});

	it('marks the piece on the first hint (Hard) and shows the move on the second (Again)', async () => {
		const { s } = reviewSession();
		await s.start();
		s.hint();
		expect(s.marks.g1).toContain('hint');
		s.hint();
		expect(s.phase).toBe('reveal');
	});
});

describe('planToday', () => {
	it('interleaves openings, most overdue first within each, and stops at the limit', async () => {
		const { planToday } = await import('./today');
		const a = fixture();
		const b = { ...fixture(), id: 'other' };
		const cards = lineCards([
			{ bundleId: 'fixture', line: bishop.key, rating: 'again', at: at(1) },
			{ bundleId: 'fixture', line: spanish.key, rating: 'again', at: at(2) }
		]);
		const plan = planToday(
			[
				{ bundle: a, lines: [spanish, bishop, petrov], cards },
				{ bundle: b, lines: [petrov], cards: new Map() }
			],
			new Date(at(20)),
			3
		);
		expect(plan.map((item) => `${item.bundle.id}:${item.line.name}`)).toEqual([
			'fixture:Test: Bishop',
			'other:Test: Knight, Petrov',
			'fixture:Test: Knight, Spanish'
		]);
	});
});
