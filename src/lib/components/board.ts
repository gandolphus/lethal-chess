import type { Square } from 'chess.js';

/**
 * Everything a caller can ask the board to show on a square. Callers state
 * *what* a square means; how it looks belongs to the board and the theme.
 */
export type Mark = 'last-move' | 'check' | 'correct' | 'soft' | 'wrong' | 'hint';

export type SquareMarks = Partial<Record<Square, Mark[]>>;

export type Arrow = { from: Square; to: Square; kind?: 'hint' | 'engine' | 'refutation' | 'drawn' };

/**
 * What the learner has drawn on the board with the right button: squares they marked and arrows they
 * dragged. Theirs, not the app's — so it is kept apart from `marks` and `arrows`, which are the coach's,
 * and it is cleared the moment the position changes, because it was about *this* position.
 */
export type Notes = { squares: Square[]; arrows: { from: Square; to: Square }[] };

export const noNotes = (): Notes => ({ squares: [], arrows: [] });

/** Marking a square twice unmarks it, so the gesture that made a mark is the one that takes it away. */
export function toggleSquare(notes: Notes, square: Square): Notes {
	const marked = notes.squares.includes(square);
	return { ...notes, squares: marked ? notes.squares.filter((s) => s !== square) : [...notes.squares, square] };
}

/** The same for an arrow, matched both ways round: b1→c3 and c3→b1 are different arrows. */
export function toggleArrow(notes: Notes, from: Square, to: Square): Notes {
	const drawn = notes.arrows.some((a) => a.from === from && a.to === to);
	return {
		...notes,
		arrows: drawn ? notes.arrows.filter((a) => a.from !== from || a.to !== to) : [...notes.arrows, { from, to }]
	};
}

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
