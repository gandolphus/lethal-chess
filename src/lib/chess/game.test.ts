import { describe, expect, it } from 'vitest';
import { Game, parseUci, toUci } from './game.svelte';

describe('Game', () => {
	it('returns the played move, or null for an illegal one', () => {
		const game = new Game();
		expect(game.move({ from: 'e2', to: 'e4' })?.san).toBe('e4');
		expect(game.move({ from: 'e4', to: 'e6' })).toBeNull();
		expect(game.history).toEqual(['e4']);
	});

	it('judges a move without playing it', () => {
		const game = new Game();
		expect(game.find({ from: 'g1', to: 'f3' })?.san).toBe('Nf3');
		expect(game.find({ from: 'g1', to: 'g3' })).toBeNull();
		expect(game.history).toEqual([]);
	});

	it('loads a line mid-game with real history and last move', () => {
		const game = new Game();
		game.load(['c2c4', 'e7e5', 'b1c3', 'g8f6']);
		expect(game.history).toEqual(['c4', 'e5', 'Nc3', 'Nf6']);
		expect(game.lastMove).toEqual({ from: 'g8', to: 'f6' });
		expect(game.turn).toBe('w');
	});

	it('throws on an illegal line instead of stopping short', () => {
		const game = new Game();
		expect(() => game.load(['e2e4', 'e2e4'])).toThrow(/Illegal move e2e4/);
		expect(game.history).toEqual([]);
	});

	it('restores the previous last move on undo', () => {
		const game = new Game();
		game.load(['e2e4', 'c7c5']);
		game.undo();
		expect(game.lastMove).toEqual({ from: 'e2', to: 'e4' });
	});

	it('handles promotion, defaulting to a queen and honouring underpromotion', () => {
		const fen = '8/P7/8/8/8/8/6k1/4K3 w - - 0 1';
		expect(new Game(fen).move({ from: 'a7', to: 'a8' })?.san).toBe('a8=Q+');
		expect(new Game(fen).move({ from: 'a7', to: 'a8', promotion: 'n' })?.san).toBe('a8=N');
	});

	it('detects checkmate and marks the mated king', () => {
		const game = new Game();
		game.load(['f2f3', 'e7e5', 'g2g4', 'd8h4']);
		expect(game.status).toBe('checkmate');
		expect(game.checkSquare).toBe('e1');
	});
});

describe('uci helpers', () => {
	it('round-trips', () => {
		expect(toUci(parseUci('e7e8q'))).toBe('e7e8q');
		expect(parseUci('g1f3')).toEqual({ from: 'g1', to: 'f3', promotion: undefined });
	});
});
