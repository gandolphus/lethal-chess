/**
 * What is missing from a position, and who is ahead by it.
 *
 * Read straight off the FEN's placement field rather than from a move history: a board is often handed a
 * position it did not play into — a line picked up off the map, a review that starts mid-game, a bundle's
 * root — and a count of what is on the board is true for all of them.
 */

export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export type Color = 'w' | 'b';

/** The ordinary relative values. The king has none: it is never captured and never missing. */
export const VALUES: Record<PieceType, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

/** What each side starts with. */
const START: Record<PieceType, number> = { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 };

/** Most valuable first, which is how a captured row reads. */
const ORDER: PieceType[] = ['q', 'r', 'b', 'n', 'p'];

const TYPES = new Set<string>(['p', 'n', 'b', 'r', 'q', 'k']);

export type Taken = { type: PieceType; count: number };

export type Material = {
	/** What each colour has taken: `w` is the black pieces White has captured, most valuable first. */
	taken: Record<Color, Taken[]>;
	/**
	 * Net value in pawns, positive when White is ahead. Counted from the pieces *present*, not from the
	 * ones taken, so a promotion shows up as the gain it is: a new queen is nine on the board whether or
	 * not anything was captured to get her there.
	 */
	advantage: number;
};

const none = (): Material => ({ taken: { w: [], b: [] }, advantage: 0 });

/** Pieces on the board, by colour and type. */
function census(placement: string): Record<Color, Record<PieceType, number>> {
	const count: Record<Color, Record<PieceType, number>> = {
		w: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
		b: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 }
	};
	for (const character of placement) {
		const lower = character.toLowerCase();
		if (!TYPES.has(lower)) continue;
		count[character === lower ? 'b' : 'w'][lower as PieceType]++;
	}
	return count;
}

/**
 * `taken` is what the other side is missing, floored at zero — a side that has promoted holds more queens
 * than it started with, and "minus one queen taken" is not a thing anyone wants to read.
 */
const missing = (have: Record<PieceType, number>): Taken[] =>
	ORDER.map((type) => ({ type, count: Math.max(0, START[type] - have[type]) })).filter((t) => t.count > 0);

const worth = (have: Record<PieceType, number>) => ORDER.reduce((sum, type) => sum + VALUES[type] * have[type], 0);

export function materialOf(fen: string | null | undefined): Material {
	const placement = fen?.split(' ')[0];
	if (!placement) return none();
	const count = census(placement);
	return {
		taken: { w: missing(count.b), b: missing(count.w) },
		advantage: worth(count.w) - worth(count.b)
	};
}

/** What to write beside a side: "+3" for the one ahead, nothing for the other. */
export const leadFor = (material: Material, color: Color): string => {
	const lead = color === 'w' ? material.advantage : -material.advantage;
	return lead > 0 ? `+${lead}` : '';
};
