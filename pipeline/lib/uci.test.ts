import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { normalizeCastling } from './uci.ts';

const castleReady = 'r3k2r/pppqbppp/2np1n2/4p3/4P3/2NP1N2/PPPQBPPP/R3K2R';

describe('normalizeCastling', () => {
	it.each([
		['w', 'e1h1', 'e1g1'],
		['w', 'e1a1', 'e1c1'],
		['b', 'e8h8', 'e8g8'],
		['b', 'e8a8', 'e8c8']
	])('%s: %s → %s, and chess.js accepts the result', (side, raw, expected) => {
		const chess = new Chess(`${castleReady} ${side} KQkq - 0 1`);
		const move = normalizeCastling(chess, raw);
		expect(move).toBe(expected);
		expect(() => chess.move({ from: move.slice(0, 2), to: move.slice(2, 4) })).not.toThrow();
	});

	it('leaves a king capturing an enemy rook alone', () => {
		const chess = new Chess('8/8/8/8/8/8/6k1/4K2r w - - 0 1');
		expect(normalizeCastling(chess, 'e1h1')).toBe('e1h1');
	});

	it('leaves ordinary king moves and non-king moves alone', () => {
		const chess = new Chess(`${castleReady} w KQkq - 0 1`);
		expect(normalizeCastling(chess, 'e1f1')).toBe('e1f1');
		expect(normalizeCastling(chess, 'f3e5')).toBe('f3e5');
	});
});
