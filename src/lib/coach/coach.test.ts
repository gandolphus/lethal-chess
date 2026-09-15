import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import type { Analysis, AnalysisLine } from '$lib/chess/engine';
import { MultiPvCollector, parseInfo } from '$lib/chess/engine';
import { FreePlay, type AnalysisEngine } from './freeplay.svelte';
import { lossFor, verdictFor, winChance } from './judge';
import { chooseReply } from './opponent';

const line = (move: string, cp: number, pv: string[] = [move]): AnalysisLine => ({ move, score: { cp }, pv, depth: 20 });

describe('parseInfo', () => {
	it('converts side-to-move scores to White’s point of view', () => {
		const info = 'info depth 18 seldepth 25 multipv 2 score cp 35 nodes 1000 pv e7e5 g1f3';
		expect(parseInfo(info, true)).toMatchObject({ rank: 2, line: { move: 'e7e5', score: { cp: 35 }, depth: 18 } });
		expect(parseInfo(info, false)?.line.score).toEqual({ cp: -35 });
		expect(parseInfo('info depth 30 multipv 1 score mate 3 pv d1h5', false)?.line.score).toEqual({ mate: -3 });
	});

	it('skips bound-only scores and lines without a pv', () => {
		expect(parseInfo('info depth 12 multipv 1 score cp 50 lowerbound pv e2e4', true)).toBeNull();
		expect(parseInfo('info depth 12 currmove e2e4 currmovenumber 1', true)).toBeNull();
	});
});

describe('MultiPvCollector', () => {
	it('uses the deepest complete depth, so a search cut mid-depth cannot list a move twice', () => {
		// Real output seen from Stockfish 18 lite: depth 16 finished ranks 1–4 before movetime expired,
		// leaving rank 5 from depth 15 — where Nc3 sat at rank 5 while it is rank 4 at depth 16.
		const collector = new MultiPvCollector();
		const at = (depth: number, move: string, cp: number): AnalysisLine => ({ move, score: { cp }, pv: [move], depth });
		['f3e5:150', 'f1c4:140', 'd2d4:110', 'd2d3:108', 'b1c3:104'].forEach((m, i) => {
			const [move, cp] = m.split(':');
			collector.add(i + 1, at(15, move, Number(cp)));
		});
		['f3e5:153', 'f1c4:144', 'd2d4:112', 'b1c3:106'].forEach((m, i) => {
			const [move, cp] = m.split(':');
			collector.add(i + 1, at(16, move, Number(cp)));
		});
		const result = collector.result();
		expect(result.map((l) => l.depth)).toEqual([15, 15, 15, 15, 15]);
		expect(new Set(result.map((l) => l.move)).size).toBe(result.length);
	});

	it('takes the deepest depth when it is complete, and handles positions with fewer legal moves', () => {
		const collector = new MultiPvCollector();
		collector.add(1, line('e1g1', 20));
		collector.add(1, { ...line('e1f1', 10), depth: 30 });
		collector.add(2, { ...line('e1g1', 5), depth: 30 });
		expect(collector.result().map((l) => [l.move, l.depth])).toEqual([
			['e1f1', 30],
			['e1g1', 30]
		]);
	});
});

describe('judge', () => {
	it('is symmetric between the sides', () => {
		expect(winChance({ cp: 100 }, 'w')).toBeCloseTo(-winChance({ cp: 100 }, 'b'));
		expect(winChance({ mate: 2 }, 'w')).toBe(1);
		expect(winChance({ mate: -2 }, 'w')).toBe(-1);
	});

	it('judges by lost winning chances, so the same centipawns matter less when already winning', () => {
		const levelLoss = lossFor(line('a', 0), { cp: -150 }, 'w');
		const winningLoss = lossFor(line('a', 800), { cp: 650 }, 'w');
		expect(verdictFor(levelLoss, false)).toBe('mistake');
		expect(verdictFor(winningLoss, false)).toBe('good');
	});

	it('calls the engine’s own best move best regardless of rounding', () => {
		expect(verdictFor(0.05, true)).toBe('best');
	});
});

