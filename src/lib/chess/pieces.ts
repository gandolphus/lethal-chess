// MVP piece rendering uses the filled Unicode glyphs for *both* colours and
// separates them with CSS fill/stroke. The outline glyphs (♔♕♖…) render
// inconsistently across fonts and disappear on light squares; the filled set is
// stable everywhere. Swap this for SVG sprites when the board gets its visual pass.

export const GLYPHS: Record<string, string> = {
	k: '♚',
	q: '♛',
	r: '♜',
	b: '♝',
	n: '♞',
	p: '♟'
};

export const PROMOTION_PIECES = ['q', 'r', 'b', 'n'] as const;
