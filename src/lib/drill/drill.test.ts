import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import type { Bundle, BundleNode } from './bundle';
import { gradeMove } from './grade';
import { ratingFor, Rating } from './scheduler';
import { DrillSession, type Attempt } from './session.svelte';
import { cardsBelow, childEpd, toEpd } from './tree';

const epdAfter = (...moves: string[]) => {
	const chess = new Chess();
	for (const m of moves) chess.move({ from: m.slice(0, 2), to: m.slice(2, 4) });
	return toEpd(chess.fen());
};

const cand = (uci: string, san: string, cp: number) => ({ uci, san, score: { cp } });

// A tiny White repertoire: 1.e4 e5 2.Nf3, then Black replies Nc6 (→ 3.Bb5) or Nf6 (→ 3.Nxe5).
function fixture(): Bundle {
	const root = epdAfter('e2e4', 'e7e5');
	const afterNf3 = epdAfter('e2e4', 'e7e5', 'g1f3');
	const afterNc6 = epdAfter('e2e4', 'e7e5', 'g1f3', 'b8c6');
	const afterNf6 = epdAfter('e2e4', 'e7e5', 'g1f3', 'g8f6');
	const node = (epd: string, ply: number, extra: Partial<BundleNode>): BundleNode => ({
		epd,
		ply,
		depth: 30,
		candidates: [],
		line: [],
		...extra
	});
	return {
		id: 'fixture',
		name: 'Fixture',
		side: 'w',
		rootMoves: ['e2e4', 'e7e5'],
		rootEpd: root,
		nodes: {
			[root]: node(root, 2, {
				// Engine slightly prefers Nc3; theory move Nf3 is the repertoire move.
				candidates: [cand('b1c3', 'Nc3', 40), cand('g1f3', 'Nf3', 30), cand('d2d4', 'd4', 10), cand('f2f4', 'f4', -50)],
				move: cand('g1f3', 'Nf3', 30)
			}),
			[afterNf3]: node(afterNf3, 3, {
				name: "King's Knight Opening",
				replies: [
					{ uci: 'b8c6', san: 'Nc6', weight: 0.7 },
					{ uci: 'g8f6', san: 'Nf6', weight: 0.3 }
				]
			}),
			[afterNc6]: node(afterNc6, 4, { candidates: [cand('f1b5', 'Bb5', 30)], move: cand('f1b5', 'Bb5', 30) }),
			[afterNf6]: node(afterNf6, 4, {
				name: 'Petrov Defense',
				candidates: [cand('f3e5', 'Nxe5', 35)],
				move: cand('f3e5', 'Nxe5', 35)
			})
		},
		tolerances: { soundCp: 35, replyCp: 60 },
		stats: { learnerNodes: 3, opponentNodes: 1, maxPly: 4, missingEvals: 0 },
		source: { evalCacheRecords: 0, builtAt: '' }
	};
}

const noWait = async () => {};

describe('gradeMove', () => {
	const root = fixture().nodes[epdAfter('e2e4', 'e7e5')];

	it('passes the repertoire move', () => {
		expect(gradeMove(root, 'g1f3', 35).kind).toBe('pass');
	});

	it('calls the engine best "soft" even though the repertoire prefers theory', () => {
		expect(gradeMove(root, 'b1c3', 35)).toMatchObject({ kind: 'soft', costCp: 0 });
	});

	it('fails a known unsound candidate with its exact cost', () => {
		expect(gradeMove(root, 'f2f4', 35)).toMatchObject({ kind: 'fail', costCp: 90 });
	});

	it('fails an unknown move with a lower bound on its cost', () => {
		expect(gradeMove(root, 'a2a3', 35)).toMatchObject({ kind: 'fail', costCp: null, atLeastCp: 90 });
	});

	it('scores from Black’s side on Black nodes', () => {
		const black: BundleNode = {
			epd: epdAfter('e2e4'),
			ply: 1,
			depth: 30,
			line: [],
			candidates: [cand('c7c5', 'c5', 30), cand('e7e6', 'e6', 60), cand('g7g5', 'g5', 150)],
			move: cand('c7c5', 'c5', 30)
		};
		expect(gradeMove(black, 'e7e6', 35)).toMatchObject({ kind: 'soft', costCp: 30 });
		expect(gradeMove(black, 'g7g5', 35)).toMatchObject({ kind: 'fail', costCp: 120 });
	});
});

