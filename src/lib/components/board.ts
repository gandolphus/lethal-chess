import type { Square } from 'chess.js';

/**
 * Everything a caller can ask the board to show on a square. Callers state
 * *what* a square means; how it looks belongs to the board and the theme.
 */
export type Mark = 'last-move' | 'check' | 'correct' | 'soft' | 'wrong' | 'hint';

export type SquareMarks = Partial<Record<Square, Mark[]>>;

export type Arrow = { from: Square; to: Square; kind?: 'hint' | 'engine' | 'refutation' | 'drawn'; pen?: Pen };

/**
 * Which of the four pens a mark was made with. They carry no meaning the app knows about — they are for
 * the learner to mean something by. Held apart from the coach's green, red and blue so that a square
 * someone marked as a worry can never be read as the engine calling it sound.
 */
export type Pen = 1 | 2 | 3 | 4;

/** No modifier, then Shift, Alt and the two together — the arrangement chess players already know. */
export const penOf = (event: { shiftKey: boolean; altKey: boolean }): Pen =>
	event.shiftKey && event.altKey ? 4 : event.shiftKey ? 2 : event.altKey ? 3 : 1;

/**
 * What the learner has drawn on the board with the right button: squares they marked and arrows they
 * dragged. Theirs, not the app's — so it is kept apart from `marks` and `arrows`, which are the coach's,
 * and it is cleared the moment the position changes, because it was about *this* position.
 */
export type Notes = { squares: { square: Square; pen: Pen }[]; arrows: { from: Square; to: Square; pen: Pen }[] };

export const noNotes = (): Notes => ({ squares: [], arrows: [] });

/**
 * Marking a square again in the same pen unmarks it, so the gesture that made a mark is the one that
 * takes it away; marking it in a different pen recolours it rather than stacking a second mark on it.
 */
export function toggleSquare(notes: Notes, square: Square, pen: Pen = 1): Notes {
	const marked = notes.squares.find((s) => s.square === square);
	const without = notes.squares.filter((s) => s.square !== square);
	return { ...notes, squares: marked?.pen === pen ? without : [...without, { square, pen }] };
}

/** The same for an arrow. b1→c3 and c3→b1 are different arrows. */
export function toggleArrow(notes: Notes, from: Square, to: Square, pen: Pen = 1): Notes {
	const drawn = notes.arrows.find((a) => a.from === from && a.to === to);
	const without = notes.arrows.filter((a) => a.from !== from || a.to !== to);
	return { ...notes, arrows: drawn?.pen === pen ? without : [...without, { from, to, pen }] };
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
