// Correctness audit 2026-09-16: demonstrations of chess-judging defects. Each `it.fails` test
// fails against the current code; it is marked so the suite stays green until the defect is fixed.

import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import type { Analysis, AnalysisLine } from '$lib/chess/engine';
import { FreePlay, type AnalysisEngine } from './freeplay.svelte';
import { winChance } from './judge';

const line = (move: string, cp: number): AnalysisLine => ({ move, score: { cp }, pv: [move], depth: 20 });

function scriptedEngine(script: Record<string, AnalysisLine[]>): AnalysisEngine {
	return {
		analyse: async (fen: string): Promise<Analysis> => ({ fen, lines: script[fen.split(' ').slice(0, 4).join(' ')] ?? [] })
	};
}

const epd = (...moves: string[]) => {
	const chess = new Chess();
	for (const m of moves) chess.move({ from: m.slice(0, 2), to: m.slice(2, 4) });
	return chess.fen().split(' ').slice(0, 4).join(' ');
};

describe('grading a move that ends the game in a draw', () => {
	// Nf3 Nf6 Ng1 Ng8 Nf3 Nf6 Ng1: the start position has occurred twice; ...Ng8 makes it three.
	const SHUFFLE = ['g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1'];

	it.fails('scores a threefold repetition from the pre-move analysis, so throwing away a win is "best"', async () => {
		// Stockfish sees only the FEN, not the history, so the repeating move carries its full winning score.
		const engine = scriptedEngine({ [epd(...SHUFFLE)]: [line('f6g8', -300), line('e7e5', -250)] });
		const play = new FreePlay({ engine, startMoves: SHUFFLE, side: 'b', random: () => 0, wait: async () => {} });
		await play.start();
		const verdict = await play.submit('f6', 'g8');
		expect(play.game.status).toBe('draw');
		// Black was winning by three pawns and drew: a blunder by the coach's own scale (0.5 win chance lost).
		expect(verdict).toBe('blunder');
		expect(play.evaluation).toEqual({ cp: 0 });
	});
});

describe('winChance', () => {
	// Latent: nothing in the app produces `mate: 0` today (Stockfish sends it without a pv, which
	// parseInfo skips), but the model reads it as a level position rather than a loss for the side to move.
	it.fails('treats mate 0 as decided, not level', () => {
		expect(Math.abs(winChance({ mate: 0 }, 'w'))).toBe(1);
	});
});