describe('ratingFor', () => {
	it('maps first-attempt outcomes to FSRS ratings', () => {
		const root = fixture().nodes[epdAfter('e2e4', 'e7e5')];
		expect(ratingFor(gradeMove(root, 'g1f3', 35))).toBe(Rating.Good);
		expect(ratingFor(gradeMove(root, 'b1c3', 35))).toBe(Rating.Hard);
		expect(ratingFor(gradeMove(root, 'a2a3', 35))).toBe(Rating.Again);
	});
});

describe('cardsBelow', () => {
	it('collects the learner cards reachable from each node', () => {
		const bundle = fixture();
		const below = cardsBelow(bundle);
		expect(below.get(bundle.rootEpd)?.size).toBe(3);
		expect([...below.get(epdAfter('e2e4', 'e7e5', 'g1f3'))!]).toHaveLength(2);
		expect(childEpd(bundle.rootEpd, 'g1f3')).toBe(epdAfter('e2e4', 'e7e5', 'g1f3'));
	});
});

describe('DrillSession', () => {
	it('walks a line: pass, opponent reply, pass, done — recording and scheduling each card', async () => {
		const attempts: Attempt[] = [];
		const reviewed: string[] = [];
		const session = new DrillSession({
			bundle: fixture(),
			mode: 'practice',
			onAttempt: (a) => attempts.push(a),
			onReview: (epd) => reviewed.push(epd),
			random: () => 0, // always the first (heaviest) reply
			wait: noWait
		});

		await session.start();
		expect(session.phase).toBe('await');

		await session.submit('g1', 'f3');
		expect(session.game.history).toEqual(['e4', 'e5', 'Nf3', 'Nc6']);
		expect(session.name).toBe("King's Knight Opening");
		expect(session.phase).toBe('await');

		await session.submit('f1', 'b5');
		expect(session.phase).toBe('done');
		expect(attempts.map((a) => a.grade)).toEqual(['pass', 'pass']);
		expect(reviewed).toHaveLength(2);
	});

	it('gives one unhinted retry after a failure, then reveals with an arrow', async () => {
		const attempts: Attempt[] = [];
		const session = new DrillSession({ bundle: fixture(), mode: 'practice', onAttempt: (a) => attempts.push(a), wait: noWait });
		await session.start();

		await session.submit('a2', 'a3');
		expect(session.phase).toBe('retry');
		expect(session.arrows).toEqual([]);
		expect(session.game.history).toEqual(['e4', 'e5']); // the wrong move is not played

		await session.submit('h2', 'h3');
		expect(session.phase).toBe('reveal');
		expect(session.arrows).toEqual([{ from: 'g1', to: 'f3', kind: 'hint' }]);

		await session.submit('g1', 'f3');
		expect(attempts.map((a) => [a.grade, a.attemptNo])).toEqual([
			['fail', 1],
			['fail', 2],
			['pass', 3]
		]);
	});

	it('schedules a failed-then-corrected card by its first attempt (Again), not the final pass', async () => {
		const now = new Date('2026-09-15T12:00:00Z');
		const due: Date[] = [];
		const session = new DrillSession({
			bundle: fixture(),
			mode: 'practice',
			now: () => now,
			onReview: (_, state) => due.push(state.due),
			wait: noWait
		});
		await session.start();
		await session.submit('a2', 'a3');
		await session.submit('g1', 'f3');
		// On a first review ts-fsrs gives the same reps/lapses for Again, Hard and Good,
		// so compare due dates, which differ per rating.
		const { review, Rating } = await import('./scheduler');
		expect(due).toEqual([review(undefined, Rating.Again, now).due]);
		expect(due[0]).not.toEqual(review(undefined, Rating.Good, now).due);
	});

	it('measures each attempt’s response time from the previous attempt', async () => {
		let clock = 0;
		const attempts: Attempt[] = [];
		const session = new DrillSession({
			bundle: fixture(),
			mode: 'practice',
			now: () => new Date(clock),
			onAttempt: (a) => attempts.push(a),
			wait: noWait
		});
		await session.start();
		clock = 500;
		await session.submit('a2', 'a3');
		clock = 1200;
		await session.submit('g1', 'f3');
		expect(attempts.map((a) => a.responseMs)).toEqual([500, 700]);
	});

	it('shows the move in learn mode and never schedules', async () => {
		const reviewed: string[] = [];
		const session = new DrillSession({ bundle: fixture(), mode: 'learn', onReview: (e) => reviewed.push(e), wait: noWait });
		await session.start();
		expect(session.arrows).toEqual([{ from: 'g1', to: 'f3', kind: 'hint' }]);
		await session.submit('g1', 'f3');
		expect(reviewed).toEqual([]);
	});

	it('steers the opponent toward branches with due cards', async () => {
		const bundle = fixture();
		const now = new Date('2026-09-15T12:00:00Z');
		const later = new Date('2026-10-15T12:00:00Z');
		// Every card is scheduled far in the future except the Petrov branch's card.
		const { review } = await import('./scheduler');
		const cards = new Map([
			[bundle.rootEpd, { ...review(undefined, Rating.Good, now), due: later }],
			[epdAfter('e2e4', 'e7e5', 'g1f3', 'b8c6'), { ...review(undefined, Rating.Good, now), due: later }]
		]);
		const session = new DrillSession({ bundle, mode: 'practice', cards, now: () => now, random: () => 0.35, wait: noWait });
		await session.start();
		await session.submit('g1', 'f3');
		// Weights 0.7 vs 0.3 alone would pick Nc6 at 0.35; the due Petrov card outweighs it.
		expect(session.game.history.at(-1)).toBe('Nf6');
		expect(session.name).toBe('Petrov Defense');
	});

	it('plays the main line on a guided first walk, whatever the dice say', async () => {
		for (const random of [0, 0.5, 0.99]) {
			const session = new DrillSession({ bundle: fixture(), mode: 'learn', guided: true, random: () => random, wait: noWait });
			await session.start();
			await session.submit('g1', 'f3');
			expect(session.game.history.at(-1)).toBe('Nc6'); // the 0.7-weight reply, never the 0.3 one
		}
	});

	it('names the played move even when the engine never considered it', async () => {
		const session = new DrillSession({ bundle: fixture(), mode: 'practice', wait: noWait });
		await session.start();
		await session.submit('a2', 'a3');
		expect(session.lastGrade?.kind).toBe('fail');
		expect(session.lastGrade?.kind === 'fail' && session.lastGrade.played).toBeNull();
		expect(session.lastPlayedSan).toBe('a3');
	});

	it('ignores illegal and out-of-turn submissions', async () => {
		const session = new DrillSession({ bundle: fixture(), mode: 'practice', wait: noWait });
		await session.start();
		expect(await session.submit('e4', 'e6')).toBeNull();
		expect(session.phase).toBe('await');
	});
});

describe('proficiency', () => {
	it('does not count a just-failed card as remembered', async () => {
		const { proficiency } = await import('./progress');
		const { review } = await import('./scheduler');
		const bundle = fixture();
		const now = new Date('2026-09-15T12:00:00Z');
		const failed = review(undefined, Rating.Again, now); // still in learning, recall ≈ 1 right now
		const cards = new Map([[bundle.rootEpd, failed]]);
		const stats = proficiency(bundle, cards, [], now);
		expect(stats.retention).toBe(0);
	});
});
