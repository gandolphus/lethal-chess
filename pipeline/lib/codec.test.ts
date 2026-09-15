import { describe, expect, it } from 'vitest';
import { CP_LIMIT, decodeMove, decodeScore, encodeMove, encodeScore, toEpd } from './codec.ts';

describe('move codec', () => {
	it.each(['e2e4', 'a1h8', 'h8a1', 'e1g1', 'e7e8q', 'b2a1n', 'g7g8r', 'c2c1b'])('round-trips %s', (uci) => {
		expect(decodeMove(encodeMove(uci))).toBe(uci);
	});

	it('never encodes a real move as 0', () => {
		expect(encodeMove('a1a2')).not.toBe(0);
	});

	it.each(['e9e4', 'i2i4', 'e7e8k', ''])('rejects %j', (uci) => {
		expect(() => encodeMove(uci)).toThrow();
	});
});

describe('score codec', () => {
	it.each([0, 39, -39, 1500, -1500])('round-trips %i cp', (cp) => {
		expect(decodeScore(encodeScore({ cp }))).toEqual({ cp });
	});

	it('clamps centipawns so they cannot collide with mate scores', () => {
		expect(decodeScore(encodeScore({ cp: 99999 }))).toEqual({ cp: CP_LIMIT });
		expect(decodeScore(encodeScore({ cp: -99999 }))).toEqual({ cp: -CP_LIMIT });
	});

	it.each([1, 3, 12, -1, -3, -12])('round-trips mate %i', (mate) => {
		expect(decodeScore(encodeScore({ mate }))).toEqual({ mate });
	});

	it('orders scores the way a player would', () => {
		const order = [{ mate: -1 }, { mate: -5 }, { cp: -CP_LIMIT }, { cp: 0 }, { cp: CP_LIMIT }, { mate: 5 }, { mate: 1 }];
		const encoded = order.map(encodeScore);
		expect([...encoded].sort((a, b) => a - b)).toEqual(encoded);
	});
});

describe('toEpd', () => {
	it('drops the move counters only', () => {
		expect(toEpd('rnbqkbnr/1pp1pppp/p7/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3')).toBe(
			'rnbqkbnr/1pp1pppp/p7/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6'
		);
	});
});
