// Compact encodings shared by the offline data pipeline.
//
// Moves: uint16 = from (6 bits) | to (6 bits) << 6 | promotion (3 bits) << 12.
// 0 is never a legal move (a1a1), so it doubles as "no move".
//
// Scores: int16, always from White's point of view (the eval db's convention).
// Centipawns are clamped to ±CP_LIMIT; mate in n is stored as ±(MATE - |n|),
// so every mate outranks every centipawn score and shorter mates rank higher.

const PROMOTIONS = ['', 'n', 'b', 'r', 'q'];

export const NO_MOVE = 0;
export const CP_LIMIT = 30000;
export const MATE = 32000;

export type Score = { cp: number } | { mate: number };

// Validates file and rank separately: a combined range check would accept "i2",
// whose off-board file wraps into a valid-looking index. Returns -1 when invalid.
function squareIndex(uci: string, at: number): number {
	const file = uci.charCodeAt(at) - 97;
	const rank = uci.charCodeAt(at + 1) - 49;
	return file >= 0 && file <= 7 && rank >= 0 && rank <= 7 ? file + rank * 8 : -1;
}

export function encodeMove(uci: string): number {
	const from = squareIndex(uci, 0);
	const to = squareIndex(uci, 2);
	const promotion = uci.length === 5 ? PROMOTIONS.indexOf(uci[4]) : uci.length === 4 ? 0 : -1;
	if (from < 0 || to < 0 || promotion < 0) throw new Error(`Invalid UCI move: ${uci}`);
	return from | (to << 6) | (promotion << 12);
}

export function decodeMove(encoded: number): string {
	const square = (index: number) =>
		String.fromCharCode(97 + (index % 8)) + String.fromCharCode(49 + Math.floor(index / 8));
	return square(encoded & 63) + square((encoded >> 6) & 63) + PROMOTIONS[(encoded >> 12) & 7];
}

export function encodeScore(score: Score): number {
	if ('mate' in score) return score.mate > 0 ? MATE - score.mate : -MATE - score.mate;
	return Math.max(-CP_LIMIT, Math.min(CP_LIMIT, Math.round(score.cp)));
}

export function decodeScore(encoded: number): Score {
	if (encoded > CP_LIMIT) return { mate: MATE - encoded };
	if (encoded < -CP_LIMIT) return { mate: -MATE - encoded };
	return { cp: encoded };
}

/** FEN → EPD: board, side, castling, en passant. Move counters would split transpositions. */
export const toEpd = (fen: string) => fen.split(' ').slice(0, 4).join(' ');
