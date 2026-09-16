import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import type { BookLine } from '$lib/drill/bundle';
import { Rating, review } from '$lib/drill/scheduler';
import { toEpd } from '$lib/drill/tree';
import { Book, type Discovery } from './book';
import { ago, dueIn, promote, shortName, standing, statusOf, type Standing } from './dashboard';

const OPENING = ['e2e4', 'e7e5'];
const lines: BookLine[] = [
	{ name: 'Test: Knight, Spanish', variation: 'Test: Knight', moves: [...OPENING, 'g1f3', 'b8c6', 'f1b5', 'a7a6'], entry: 3, entryName: 'Test: Knight', dubious: false },
	{ name: 'Test: Knight, Petrov', variation: 'Test: Knight', moves: [...OPENING, 'g1f3', 'g8f6'], entry: 3, entryName: 'Test: Knight', dubious: false },
	{ name: 'Test: Bishop', variation: 'Test: Bishop', moves: [...OPENING, 'f1c4'], entry: 3, dubious: false },
	{ name: 'Test: Queen', variation: 'Test: Queen', moves: [...OPENING, 'd1h5'], entry: 3, dubious: true }
];
const book = new Book({ lines });
const keyOf = (name: string) => book.lines.find((l) => l.name === name)!.key;
const endOf = (...moves: string[]) => {
	const chess = new Chess();
	for (const m of moves) chess.move({ from: m.slice(0, 2), to: m.slice(2, 4) });
	return toEpd(chess.fen());
};

const now = new Date('2026-09-16T12:00:00Z');
const found = (name: string, at: string): Discovery => ({ bundleId: 't', line: keyOf(name), stage: 'discovered', at });

describe('standing', () => {
	it('counts sound lines only, entered apart from discovered, and names the newest discovery', () => {
		const discoveries: Discovery[] = [
			found('Test: Bishop', '2026-09-10T10:00:00Z'),
			{ bundleId: 't', line: keyOf('Test: Knight, Spanish'), stage: 'entered', at: '2026-09-12T10:00:00Z' },
			found('Test: Knight, Petrov', '2026-09-15T10:00:00Z'),
			found('Test: Queen', '2026-09-16T10:00:00Z')
		];
		const s = standing(book, discoveries, new Map(), OPENING.length, 'w', now);
		expect(s.total).toBe(3);
		expect(s.discovered).toBe(2);
		expect(s.entered).toBe(1);
		// The dubious line was found last, but it is not part of the standing.
		expect(s.lastFound?.line.name).toBe('Test: Knight, Petrov');
		expect(s.lastFound?.at.toISOString()).toBe('2026-09-15T10:00:00.000Z');
	});

	it('is empty for a fresh learner', () => {
		const s = standing(book, [], new Map(), OPENING.length, 'w', now);
		expect(s).toMatchObject({ total: 3, discovered: 0, entered: 0, remembered: 0, mastered: 0, due: 0, nextDue: null, lastFound: null });
	});

	it('takes due and remembered from the line cards', () => {
		const discoveries = [found('Test: Bishop', '2026-09-10T10:00:00Z'), found('Test: Knight, Petrov', '2026-09-11T10:00:00Z')];
		// One line reviewed well a while ago, due again; the other never replayed, so due at once.
		const cards = new Map([[keyOf('Test: Bishop'), review(undefined, Rating.Good, new Date('2026-09-10T11:00:00Z'))]]);
		const s = standing(book, discoveries, cards, OPENING.length, 'w', now);
		expect(s.discovered).toBe(2);
		expect(s.due).toBe(2);
	});

	it('ignores a discovery whose line is no longer in the book', () => {
		const stale: Discovery = { bundleId: 't', line: endOf('e2e4', 'c7c5'), stage: 'discovered', at: '2026-09-16T11:00:00Z' };
		const s = standing(book, [stale, found('Test: Bishop', '2026-09-10T10:00:00Z')], new Map(), OPENING.length, 'w', now);
		expect(s.discovered).toBe(1);
		expect(s.lastFound?.line.name).toBe('Test: Bishop');
	});
});

const base: Standing = { total: 146, discovered: 0, entered: 0, remembered: 0, mastered: 0, due: 0, nextDue: null, lastFound: null };

describe('promote', () => {
	it('leads with practice when anything is due, else explore while fog remains, else The Open', () => {
		expect(promote(base)).toBe('explore');
		expect(promote({ ...base, discovered: 12, due: 3 })).toBe('practice');
		expect(promote({ ...base, discovered: 12 })).toBe('explore');
		expect(promote({ ...base, discovered: 146 })).toBe('open');
	});
});

describe('statusOf', () => {
	it('says what each approach would do for this learner', () => {
		expect(statusOf('explore', base, now)).toBe('146 lines to find. Start here.');
		expect(statusOf('explore', { ...base, discovered: 12, entered: 3 }, now)).toBe('134 still secret, 3 entered but not finished.');
		expect(statusOf('explore', { ...base, discovered: 146 }, now)).toBe('Every line found. Play on for the fun of it.');
		expect(statusOf('practice', base, now)).toBe('Nothing to replay yet — explore first.');
		expect(statusOf('practice', { ...base, discovered: 5, due: 1 }, now)).toBe('1 line due now.');
		expect(statusOf('practice', { ...base, discovered: 5, nextDue: new Date('2026-09-18T12:00:00Z') }, now)).toBe('All caught up — the next comes back in 2 days.');
		expect(statusOf('open', base, now)).toBe('Not built yet. Your readiness rating in this opening will come from here.');
	});
});

describe('words', () => {
	it('dueIn and ago read as a person would say them', () => {
		expect(dueIn(new Date('2026-09-16T20:00:00Z'), now)).toBe('later today');
		expect(dueIn(new Date('2026-09-17T12:00:00Z'), now)).toBe('tomorrow');
		expect(dueIn(new Date('2026-09-22T12:00:00Z'), now)).toBe('in 6 days');
		expect(ago(new Date('2026-09-16T11:50:00Z'), now)).toBe('just now');
		expect(ago(new Date('2026-09-16T11:00:00Z'), now)).toBe('an hour ago');
		expect(ago(new Date('2026-09-16T07:00:00Z'), now)).toBe('5 hours ago');
		expect(ago(new Date('2026-09-15T12:00:00Z'), now)).toBe('yesterday');
		expect(ago(new Date('2026-09-11T12:00:00Z'), now)).toBe('5 days ago');
	});

	it('shortName drops the opening family', () => {
		expect(shortName('Ruy Lopez: Closed, Breyer Defense')).toBe('Closed, Breyer Defense');
		expect(shortName('Ruy Lopez')).toBe('Ruy Lopez');
	});
});