describe('chooseReply', () => {
	const lines = [line('e7e5', 20), line('c7c5', 30), line('e7e6', 45), line('d7d6', 60), line('g7g5', 250)];

	it('plays natural moves only, from the side that is moving', () => {
		// Black to move: lower White scores are better for Black.
		for (let i = 0; i < 50; i++) {
			const choice = chooseReply(lines, 'b', { mistakeRate: 0, random: () => i / 50 });
			expect(choice.kind).toBe('natural');
			expect(['e7e5', 'c7c5', 'e7e6', 'd7d6']).toContain(choice.line.move);
		}
	});

	it('plants a real mistake when the dice say so and one is available', () => {
		const choice = chooseReply(lines, 'b', { mistakeRate: 1, random: () => 0 });
		expect(choice).toMatchObject({ kind: 'mistake' });
		expect(choice.line.move).toBe('g7g5');
	});

	it('falls back to a natural move when no candidate is a plausible mistake', () => {
		expect(chooseReply(lines.slice(0, 2), 'b', { mistakeRate: 1, random: () => 0 }).kind).toBe('natural');
	});
});

/** Scripted engine: analyses keyed by position (EPD), recorded in call order. */
function scriptedEngine(script: Record<string, AnalysisLine[]>): AnalysisEngine & { calls: string[] } {
	const calls: string[] = [];
	return {
		calls,
		analyse: async (fen: string): Promise<Analysis> => {
			const epd = fen.split(' ').slice(0, 4).join(' ');
			calls.push(epd);
			return { fen, lines: script[epd] ?? [] };
		}
	};
}

const epd = (...moves: string[]) => {
	const chess = new Chess();
	for (const m of moves) chess.move({ from: m.slice(0, 2), to: m.slice(2, 4) });
	return chess.fen().split(' ').slice(0, 4).join(' ');
};

