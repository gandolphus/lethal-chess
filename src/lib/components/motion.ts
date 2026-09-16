/**
 * Which pieces moved between two placements.
 *
 * The board is given a position, not a move, so movement is inferred from the squares that changed: every
 * arrival is matched to a departure of the same colour, preferring the same kind of piece and then the
 * nearest one, which is what tells two knights apart. A pawn arriving as something else is a promotion.
 *
 * Only a single move's worth of change animates. Anything larger is a new position rather than a move —
 * a fresh game, a jump down a line — and sliding pieces across it would be a lie about what happened.
 */

export type Placed = { type: string; color: 'w' | 'b' };

const file = (square: string) => square.charCodeAt(0);
const rank = (square: string) => Number(square[1]);
const distance = (a: string, b: string) => Math.abs(file(a) - file(b)) + Math.abs(rank(a) - rank(b));

/** The most squares a legal move can empty: a capture empties two, castling moves two. */
const SINGLE_MOVE = 2;

export function movedPieces(before: Record<string, Placed>, after: Record<string, Placed>): { from: string; to: string }[] {
	const gone: { square: string; piece: Placed }[] = [];
	const came: { square: string; piece: Placed }[] = [];

	for (const square of new Set([...Object.keys(before), ...Object.keys(after)])) {
		const was = before[square];
		const is = after[square];
		const same = was && is && was.type === is.type && was.color === is.color;
		if (was && !same) gone.push({ square, piece: was });
		if (is && !same) came.push({ square, piece: is });
	}

	if (!came.length || gone.length > SINGLE_MOVE || came.length > SINGLE_MOVE) return [];

	const moves: { from: string; to: string }[] = [];
	for (const arrival of came) {
		const sameKind = gone.filter((g) => g.piece.color === arrival.piece.color && g.piece.type === arrival.piece.type);
		const promoted = gone.filter((g) => g.piece.color === arrival.piece.color && g.piece.type === 'p');
		const pool = sameKind.length ? sameKind : promoted;
		if (!pool.length) continue;
		const from = pool.reduce((best, g) => (distance(g.square, arrival.square) < distance(best.square, arrival.square) ? g : best));
		moves.push({ from: from.square, to: arrival.square });
		gone.splice(gone.indexOf(from), 1);
	}
	return moves;
}
