import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { leadFor, materialOf, VALUES } from './material';

/** The position after a list of SAN moves, as a FEN. */
function after(...moves: string[]): string {
	const chess = new Chess();
	for (const move of moves) chess.move(move);
	return chess.fen();
}

const taken = (fen: string, color: 'w' | 'b') =>
	materialOf(fen)
		.taken[color].map((t) => `${t.count}${t.type}`)
		.join(' ');

describe('an untouched position', () => {
	it('has nothing missing and nobody ahead', () => {
		const material = materialOf(new Chess().fen());
		expect(material.taken).toEqual({ w: [], b: [] });
		expect(material.advantage).toBe(0);
		expect(leadFor(material, 'w')).toBe('');
		expect(leadFor(material, 'b')).toBe('');
	});

	it('is also what an unreadable position gets, rather than a crash', () => {
		for (const fen of [null, undefined, '', '   ']) {
			expect(materialOf(fen)).toEqual({ taken: { w: [], b: [] }, advantage: 0 });
		}
	});
});

describe('what each side has taken', () => {
	it('credits a capture to the side that made it', () => {
		// 1.e4 d5 2.exd5 — White is a pawn up.
		const fen = after('e4', 'd5', 'exd5');
		expect(taken(fen, 'w')).toBe('1p');
		expect(taken(fen, 'b')).toBe('');
		expect(materialOf(fen).advantage).toBe(1);
	});

	it('counts both sides when the trade is even, and calls nobody ahead', () => {
		const fen = after('e4', 'd5', 'exd5', 'Qxd5');
		expect(taken(fen, 'w')).toBe('1p');
		expect(taken(fen, 'b')).toBe('1p');
		const material = materialOf(fen);
		expect(material.advantage).toBe(0);
		expect([leadFor(material, 'w'), leadFor(material, 'b')]).toEqual(['', '']);
	});

	it('lists the most valuable first, which is how the row reads', () => {
		// Hand-built: Black has lost a queen, a rook, a bishop and three pawns.
		const fen = '1nb1k1nr/ppppp3/8/8/8/8/PPPPPPPP/RNBQKBNR w KQk - 0 1';
		expect(taken(fen, 'w')).toBe('1q 1r 1b 3p');
	});

	it('says who is ahead and by how much, from one side only', () => {
		// Black has taken a rook for a pawn: Black is four ahead.
		const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPP1/1NBQKBNR w Kkq - 0 1';
		const material = materialOf(fen);
		expect(material.advantage).toBe(-(VALUES.r + VALUES.p));
		expect(leadFor(material, 'b')).toBe('+6');
		// Never both: the side behind shows nothing at all.
		expect(leadFor(material, 'w')).toBe('');
	});
});

describe('promotion, which is where a naive count goes wrong', () => {
	// 1.h4 g5 2.hxg5 h5 3.g6 h4 4.g7 h3 5.gxh8=Q — White promotes on h8, taking the rook on the way.
	const promoted = after('h4', 'g5', 'hxg5', 'h5', 'g6', 'h4', 'g7', 'h3', 'gxh8=Q');

	it('counts the new queen as the nine she is', () => {
		const material = materialOf(promoted);
		// White: 8 pawns less the three that walked up... counted from the board, not from a history.
		const white = new Chess(promoted).board().flat().filter((s) => s?.color === 'w');
		expect(white.filter((s) => s!.type === 'q')).toHaveLength(2);
		// Two queens, and Black has lost a rook and two pawns for one white pawn.
		expect(material.advantage).toBeGreaterThan(9);
	});

	it('never reports a negative count for a side holding more than it started with', () => {
		const material = materialOf(promoted);
		for (const list of [material.taken.w, material.taken.b]) {
			for (const t of list) expect(t.count).toBeGreaterThan(0);
		}
		// White has two queens, so "queens taken from White" is absent, not -1.
		expect(material.taken.b.some((t) => t.type === 'q')).toBe(false);
	});

	it('shows the promoted pawn as gone, because it is', () => {
		expect(materialOf(promoted).taken.b.some((t) => t.type === 'p')).toBe(true);
	});
});

describe('positions a board is handed rather than plays into', () => {
	it('reads an endgame it never saw the moves for', () => {
		// King and rook against king and knight.
		const fen = '8/8/4k3/8/8/3K4/8/R5n1 w - - 0 1';
		const material = materialOf(fen);
		expect(material.advantage).toBe(VALUES.r - VALUES.n);
		expect(leadFor(material, 'w')).toBe('+2');
		expect(taken(fen, 'w')).toBe('1q 2r 2b 1n 8p');
		expect(taken(fen, 'b')).toBe('1q 1r 2b 2n 8p');
	});

	it('ignores everything after the placement field', () => {
		const board = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
		expect(materialOf(`${board} w KQkq - 0 1`)).toEqual(materialOf(`${board} b - e3 13 47`));
	});

	it('is unmoved by the side to move: material is a fact about the board', () => {
		const fen = after('e4', 'd5', 'exd5');
		const black = fen.replace(' b ', ' w ');
		expect(materialOf(black).advantage).toBe(materialOf(fen).advantage);
	});
});

describe('the whole game through', () => {
	it('never lets the two sides claim the same piece', () => {
		const chess = new Chess();
		const moves = ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Bxc6', 'dxc6', 'Nxe5', 'Qd4', 'Qe2', 'Qxe5'];
		for (const move of moves) {
			chess.move(move);
			const material = materialOf(chess.fen());
			const total = (color: 'w' | 'b') => material.taken[color].reduce((n, t) => n + t.count, 0);
			// 32 pieces at the start; what is gone is what the two sides have taken between them.
			const onBoard = chess.board().flat().filter(Boolean).length;
			expect(total('w') + total('b')).toBe(32 - onBoard);
		}
	});
});