describe('FreePlay', () => {
	const noWait = async () => {};

	it('scores a checkmate the pre-move analysis missed as a win, not 0.00', async () => {
		// The engine sends no lines for a mated position; Qh4# wasn't among the candidates before it.
		const engine = scriptedEngine({ [epd('f2f3', 'e7e5', 'g2g4')]: [line('b8c6', -50)] });
		const play = new FreePlay({ engine, startMoves: ['f2f3', 'e7e5', 'g2g4'], side: 'b', random: () => 0, wait: noWait });
		await play.start();
		expect(await play.submit('d8', 'h4')).toBe('best');
		expect(play.phase).toBe('over');
		expect(play.evaluation).toEqual({ mate: -1 });
		expect(play.game.history.at(-1)).toBe('Qh4#');
	});

	it('grades the learner’s move and answers with a natural reply', async () => {
		const engine = scriptedEngine({
			[epd('e2e4', 'e7e5')]: [line('g1f3', 30), line('b1c3', 25), line('f1c4', 20)],
			[epd('e2e4', 'e7e5', 'g1f3')]: [line('b8c6', 30), line('g8f6', 35)],
			[epd('e2e4', 'e7e5', 'g1f3', 'b8c6')]: [line('f1b5', 30)]
		});
		const play = new FreePlay({ engine, startMoves: ['e2e4', 'e7e5'], side: 'w', random: () => 0, wait: noWait });
		await play.start();
		expect(play.phase).toBe('your-move');

		expect(await play.submit('g1', 'f3')).toBe('best');
		expect(play.game.history).toEqual(['e4', 'e5', 'Nf3', 'Nc6']);
		expect(play.phase).toBe('your-move');
		expect(play.message?.text).toBe('Best move.');
	});

	it('tracks the evaluation of the position on the board for the eval bar', async () => {
		const engine = scriptedEngine({
			[epd('e2e4', 'e7e5')]: [line('g1f3', 30)],
			[epd('e2e4', 'e7e5', 'd1h5')]: [line('b8c6', -150)],
			[epd('e2e4', 'e7e5', 'd1h5', 'b8c6')]: [line('f1c4', -140)]
		});
		const play = new FreePlay({ engine, startMoves: ['e2e4', 'e7e5'], side: 'w', random: () => 0, wait: noWait });
		await play.start();
		expect(play.evaluation).toEqual({ cp: 30 });
		await play.submit('d1', 'h5');
		expect(play.evaluation).toEqual({ cp: -140 });
	});

	it('names the better move after an error, and it is not "best"', async () => {
		const engine = scriptedEngine({
			[epd('e2e4', 'e7e5')]: [line('g1f3', 30), line('d1h5', -150)],
			[epd('e2e4', 'e7e5', 'd1h5')]: [line('b8c6', -150)],
			[epd('e2e4', 'e7e5', 'd1h5', 'b8c6')]: [line('f1c4', -150)]
		});
		const play = new FreePlay({ engine, startMoves: ['e2e4', 'e7e5'], side: 'w', random: () => 0, wait: noWait });
		await play.start();
		// +0.30 → −1.50 drops White's winning chances by ~0.33: past Lichess's 0.3 blunder line.
		expect(await play.submit('d1', 'h5')).toBe('blunder');
		expect(play.message?.text).toContain('Nf3 was much better');
	});

	it('plants a mistake, makes the learner retry a miss, then reveals the punishment', async () => {
		// White (learner) plays Nf3; the computer blunders with ...f6?; Nxe5! is the punishment.
		const engine = scriptedEngine({
			[epd('e2e4', 'e7e5')]: [line('g1f3', 30)],
			[epd('e2e4', 'e7e5', 'g1f3')]: [line('b8c6', 30), line('f7f6', 200)],
			[epd('e2e4', 'e7e5', 'g1f3', 'f7f6')]: [line('f3e5', 250), line('f1c4', 190), line('h2h3', 80)],
			[epd('e2e4', 'e7e5', 'g1f3', 'f7f6', 'h2h3')]: [line('d7d6', 80)],
			[epd('e2e4', 'e7e5', 'g1f3', 'f7f6', 'f3e5')]: [line('f6e5', 250)],
			[epd('e2e4', 'e7e5', 'g1f3', 'f7f6', 'f3e5', 'f6e5')]: [line('d1h5', 400)]
		});
		const play = new FreePlay({
			engine,
			startMoves: ['e2e4', 'e7e5'],
			side: 'w',
			mistakeRate: 1,
			random: () => 0,
			wait: noWait
		});
		await play.start();
		await play.submit('g1', 'f3');
		expect(play.game.history.at(-1)).toBe('f6');
		expect(play.opportunity?.san).toBe('f6');

		expect(await play.submit('h2', 'h3')).toBe('mistake');
		expect(play.phase).toBe('retry');
		expect(play.game.history.at(-1)).toBe('f6'); // the miss was taken back
		expect(play.message?.text).toContain('missed an opportunity');

		await play.submit('h2', 'h3');
		expect(play.phase).toBe('reveal');
		expect(play.arrows).toEqual([{ from: 'f3', to: 'e5', kind: 'hint' }]);

		expect(await play.submit('f1', 'c4')).toBeNull(); // only the shown move is accepted now
		expect(await play.submit('f3', 'e5')).toBe('best');
		expect(play.message?.text).toContain('Punished');
	});

	it('does not flag an opportunity when the planted "mistake" gains the learner little', async () => {
		const engine = scriptedEngine({
			[epd('e2e4', 'e7e5')]: [line('g1f3', 30)],
			// Black's worse move only concedes 0.6 pawns, which at +0.3 is below the opportunity threshold.
			[epd('e2e4', 'e7e5', 'g1f3')]: [line('b8c6', 30), line('d7d6', 200)],
			[epd('e2e4', 'e7e5', 'g1f3', 'd7d6')]: [line('d2d4', 60)]
		});
		const play = new FreePlay({ engine, startMoves: ['e2e4', 'e7e5'], side: 'w', mistakeRate: 1, random: () => 0, wait: noWait });
		await play.start();
		await play.submit('g1', 'f3');
		expect(play.game.history.at(-1)).toBe('d6');
		expect(play.opportunity).toBeNull();
	});

	it('survives an analysis that returns no lines instead of crashing', async () => {
		const engine = scriptedEngine({
			[epd('e2e4', 'e7e5')]: [line('g1f3', 30)],
			[epd('e2e4', 'e7e5', 'g1f3')]: [line('b8c6', 30), line('f7f6', 200)]
			// Nothing scripted after ...f6: the engine returns no lines there.
		});
		const play = new FreePlay({ engine, startMoves: ['e2e4', 'e7e5'], side: 'w', mistakeRate: 1, random: () => 0, wait: noWait });
		await play.start();
		await expect(play.submit('g1', 'f3')).resolves.toBe('best');
		expect(play.opportunity).toBeNull();
	});

	it('lets the computer move first when the line ended on its turn', async () => {
		const engine = scriptedEngine({
			[epd('e2e4')]: [line('e7e5', 30)],
			[epd('e2e4', 'e7e5')]: [line('g1f3', 30)]
		});
		const play = new FreePlay({ engine, startMoves: ['e2e4'], side: 'w', random: () => 0, wait: noWait });
		await play.start();
		expect(play.game.history).toEqual(['e4', 'e5']);
		expect(play.phase).toBe('your-move');
	});
});
