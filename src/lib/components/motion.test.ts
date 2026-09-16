import { describe, expect, it } from 'vitest';
import { movedPieces, type Placed } from './motion';

const at = (spec: Record<string, string>): Record<string, Placed> =>
	Object.fromEntries(Object.entries(spec).map(([sq, p]) => [sq, { type: p[1], color: p[0] as 'w' | 'b' }]));

describe('movedPieces', () => {
	it('follows a piece to its new square', () => {
		expect(movedPieces(at({ e2: 'wp', e7: 'bp' }), at({ e4: 'wp', e7: 'bp' }))).toEqual([{ from: 'e2', to: 'e4' }]);
	});

	it('follows the capturing piece, not the captured one', () => {
		expect(movedPieces(at({ d4: 'wp', e5: 'bp' }), at({ e5: 'wp' }))).toEqual([{ from: 'd4', to: 'e5' }]);
	});

	it('tells two of a kind apart by which is nearer', () => {
		expect(movedPieces(at({ b1: 'wn', g1: 'wn' }), at({ b1: 'wn', f3: 'wn' }))).toEqual([{ from: 'g1', to: 'f3' }]);
	});

	it('moves both pieces when castling', () => {
		const moves = movedPieces(at({ e1: 'wk', h1: 'wr' }), at({ g1: 'wk', f1: 'wr' }));
		expect(moves).toHaveLength(2);
		expect(moves).toContainEqual({ from: 'e1', to: 'g1' });
		expect(moves).toContainEqual({ from: 'h1', to: 'f1' });
	});

	it('follows the pawn on en passant and lets the taken one vanish', () => {
		expect(movedPieces(at({ e5: 'wp', d5: 'bp' }), at({ d6: 'wp' }))).toEqual([{ from: 'e5', to: 'd6' }]);
	});

	it('follows a pawn that promotes into the piece it became', () => {
		expect(movedPieces(at({ b7: 'wp' }), at({ b8: 'wq' }))).toEqual([{ from: 'b7', to: 'b8' }]);
	});

	it('animates nothing when the position is replaced wholesale', () => {
		const start = at({ a1: 'wr', b1: 'wn', c1: 'wb', d1: 'wq' });
		expect(movedPieces(start, at({ a8: 'br', b8: 'bn', c8: 'bb', d8: 'bq' }))).toEqual([]);
		expect(movedPieces(start, {})).toEqual([]);
		expect(movedPieces({}, start)).toEqual([]);
	});

	it('animates nothing when nothing changed', () => {
		expect(movedPieces(at({ e2: 'wp' }), at({ e2: 'wp' }))).toEqual([]);
	});
});
