import type { Square } from 'chess.js';

/**
 * Everything a caller can ask the board to show on a square. Callers state
 * *what* a square means; how it looks belongs to the board and the theme.
 */
export type Mark = 'last-move' | 'check' | 'correct' | 'soft' | 'wrong' | 'hint';

export type SquareMarks = Partial<Record<Square, Mark[]>>;

export type Arrow = { from: Square; to: Square; kind?: 'hint' | 'engine' | 'refutation' };

/** Merges mark sets so independent sources (last move, check, drill feedback) compose. */
export function mergeMarks(...sets: SquareMarks[]): SquareMarks {
	const merged: SquareMarks = {};
	for (const set of sets) {
		for (const [square, list] of Object.entries(set) as [Square, Mark[]][]) {
			merged[square] = [...(merged[square] ?? []), ...list];
		}
	}
	return merged;
}

export function markMove(move: { from: Square; to: Square } | null, mark: Mark): SquareMarks {
	return move ? { [move.from]: [mark], [move.to]: [mark] } : {};
}
